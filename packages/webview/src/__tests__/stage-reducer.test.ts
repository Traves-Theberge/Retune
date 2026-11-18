import { describe, it, expect } from 'vitest';
import { computePreviewClass, initialModel, isDirty, reduce, targetLabel } from '../state/stage-reducer';
import { DEMO_META } from '../state/demo';

const base = () => initialModel('standalone');

describe('stage reducer', () => {
  it('tracks the active file problem', () => {
    let m = initialModel('vscode');
    expect(m.problem).toBeNull();
    m = reduce(m, { type: 'host', now: 1, message: { type: 'SYNC_PROBLEM', payload: { fileName: 'Button.tsx', message: 'Unexpected token (3:1)' } } });
    expect(m.problem).toEqual({ fileName: 'Button.tsx', message: 'Unexpected token (3:1)' });
    m = reduce(m, { type: 'host', now: 2, message: { type: 'SYNC_PROBLEM', payload: null } });
    expect(m.problem).toBeNull();
  });
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
    expect(targetLabel({ ...m, stage: { ...m.stage, cvaTarget: { group: 'variant', key: 'destructive' } } })).toBe('variant:destructive');
    expect(targetLabel(initialModel('vscode'))).toBe('Component');
  });

  it('computes preview class cleanly when editing a specific cvaTarget variant', () => {
    const m = base();
    const editingVariant = {
      ...m,
      stage: {
        ...m.stage,
        cvaTarget: { group: 'variant', key: 'destructive' },
        harmonicsClass: 'bg-custom-variant text-white',
      },
    };
    const cls = computePreviewClass(editingVariant);
    expect(cls).toContain('inline-flex');
    expect(cls).toContain('bg-custom-variant');
    expect(cls).not.toContain('bg-indigo-600');
  });
  it('starts a clean undo history on first load and on a file switch', () => {
    const host = (message: any, now: number) => ({ type: 'host' as const, message, now });
    let m = initialModel('vscode');
    m = reduce(m, host({ type: 'SYNC_COMPONENT', payload: DEMO_META }, 1));
    m = reduce(m, host({ type: 'SYNC_STAGE_STATE', payload: { ...m.stage, harmonicsClass: 'a', baselineClass: 'a' } }, 2));
    expect(m.session.past).toEqual([]);
    expect(m.session.present).toBe('a');
    m = reduce(m, host({ type: 'SYNC_COMPONENT', payload: { ...DEMO_META, filePath: 'b.tsx' } }, 3000));
    m = reduce(m, host({ type: 'SYNC_STAGE_STATE', payload: { ...m.stage, harmonicsClass: 'b', baselineClass: 'b' } }, 3001));
    expect(m.session.past).toEqual([]);
    expect(m.session.present).toBe('b');
  });

  it('tracks text dirtiness via baselineText and clears it on markSynced', () => {
    const m0 = reduce(base(), {
      type: 'patchStage',
      patch: { baselineText: 'Search...', propValues: { label: 'Search...' } },
    });
    expect(isDirty(m0)).toBe(false);
    const edited = reduce(m0, {
      type: 'patchStage',
      patch: { propValues: { label: 'Filter tasks...' } },
    });
    expect(isDirty(edited)).toBe(true);
    const synced = reduce(edited, { type: 'markSynced' });
    expect(isDirty(synced)).toBe(false);
    expect(synced.stage.baselineText).toBe('Filter tasks...');
  });
});
