import { describe, it, expect } from 'vitest';
import {
  applyEdits,
  computeClassNameEdit,
  computeDefaultVariantEdit,
  computeTextEdit,
  extractComponentName,
  extractElementClassName,
  extractElementText,
  extractPreviewTree,
  listElements,
  mutateClassName,
  mutateDefaultVariant,
  mutateElementText,
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

  it('preserves interleaved text alongside child elements', () => {
    const src = `
      export function FilterButton() {
        return (
          <button className="filter-pill">
            <span className="dot" />
            All <span className="pill-count">4</span>
          </button>
        );
      }
    `;
    const tree = extractPreviewTree(src);
    expect(tree?.children.map((c) => c.tag)).toEqual(['span', '#text', 'span']);
    expect(tree?.children[1].text?.trim()).toBe('All');
    expect(tree?.children[2].text).toBe('4');
  });

  it('passes evaluated props and JSX children into imported components via resolveImport', () => {
    const page = `
      import { Card } from './Card';
      const item = { name: 'Stretch', enabled: true };
      export function Page() {
        return <Card className="outer-card" title={item.name} active={item.enabled}><span className="badge">Ready</span></Card>;
      }
    `;
    const card = `
      export function Card({ title, active, children }: { title: string; active?: boolean; children?: React.ReactNode }) {
        return (
          <article className={active ? 'card on' : 'card off'}>
            <h3>{title}</h3>
            <Icon name="plus" className="icon-add" />
            {children}
          </article>
        );
      }
    `;
    const tree = extractPreviewTree(page, {
      resolveImport: (spec) => (spec === './Card' ? card : null),
    });
    expect(tree?.tag).toBe('article');
    expect(tree?.sourceTag).toBe('Card');
    expect(tree?.elementIndex).toBe(0);
    expect(tree?.className).toBe('card on outer-card');
    expect(tree?.children[0]?.sourceTag).toBe('Card');
    expect(tree?.children[0]?.elementIndex).toBe(0);
    expect(tree?.children[0]?.text).toBe('Stretch');
    expect(tree?.children[1]?.tag).toBe('svg');
    expect(tree?.children[2]?.text).toBe('Ready');

    const iconTree = extractPreviewTree(`export function Btn() { return <button><Icon name="plus" className="ic" /></button>; }`);
    expect(iconTree?.children[0]?.tag).toBe('svg');
    expect(iconTree?.children[0]?.sourceTag).toBe('Icon');
    expect(iconTree?.children[0]?.elementIndex).toBe(0);
    expect(iconTree?.children[0]?.className).toBe('ic');
  });

  it('evaluates block-body declarations, string/array methods, and fallback coalescing in functions and map callbacks', () => {
    const src = `
      import { useState } from 'react';
      const TASKS = [
        { id: '1', name: 'Stretch', enabled: true },
        { id: '2', name: 'Hydrate', enabled: false },
      ];
      export function TasksView({ catalog }: { catalog: any }) {
        const [search] = useState('');
        const [filter] = useState('all');
        const hasActiveFilters = search.trim() !== '' || filter !== 'all';
        const activeCount = TASKS.filter((t) => t.enabled).length;
        return (
          <div className="tasks-view">
            {hasActiveFilters && <button className="clear-filters">Clear all filters</button>}
            <span className="active-total">{activeCount}</span>
            {TASKS.map((t) => {
              const group = catalog?.[t.id]?.group ?? 'Daily rituals';
              const status = t.enabled ? 'ACTIVE' : 'PAUSED';
              return <div className="row" key={t.id}><span>{t.name}</span><span>{group}</span><span>{status}</span></div>;
            })}
          </div>
        );
      }
    `;
    const tree = extractPreviewTree(src);
    const json = JSON.stringify(tree);
    expect(json).not.toContain('Clear all filters');
    expect(json).toContain('"text":"1"');
    expect(json).toContain('"text":"Daily rituals"');
    expect(json).toContain('"text":"ACTIVE"');
    expect(json).toContain('"text":"PAUSED"');
  });

  it('renders 3-column dynamic grids, 14-day calendars, date formatting, null arrow useState, and inactive ternaries', () => {
    const src = `
      import { useState } from 'react';
      export function Dashboard({ items, days, events, s, presentation, clock, line, taskId, badge }: any) {
        const [settings] = useState<string | null>(() => {
          const url = new URL(window.location.href);
          return url.pathname === '/settings' ? 'general' : null;
        });
        const [filterTask] = useState<string | undefined>();
        return (
          <div className="dash app-shell">
            <p className="date">{new Date(clock).toLocaleDateString()}</p>
            <p className="time">{new Date(clock).toLocaleTimeString()}</p>
            <p className="iso">{new Date(clock).toISOString()}</p>
            <p className="headline">{line}</p>
            <h3 className="month">{presentation.label}</h3>
            <span className="tab-badge">{badge}</span>
            <button>{s.state === 'paused' ? 'Resume schedule' : 'Pause for an hour'}</button>
            <span className="status">{s.reason ? \`Deferred · \${s.reason.replaceAll('_', ' ')}\` : 'Your rhythm is taken care of'}</span>
            {s.pending.length > 0 && <div className="pending-banner">Pending</div>}
            {events.attention.map((n: string, i: number) => <p key={i}>{n}</p>)}
            {settings && <section className="settings-modal">Settings Drawer</section>}
            {taskId && <span className="filter-pill">Filter</span>}
            {filterTask && <span className="task-pill">Task</span>}
            {!settings && <main className="main-today">Active View</main>}
            <div className="cards">
              {items.map((item: any) => <article key={item.id}>{item.name}</article>)}
            </div>
            <div className="calendar">
              {days.map((day: any) => (
                <button key={day.date} data-status={day.status} data-intensity={day.intensity}>
                  {Number(day.date.slice(-2))}
                </button>
              ))}
            </div>
            <BreakHost />
          </div>
        );
      }
    `;
    const tree = extractPreviewTree(src)!;
    const json = JSON.stringify(tree);
    expect(json).toContain('"text":"Tuesday, May 12"');
    expect(json).toContain('"text":"10:30 AM"');
    expect(json).toContain('"text":"2026-05-12T10:30:00.000Z"');
    expect(json).toContain('"text":"A steady pace for today."');
    expect(json).toContain('"text":"May 2026"');
    expect(json).toContain('"text":"4"');
    expect(json).toContain('"text":"Pause for an hour"');
    expect(json).toContain('"text":"Your rhythm is taken care of"');
    expect(json).toContain('Active View');
    expect(json).not.toContain('Resume schedule');
    expect(json).not.toContain('Deferred ·');
    expect(json).not.toContain('Pending');
    expect(json).not.toContain('Settings Drawer');
    expect(json).not.toContain('filter-pill');
    expect(json).not.toContain('task-pill');
    expect(json).not.toContain('retune-component-stub');
    expect(json).toContain('Morning Stretch');
    expect(json).toContain('Hydrate & Reset');
    expect(json).toContain('Screen & Eye Rest');
    const cal = tree.children.find((c) => c.className === 'calendar');
    expect(cal?.children).toHaveLength(14);
    expect(cal?.children[0]?.attrs?.['data-intensity']).toBe(2);
    expect(cal?.children[13]?.attrs?.['data-status']).toBe('future');
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

describe('jsx-mutator: text extraction and non-lossy text edits', () => {
  it('extracts static text from JSX children and field attributes in listElements', () => {
    const src = `
      export function Form() {
        return (
          <form className="wrap">
            <h2>\n  Daily Rhythm\n</h2>
            <p>{'Check your posture'}</p>
            <input placeholder="Search rituals..." />
            <input value="Morning Stretch" />
          </form>
        );
      }
    `;
    const els = listElements(src);
    expect(els.find((e) => e.name === 'h2')?.text).toBe('Daily Rhythm');
    expect(els.find((e) => e.name === 'p')?.text).toBe('Check your posture');
    const inputs = els.filter((e) => e.name === 'input');
    expect(inputs[0]?.text).toBe('Search rituals...');
    expect(inputs[1]?.text).toBe('Morning Stretch');
    expect(extractElementText(src, 'h2')).toBe('Daily Rhythm');
  });

  it('edits direct JSXText while preserving indentation and sibling comments/whitespace', () => {
    const src = `export function Card() {\n  return (\n    <h2>\n      Old Title\n    </h2>\n  );\n}`;
    const updated = mutateElementText(src, 'h2', 'New Title');
    expect(updated).toBe(
      `export function Card() {\n  return (\n    <h2>\n      New Title\n    </h2>\n  );\n}`
    );
  });

  it('edits string literal expression children while preserving quotes', () => {
    const src = `export function P() { return <p>{'Hello world'}</p>; }`;
    const updated = mutateElementText(src, 'p', 'Updated copy');
    expect(updated).toBe(`export function P() { return <p>{'Updated copy'}</p>; }`);
  });

  it('edits input placeholder and value attributes in place and inserts placeholder when absent', () => {
    const phSrc = `<input type="search" placeholder='Search...' />`;
    expect(mutateElementText(phSrc, 'input', 'Filter tasks...')).toBe(
      `<input type="search" placeholder='Filter tasks...' />`
    );

    const valSrc = `<input value="Alpha" onChange={() => {}} />`;
    expect(mutateElementText(valSrc, 'input', 'Beta')).toBe(
      `<input value="Beta" onChange={() => {}} />`
    );

    const bareInput = `<input type="text" />`;
    const edit = computeTextEdit(bareInput, { name: 'input' }, 'Type here');
    expect(applyEdits(bareInput, edit)).toBe(`<input placeholder="Type here" type="text" />`);
  });

  it('evaluates CSS Module classes and dynamic template/conditional classes in extractPreviewTree', () => {
    const src = `
      import { useState } from 'react';
      import styles from './Card.module.css';
      export function FilterPanel() {
        const [tab] = useState('all');
        const [state] = useState<'ready' | 'connected'>('ready');
        return (
          <div className={styles.panelCard}>
            <button className={\`filter-chip \${tab === 'all' ? 'selected' : ''}\`}>All</button>
            <article className={\`connector-card connector-card-\${state}\`}>Calendar</article>
          </div>
        );
      }
    `;
    const tree = extractPreviewTree(src);
    expect(tree?.className).toBe('panelCard');
    expect(tree?.children[0]?.className).toBe('filter-chip selected');
    expect(tree?.children[1]?.className).toBe('connector-card connector-card-ready');
  });
});
