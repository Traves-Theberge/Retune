import { describe, it, expect } from 'vitest';
import {
  applyEdits,
  computeClassNameEdit,
  computeDefaultVariantEdit,
  extractElementClassName,
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

