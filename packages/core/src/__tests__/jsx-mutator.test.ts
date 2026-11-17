import { describe, it, expect } from 'vitest';
import {
  applyEdits,
  computeClassNameEdit,
  computeDefaultVariantEdit,
  extractComponentName,
  extractElementClassName,
  extractPreviewTree,
  listElements,
  mutateClassName,
  mutateDefaultVariant,
} from '../ast/jsx-mutator';

describe('jsx-mutator: minimal, non-lossy edits', () => {
  it('only changes the className literal and preserves everything else byte-for-byte', () => {
    const src = `// keep me
export function A() {
  return (
    <div   className='a b'   data-x={1}>
      {/* inline comment */}
      <span className="c">hi</span>
    </div>
  );
}
`;
    const out = mutateClassName(src, 'div', 'a b c');
    expect(out).toBe(src.replace("'a b'", "'a b c'"));
  });

  it('produces a single small edit rather than a whole-file replacement', () => {
    const src = `const x = <button className="p-2">ok</button>;`;
    const edit = computeClassNameEdit(src, { name: 'button' }, 'p-4')!;
    expect(edit.end - edit.start).toBeLessThan(src.length / 2);
    expect(applyEdits(src, edit)).toBe(`const x = <button className="p-4">ok</button>;`);
  });

  it('inserts className when the element has none', () => {
    const out = mutateClassName(`const x = <button disabled>ok</button>;`, 'button', 'p-2');
    expect(out).toBe(`const x = <button className="p-2" disabled>ok</button>;`);
  });

  it('targets by source offset, not just by name', () => {
    const src = `const x = (<div><p className="one">1</p><p className="two">2</p></div>);`;
    const offset = src.indexOf('two');
    const out = mutateClassName(src, 'p', 'changed', offset);
    expect(out).toContain('className="one"');
    expect(out).toContain('className="changed"');
    expect(extractElementClassName(src, 'p', offset)).toBe('two');
  });

  it('updates the static string inside cn()/clsx() and keeps dynamic arguments', () => {
    const src = `const x = <button className={cn("base p-2", active && "ring-2", props.className)}>ok</button>;`;
    const out = mutateClassName(src, 'button', 'base p-6');
    expect(out).toBe(
      `const x = <button className={cn("base p-6", active && "ring-2", props.className)}>ok</button>;`
    );
    expect(extractElementClassName(src, 'button')).toBe('base p-2');
  });

  it('prepends classes for a cn() call that has no static string', () => {
    const src = `const x = <b className={cn(active && "ring-2")}>ok</b>;`;
    expect(mutateClassName(src, 'b', 'p-1')).toBe(`const x = <b className={cn("p-1", active && "ring-2")}>ok</b>;`);
  });

  it('keeps template-literal interpolations and only rewrites the static prefix', () => {
    const src = 'const x = <b className={`p-2 ${extra}`}>ok</b>;';
    expect(mutateClassName(src, 'b', 'p-8')).toBe('const x = <b className={`p-8 ${extra}`}>ok</b>;');
  });

  it('handles multiple components in one file and lists them with positions', () => {
    const src = `export const A = () => <a className="x">a</a>;\nexport const B = () => <b className="y">b</b>;\n`;
    const els = listElements(src);
    expect(els.map((e) => e.name)).toEqual(['a', 'b']);
    expect(els[1].line).toBe(2);
    expect(els[1].className).toBe('y');
  });

  it('survives syntax that is not valid yet without throwing', () => {
    expect(() => extractElementClassName('const x = <div className="a"', 'div')).not.toThrow();
  });
});

describe('jsx-mutator: defaultVariants', () => {
  const src = `const v = cva("base", {
  variants: { size: { sm: "h-8", lg: "h-10" } },
  defaultVariants: {
    size: 'sm', // keep this comment
  },
});`;

  it('replaces an existing default in place', () => {
    const out = mutateDefaultVariant(src, 'size', 'lg');
    expect(out).toContain("size: 'lg', // keep this comment");
  });

  it('adds a missing group without disturbing the rest', () => {
    const edit = computeDefaultVariantEdit(src, 'tone', 'soft')!;
    const out = applyEdits(src, edit);
    expect(out).toContain('tone: "soft"');
    expect(out).toContain('// keep this comment');
  });
});

