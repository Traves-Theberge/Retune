import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PANELS, availablePanels, EditPanel } from '../components/stage/edit-panels';
import { SelectionToolbar } from '../components/stage/selection-toolbar';
import { buildMenu, ContextMenu } from '../components/stage/context-menu';
import { Stage } from '../components/stage/stage';
import type { StageStore } from '../state/use-stage';
import { DEFAULT_CONFIG, DEFAULT_STAGE_STATE, DEMO_META } from '../state/demo';

const noop = () => {};
const store = (over: Partial<StageStore> = {}): StageStore => ({
  hostKind: 'standalone', meta: DEMO_META, config: DEFAULT_CONFIG, stage: DEFAULT_STAGE_STATE,
  dirty: false, canUndo: false, canRedo: false, toast: null, targetLabel: 'buttonVariants',
  previewClass: 'px-4 current', baselinePreviewClass: 'px-2 baseline',
  setClasses: noop, undo: noop, redo: noop, discard: noop, sync: noop, selectVariant: noop, commitVariant: noop, setProp: noop,
  patchStage: noop, patchConfig: noop, selectElement: noop, openStage: noop, notify: noop, ...over,
});
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('stage pieces', () => {
  it('offers the variants panel only when there are variants', () => {
    expect(PANELS.map((p) => p.label)).toEqual(['Text', 'Fill', 'Type', 'Space', 'Shape', 'Variants', 'Classes']);
    expect(availablePanels(false).map((p) => p.kind)).not.toContain('variants');
  });
  it('renders a labelled toolbar without a sync button', () => {
    const out = html(<SelectionToolbar panels={availablePanels(true)} style={{}} onOpen={noop} />);
    expect(out).toContain('role="toolbar"'); expect(out).toContain('aria-label="Edit element"');
    expect(out).toContain('>Variants<'); expect(out).not.toMatch(/>Sync/);
  });
  it('renders each panel body', () => {
    expect(html(<EditPanel kind="spacing" store={store()} onDone={noop} />)).toContain('pad X');
    expect(html(<EditPanel kind="classes" store={store()} onDone={noop} />)).toContain('aria-label="Remove gap-2"');
    expect(html(<EditPanel kind="variants" store={store({ meta: { ...DEMO_META, cva: { ...DEMO_META.cva, hasCva: false, variants: {} } } })} onDone={noop} />))
      .toContain('No cva() variants in this component.');
  });
  it('builds the menu in order with correct enabled state', () => {
    const sync = vi.fn();
    const args = { panels: availablePanels(true), disabled: false, hasVariants: true, jsx: '<button/>', openPanel: noop };
    const clean = buildMenu({ ...args, store: store({ sync }) });
    expect(clean.map((e) => e.id)).toEqual([
      'panel:text', 'panel:fill', 'panel:type', 'panel:spacing', 'panel:shape', 'panel:variants', 'panel:classes',
      'toggle-disabled', 'sync', 'undo', 'redo', 'copy-class', 'copy-jsx', 'reset-variants', 'discard', 'inspect',
    ]);
    expect(clean.find((e) => e.id === 'sync')?.disabled).toBe(true);
    expect(clean.find((e) => e.id === 'discard')).toMatchObject({ danger: true, disabled: true });
    const dirty = buildMenu({ ...args, hasVariants: false, store: store({ sync, dirty: true, canUndo: true }) });
    expect(dirty.map((e) => e.id)).not.toContain('reset-variants');
    dirty.find((e) => e.id === 'sync')!.run(); expect(sync).toHaveBeenCalledTimes(1);
    expect(dirty.find((e) => e.id === 'undo')?.disabled).toBeFalsy();
    expect(buildMenu({ ...args, disabled: true, store: store() }).find((e) => e.id === 'toggle-disabled')?.label).toBe('Enable');
  });
  it('renders an accessible menu', () => {
    const out = html(<ContextMenu title="<button>" point={{ x: 10, y: 10 }} onClose={noop}
      entries={[{ id: 'a', label: 'Alpha', run: noop }, { id: 'b', label: 'Beta', disabled: true, hint: 'Ctrl+S', run: noop }]} />);
    expect(out).toContain('role="menu"'); expect(out.match(/role="menuitem"/g)?.length).toBe(2);
    expect(out).toMatch(/aria-disabled="true"[^>]*>(<[^>]+>)*Beta/); expect(out).toContain('Ctrl+S');
  });
  it('renders the preview with current or baseline classes and the caption', () => {
    const live = html(<Stage store={store()} tone="dark" comparing={false} onToggleTone={noop} />);
    expect(live).toContain('px-4 current'); expect(live).toContain('Approximate preview — classes only');
    expect(live).not.toMatch(/>Sync/);
    expect(live).toMatch(/role="radiogroup" aria-label="Viewport"/);
    expect(live).toMatch(/aria-checked="true"[^>]*title="Fluid width"/);
    expect(live).toContain('aria-label="Canvas tone"');
    expect(html(<Stage store={store()} tone="light" comparing onToggleTone={noop} />)).toContain('px-2 baseline');
    expect(html(<Stage store={store({ stage: { ...DEFAULT_STAGE_STATE, targetElement: 'span' } })} tone="dark" comparing={false} onToggleTone={noop} />)).toMatch(/<span[^>]*px-4 current/);
  });

  it('renders nested previewTree hierarchies, Variant Matrix view, and pseudo-state controls', () => {
    const treeOut = html(
      <Stage
        store={store({
          meta: {
            ...DEMO_META,
            previewTree: {
              tag: 'div',
              elementIndex: 0,
              className: 'card-wrap',
              children: [{ tag: 'span', elementIndex: 0, className: 'badge', text: 'New', children: [] }],
            },
          },
        })}
        tone="dark"
        comparing={false}
        onToggleTone={noop}
      />
    );
    expect(treeOut).toContain('px-4 current');
    expect(treeOut).toContain('>New<');
    expect(treeOut).toContain('aria-label="State"');
    expect(treeOut).toContain('aria-label="Variant Matrix"');

    const matrixOut = html(
      <Stage
        store={store({ stage: { ...DEFAULT_STAGE_STATE, matrixMode: true } })}
        tone="dark"
        comparing={false}
        onToggleTone={noop}
      />
    );
    expect(matrixOut).toContain('Variant Matrix (15)');
  });

  it('renders SVG illustrations, void form controls, and scoped workspaceCss without raw tag placeholders', () => {
    const pageOut = html(
      <Stage
        store={store({
          stage: { ...DEFAULT_STAGE_STATE, harmonicsClass: '', baselineClass: '' },
          meta: {
            ...DEMO_META,
            componentName: 'LegalPage',
            cva: { hasCva: false, variants: {}, defaultVariants: {}, baseClasses: '' },
            workspaceCss: '.retune-preview-scope .legal-card { padding: 24px; }',
            previewTree: {
              tag: 'main',
              elementIndex: 0,
              className: 'legal-page',
              children: [
                {
                  tag: 'svg',
                  elementIndex: 1,
                  className: '',
                  attrs: { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' },
                  children: [{ tag: 'path', elementIndex: 2, className: '', attrs: { d: 'M5 12h14' }, children: [] }],
                },
                {
                  tag: 'input',
                  elementIndex: 3,
                  className: 'field',
                  attrs: { type: 'email', placeholder: 'you@example.com' },
                  children: [],
                },
                {
                  tag: 'span',
                  elementIndex: 4,
                  className: 'dot',
                  children: [],
                },
              ],
            },
          },
        })}
        tone="dark"
        comparing={false}
        onToggleTone={noop}
      />
    );
    expect(pageOut).toContain('retune-preview-scope');
    expect(pageOut).toContain('<style>.retune-preview-scope .legal-card { padding: 24px; }</style>');
    expect(pageOut).toContain('<svg viewBox="0 0 24 24"');
    expect(pageOut).toContain('<path d="M5 12h14"');
    expect(pageOut).toContain('<input type="email" placeholder="you@example.com"');
    expect(pageOut).not.toContain('>path<');
    expect(pageOut).not.toContain('>span<');
  });
});
