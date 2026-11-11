import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StageHeader } from '../components/stage-header';
import type { StageStore } from '../state/use-stage';
import { DEFAULT_CONFIG, DEFAULT_STAGE_STATE, DEMO_META } from '../state/demo';

const noop = () => {};
const store = (over: Partial<StageStore> = {}): StageStore => ({
  hostKind: 'standalone', meta: DEMO_META, config: DEFAULT_CONFIG, stage: DEFAULT_STAGE_STATE,
  dirty: false, canUndo: false, canRedo: false, toast: null, targetLabel: 'buttonVariants', previewClass: '', baselinePreviewClass: '',
  setClasses: noop, undo: noop, redo: noop, discard: noop, sync: noop, selectVariant: noop, commitVariant: noop, setProp: noop,
  patchStage: noop, patchConfig: noop, selectElement: noop, openStage: noop, notify: noop, ...over,
});
const render = (s: StageStore) => renderToStaticMarkup(<StageHeader store={s} tone="dark" onToggleTone={noop} onCompare={noop} />);

describe('StageHeader', () => {
  it('has exactly one Sync, disabled while clean', () => {
    const out = render(store());
    expect(out.match(/>Sync</g)?.length).toBe(1);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*title="Sync to code \(Ctrl\+S\)"|<button[^>]*title="Sync to code \(Ctrl\+S\)"[^>]*disabled=""/);
    expect(out).not.toContain('Unsynced changes');
    expect(out).toContain('buttonVariants');
  });
  it('enables the actions and shows the dirty dot when dirty', () => {
    const out = render(store({ dirty: true, canUndo: true }));
    expect(out).toContain('aria-label="Unsynced changes"');
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*title="Sync to code/);
    expect(out).toMatch(/aria-label="Undo"/); expect(out).toMatch(/aria-label="Redo"[^>]*disabled=""|disabled=""[^>]*aria-label="Redo"/);
  });
  it('offers the three views and hides edit actions off the stage tab', () => {
    expect(render(store())).toMatch(/aria-checked="true"[^>]*>Stage</);
    const out = render(store({ stage: { ...DEFAULT_STAGE_STATE, activeTab: 'ast' } }));
    expect(out).toMatch(/aria-checked="true"[^>]*>Code</); expect(out).not.toContain('>Sync<'); expect(out).not.toContain('aria-label="Undo"');
  });
  it('uses only token colours', () => {
    expect(render(store({ dirty: true }))).not.toMatch(/zinc-|indigo-|rose-|emerald-|amber-|#[0-9a-f]{6}/i);
  });
});
