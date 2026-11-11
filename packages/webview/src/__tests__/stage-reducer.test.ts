import { describe, it, expect } from 'vitest';
import { computePreviewClass, initialModel, isDirty, reduce, targetLabel } from '../state/stage-reducer';
import { DEMO_META } from '../state/demo';

const base = () => initialModel('standalone');

describe('stage reducer', () => {
  it('starts empty in VS Code and with the demo standalone', () => {
    expect(initialModel('vscode').meta).toBeNull();
    expect(base().meta?.componentName).toBe('Button');
    expect(isDirty(base())).toBe(false);
  });
  it('SYNC_COMPONENT never touches the working classes', () => {
    let m = reduce(base(), { type: 'setClasses', classes: 'edited', now: 1000 });
    m = reduce(m, { type: 'host', now: 2000, message: { type: 'SYNC_COMPONENT', payload: { ...DEMO_META, rawSource: 'changed' } } });
    expect(m.stage.harmonicsClass).toBe('edited'); expect(m.meta?.rawSource).toBe('changed'); expect(m.session.past.length).toBe(1);
  });
  it('tracks dirty state, undo and redo', () => {
    let m = reduce(base(), { type: 'setClasses', classes: 'x', now: 1000 });
    expect(isDirty(m)).toBe(true);
    m = reduce(m, { type: 'undo' }); expect(isDirty(m)).toBe(false);
    m = reduce(m, { type: 'redo' }); expect(m.stage.harmonicsClass).toBe('x');
    m = reduce(m, { type: 'markSynced' }); expect(isDirty(m)).toBe(false);
  });
  it('records host class changes on the same target and resets history on a new target', () => {
    const m0 = base();
    let m = reduce(m0, { type: 'host', now: 5000, message: { type: 'SYNC_STAGE_STATE', payload: { ...m0.stage, harmonicsClass: 'from-sidebar' } } });
    expect(m.session.past).toEqual([m0.stage.harmonicsClass]);
    m = reduce(m, { type: 'host', now: 9000, message: { type: 'SYNC_STAGE_STATE', payload: { ...m.stage, targetElement: 'span', targetIndex: 0, harmonicsClass: 's', baselineClass: 's' } } });
    expect(m.session.past).toEqual([]); expect(m.session.present).toBe('s');
  });
  it('computes preview classes and labels', () => {
    const m = base();
    expect(computePreviewClass(m)).toContain('bg-indigo-600');
    expect(computePreviewClass(m, 'only')).toMatch(/^only /);
    expect(targetLabel(m)).toBe('buttonVariants');
    expect(targetLabel({ ...m, stage: { ...m.stage, targetElement: 'span' } })).toBe('<span>');
    expect(targetLabel(initialModel('vscode'))).toBe('Component');
  });
});
