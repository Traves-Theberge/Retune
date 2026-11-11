import { describe, it, expect } from 'vitest';
import { applyEdits, extractCvaMetadata, listElements, type StageState } from '@retune/core';
import { fileClassFor, normalizeTarget, planClassMutation, planVariantMutation, reconcile, resolveTarget } from '../state/stage-state';

const SRC = `const b = cva('base-a', { variants: {}, defaultVariants: { size: 'sm' } });
export const A = () => (
  <div className="wrap">
    <span className="one">1</span>
    <span className="two">2</span>
  </div>
);
`;
const PLAIN = `export const A = () => <div className="wrap"><span className="one">1</span></div>;`;
const state = (h: string, b: string): StageState => ({
  selectedVariants: {}, propValues: {}, harmonicsClass: h, baselineClass: b,
  viewport: 'responsive', showGrid: true, activeTab: 'stage',
});

describe('targets', () => {
  const els = listElements(SRC);
  it('resolves the Nth exact-name element', () => {
    expect(resolveTarget(els, 'span', 1)?.className).toBe('two');
    expect(resolveTarget(els, 'Span', 0)).toBeUndefined();
    expect(resolveTarget(els, undefined)).toBeUndefined();
  });
  it('normalises unknown names to the root and clamps the index', () => {
    expect(normalizeTarget(els, 'Button')).toEqual({});
    expect(normalizeTarget(els, 'span', 9)).toEqual({ targetElement: 'span', targetIndex: 1 });
    expect(normalizeTarget(els, 'div')).toEqual({ targetElement: 'div', targetIndex: 0 });
  });
  it('reads the file class for root and element targets', () => {
    expect(fileClassFor(extractCvaMetadata(SRC), els, {})).toBe('base-a');
    expect(fileClassFor(extractCvaMetadata(SRC), els, { targetElement: 'span', targetIndex: 1 })).toBe('two');
    expect(fileClassFor(extractCvaMetadata(PLAIN), listElements(PLAIN), {})).toBe('wrap');
  });
});

describe('reconcile', () => {
  it('follows the file when clean or when the target changed', () => {
    expect(reconcile(state('a', 'a'), 'b', false)).toMatchObject({ harmonicsClass: 'b', baselineClass: 'b' });
    expect(reconcile(state('edited', 'a'), 'z', true)).toMatchObject({ harmonicsClass: 'z', baselineClass: 'z' });
  });
  it('keeps unsynced edits when the file changes underneath', () => {
    expect(reconcile(state('edited', 'a'), 'b', false)).toMatchObject({ harmonicsClass: 'edited', baselineClass: 'b' });
  });
});

describe('planClassMutation', () => {
  it('edits the cva base for the root target', () => {
    const plan = planClassMutation(SRC, {}, 'base-b');
    expect(plan).toMatchObject({ ok: true, message: 'Synced to code' });
    expect(applyEdits(SRC, (plan as any).edit)).toBe(SRC.replace("'base-a'", "'base-b'"));
  });
  it('edits exactly the Nth element', () => {
    const plan = planClassMutation(SRC, { targetElement: 'span', targetIndex: 1 }, 'two x');
    expect(applyEdits(SRC, (plan as any).edit)).toBe(SRC.replace('"two"', '"two x"'));
  });
  it('fails instead of writing elsewhere when the target is gone', () => {
    expect(planClassMutation(SRC, { targetElement: 'span', targetIndex: 2 }, 'x')).toEqual({ ok: false, message: 'No <span> element found' });
    expect(planClassMutation(SRC, { targetElement: 'section', targetIndex: 0 }, 'x')).toEqual({ ok: false, message: 'No <section> element found' });
  });
  it('reports a no-op, non-string cva bases, empty files and parse errors', () => {
    expect(planClassMutation(SRC, {}, 'base-a')).toEqual({ ok: true, edit: null, message: 'Already up to date' });
    expect(planClassMutation(`const b = cva(['a'], {});`, {}, 'x')).toEqual({ ok: false, message: 'cva() base classes are not a plain string' });
    expect(planClassMutation(`export const n = 1;`, {}, 'x')).toEqual({ ok: false, message: 'No JSX element found' });
    expect(planClassMutation(PLAIN, {}, 'wrap p-2')).toMatchObject({ ok: true });
  });
});

describe('planVariantMutation', () => {
  it('sets the default and reports failures', () => {
    const plan = planVariantMutation(SRC, 'size', 'lg');
    expect(plan).toMatchObject({ ok: true, message: 'Default size set to lg' });
    expect(applyEdits(SRC, (plan as any).edit)).toContain("size: 'lg'");
    expect(planVariantMutation(PLAIN, 'size', 'lg')).toEqual({ ok: false, message: 'No defaultVariants block found' });
    expect(planVariantMutation(SRC, 'size', 'sm')).toEqual({ ok: true, edit: null, message: 'Already up to date' });
  });
});