describe('extractPreviewTree', () => {
  it('builds a nested JSX preview hierarchy with matching per-tag indices', () => {
    const src = `
      function Helper() { return <span className="helper">h</span>; }
      export function Card() {
        return (
          <div className="rounded-lg border p-4">
            <h3 className="font-bold">Title</h3>
            <span className="text-sm">Subtitle</span>
            <button className="px-3 py-1">Action</button>
          </div>
        );
      }
    `;
    const tree = extractPreviewTree(src);
    expect(tree).not.toBeNull();
    expect(tree?.tag).toBe('div');
    expect(tree?.className).toBe('rounded-lg border p-4');
    expect(tree?.children.map((c) => c.tag)).toEqual(['h3', 'span', 'button']);
    expect(tree?.children[0].text).toBe('Title');
    // Second <span> in file because Helper() has index 0
    expect(tree?.children[1].elementIndex).toBe(1);
    expect(tree?.children[2].className).toBe('px-3 py-1');
  });

  it('prefers the main page return over local JSX variables and early guards', () => {
    const src = `
      import React, { useState } from 'react';
      function Sidebar({ page }: { page: string }) {
        return <aside className="sidebar">{(['Today', 'Tasks'] as const).map((n) => <button className={page === n ? 'nav-item selected' : 'nav-item'} key={n}>{n}</button>)}</aside>;
      }
      export function Page({ ready }: { ready: boolean }) {
        const [tab] = useState('Today');
        const banner = <div className="banner">Notice</div>;
        if (!ready) return <main className="loading"><p>Loading</p></main>;
        return (
          <div className="app-shell">
            <Sidebar page={tab} />
            {tab === 'Today' && <section className="hero"><h1>Dashboard</h1>{banner}</section>}
            {tab === 'Tasks' && <section className="tasks"><h1>Tasks</h1></section>}
          </div>
        );
      }
    `;
    const tree = extractPreviewTree(src);
    expect(tree?.tag).toBe('div');
    expect(tree?.className).toBe('app-shell');
    const serialized = JSON.stringify(tree);
    expect(serialized).toContain('Dashboard');
    expect(serialized).toContain('Notice');
    expect(serialized).toContain('nav-item selected');
    expect(serialized).not.toContain('>Tasks<');
  });

  it('expands SVGs with constant colors, spread props, and local helper components', () => {
    const src = `
      const ink = '#244b3c';
      const iconProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' };
      function Dot({ x }: { x: number }) { return <circle cx={x} cy="12" r="4" fill={ink} />; }
      export function Art() {
        return <svg {...iconProps}><path d="M5 12h14" /><Dot x={8} /></svg>;
      }
    `;
    const tree = extractPreviewTree(src);
    expect(tree?.tag).toBe('svg');
    expect(tree?.attrs?.viewBox).toBe('0 0 24 24');
    expect(tree?.children[0]?.tag).toBe('path');
    expect(tree?.children[0]?.attrs?.d).toBe('M5 12h14');
    expect(tree?.children[1]?.tag).toBe('circle');
    expect(tree?.children[1]?.attrs?.fill).toBe('#244b3c');
    expect(tree?.children[1]?.attrs?.cx).toBe(8);
  });

  it('resolves re-export barrel files and cross-file imports when resolveImport is supplied', () => {
    const barrel = `export { Hub as SettingsPage } from './Hub';`;
    const hub = `export function Hub() { return <section className="hub"><h2>Connections</h2></section>; }`;
    const tree = extractPreviewTree(barrel, {
      resolveImport: (spec) => (spec === './Hub' ? hub : null),
    });
    expect(tree?.tag).toBe('section');
    expect(tree?.elementIndex).toBe(-1);
    expect(JSON.stringify(tree)).toContain('Connections');
  });
});

describe('extractComponentName', () => {
  it('extracts exported function or arrow component names and falls back cleanly', () => {
    expect(extractComponentName('export function PrimaryButton() { return <button />; }')).toBe('PrimaryButton');
    expect(extractComponentName('export const CardBox = () => <div />;')).toBe('CardBox');
    expect(extractComponentName('export default function ModalShell() { return <section />; }')).toBe('ModalShell');
    expect(extractComponentName('const buttonVariants = cva("px-2");')).toBe('buttonVariants');
    expect(extractComponentName('const x = 1;')).toBe('Component');
  });
});


describe('final-review regressions', () => {
  it('A1: offset of an element adjacent to a shorter tag targets that element', () => {
    const src = 'const x = <ul><li><a className="one">t</a></li></ul>;';
    const a = listElements(src).find((e) => e.name === 'a')!;
    const out = applyEdits(src, computeClassNameEdit(src, { offset: a.start }, 'NEW'));
    expect(out).toBe('const x = <ul><li><a className="NEW">t</a></li></ul>;');
  });

  it('A3: interpolated template reads the leading quasi and writes it back', () => {
    const src = 'const x = <div className={`flex px-2 ${x}`} />;';
    expect(listElements(src)[0].className).toBe('flex px-2');
    expect(mutateClassName(src, 'div', 'flex px-[12px]')).toBe('const x = <div className={`flex px-[12px] ${x}`} />;');
  });

  it('A3: the generated wrapper is read and replaced in place, never nested', () => {
    const src = 'const x = <div className={c} />;';
    const once = mutateClassName(src, 'div', 'p-1');
    expect(listElements(once)[0].className).toBe('p-1');
    expect(mutateClassName(once, 'div', 'p-2')).toBe('const x = <div className={["p-2", c].filter(Boolean).join(" ")} />;');
  });

  it('A3: bare dynamic expression reads empty', () => {
    expect(listElements('const x = <div className={c} />;')[0].className).toBe('');
  });

  it('A4: quotes in a bare attribute switch quote style or use an expression container', () => {
    expect(mutateClassName('const x = <a className="x" />;', 'a', 'content-["y"]')).toBe(
      `const x = <a className='content-["y"]' />;`
    );
    const both = `a-["x"] b-['y'] c\d`;
    const out = mutateClassName('const x = <a className="x" />;', 'a', both);
    expect(out).toContain('className={"');
    expect(listElements(out)[0].className).toBe(both);
    const fresh = mutateClassName('const x = <a />;', 'a', 'content-["y"]');
    expect(listElements(fresh)[0].className).toBe('content-["y"]');
  });

  it('A5: new attribute on a generic component goes after the type arguments', () => {
    const src = 'const x = <Foo<T> bar />;';
    expect(mutateClassName(src, 'Foo', 'p-1')).toBe('const x = <Foo<T> className="p-1" bar />;');
  });
});
