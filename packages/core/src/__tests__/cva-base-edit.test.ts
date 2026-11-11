import { describe, it, expect } from 'vitest';
import { computeCvaBaseEdit, mutateCvaBase } from '../ast/jsx-mutator';

const SRC = `// keep
const b = cva(
  'inline-flex gap-2', // base
  { variants: { size: { sm: 'h-8' } }, defaultVariants: { size: 'sm' } }
);
export const A = () => <button className="x">a</button>;
`;

describe('computeCvaBaseEdit', () => {
  it('replaces only the base literal and keeps the quote style', () => {
    expect(mutateCvaBase(SRC, 'inline-flex gap-4')).toBe(SRC.replace("'inline-flex gap-2'", "'inline-flex gap-4'"));
  });
  it('escapes the quote character of the literal', () => {
    expect(mutateCvaBase(SRC, "content-['a']")).toContain("'content-[\\'a\\']', // base");
  });
  it('keeps an expression-free template literal as a template and escapes ${', () => {
    const src = 'const b = cva(`p-2`, {});';
    expect(mutateCvaBase(src, 'p-4 ${x}')).toBe('const b = cva(`p-4 \\${x}`, {});');
  });
  it('supports member calls like cvaLib.cva("...")', () => {
    expect(mutateCvaBase('const b = lib.cva("p-2");', 'p-3')).toBe('const b = lib.cva("p-3");');
  });
  it('returns null when the base is not a plain string or there is no cva()', () => {
    expect(computeCvaBaseEdit('const b = cva(["p-2", "m-1"], {});', 'p-4')).toBeNull();
    expect(computeCvaBaseEdit('const b = cva(base, {});', 'p-4')).toBeNull();
    expect(computeCvaBaseEdit('const x = <div className="a" />;', 'p-4')).toBeNull();
  });
  it('produces one small edit', () => {
    const edit = computeCvaBaseEdit(SRC, 'p-1')!;
    expect(SRC.slice(edit.start, edit.end)).toBe("'inline-flex gap-2'");
  });
});
