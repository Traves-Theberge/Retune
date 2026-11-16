import { describe, it, expect } from 'vitest';
import { computeCvaBaseEdit, computeCvaVariantEdit, mutateCvaBase, mutateCvaVariant } from '../ast/jsx-mutator';
import { extractCvaMetadata } from '../ast/cva-extractor';

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

describe('final-review regressions: single cva source of truth', () => {
  it('A2: the first cva() call is the component cva for metadata and edit', () => {
    const src = 'const a = cva("first-base", { variants: { size: { sm: "h-8" } } });\nconst b = cva("second-base", { variants: { tone: { x: "y" } } });\n';
    const meta = extractCvaMetadata(src);
    expect(meta.cvaIdentifier).toBe('a');
    expect(meta.baseClasses).toBe('first-base');
    expect(Object.keys(meta.variants)).toEqual(['size']);
    expect(mutateCvaBase(src, 'changed')).toBe(src.replace('"first-base"', '"changed"'));
  });
  it('A2: expression-free template base is read and edited', () => {
    const src = 'const b = cva(`inline-flex px-4`, {});';
    expect(extractCvaMetadata(src).baseClasses).toBe('inline-flex px-4');
    expect(mutateCvaBase(src, 'inline-flex px-[12px]')).toBe('const b = cva(`inline-flex px-[12px]`, {});');
  });
});

describe('computeCvaVariantEdit', () => {
  const src = `const b = cva('base', {
  variants: {
    variant: {
      default: 'bg-indigo-600 text-white',
      ghost: 'hover:bg-zinc-800',
    },
    size: {
      sm: 'h-8 px-3',
    },
  },
  defaultVariants: { variant: 'default', size: 'sm' },
});`;

  it('replaces classes for an existing variant key while keeping quotes', () => {
    const out = mutateCvaVariant(src, 'variant', 'ghost', 'bg-transparent text-zinc-200');
    expect(out).toContain("ghost: 'bg-transparent text-zinc-200',");
    expect(out).toContain("default: 'bg-indigo-600 text-white',");
  });

  it('adds a new named variant key to an existing group without disturbing formatting', () => {
    const out = mutateCvaVariant(src, 'size', 'xl', 'h-12 px-8 text-base');
    expect(out).toContain('xl: "h-12 px-8 text-base"');
    const meta = extractCvaMetadata(out);
    expect(meta.variants.size).toEqual(['sm', 'xl']);
    expect(meta.variantClasses?.size?.xl).toBe('h-12 px-8 text-base');
  });

  it('returns null when the group does not exist or cva() is missing', () => {
    expect(computeCvaVariantEdit(src, 'missing', 'a', 'p-2')).toBeNull();
    expect(computeCvaVariantEdit('export const X = () => <div/>;', 'variant', 'a', 'p-2')).toBeNull();
  });
});
