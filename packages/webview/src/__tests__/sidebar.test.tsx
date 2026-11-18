import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SidebarView } from '../components/sidebar/sidebar-view';
import type { StageStore } from '../state/use-stage';
import { DEFAULT_CONFIG, DEFAULT_STAGE_STATE, DEMO_META } from '../state/demo';

const noop = () => {};
const store = (over: Partial<StageStore> = {}): StageStore => ({
  hostKind: 'vscode', meta: DEMO_META, config: DEFAULT_CONFIG, stage: DEFAULT_STAGE_STATE,
  dirty: false, canUndo: false, canRedo: false, toast: null, targetLabel: 'buttonVariants', previewClass: '', baselinePreviewClass: '',
  setClasses: noop, undo: noop, redo: noop, discard: noop, sync: noop, selectVariant: noop, commitVariant: noop, setProp: noop,
  patchStage: noop, patchConfig: noop, selectElement: noop, openStage: noop, notify: noop, ...over,
});
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('SidebarView', () => {
  it('renders the sections in order with one disabled Sync while clean', () => {
    const out = html(<SidebarView store={store()} />);
    const order = ['Element', 'Content', 'Variants', 'Layout', 'Typography', 'Appearance', 'Classes', 'Workspace'].map((t) => out.indexOf(`>${t}<`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(out.match(/>Sync</g)?.length).toBe(1);
    expect(out).toMatch(/disabled=""[^>]*title="Sync to code \(Ctrl\+S\)"|title="Sync to code \(Ctrl\+S\)"[^>]*disabled=""/);
    expect(out).toContain('role="listbox"');
  });
  it('shows the dirty dot and hides the header when embedded', () => {
    expect(html(<SidebarView store={store({ dirty: true })} />)).toContain('aria-label="Unsynced changes"');
    const embedded = html(<SidebarView store={store({ dirty: true })} embedded />);
    expect(embedded).not.toContain('>Sync<'); expect(embedded).toContain('>Layout<');
  });
  it('shows the empty state without a component and omits Variants without cva', () => {
    const empty = html(<SidebarView store={store({ meta: null })} />);
    expect(empty).toContain('No component selected'); expect(empty).not.toContain('>Layout<');
    const plain = html(<SidebarView store={store({ meta: { ...DEMO_META, cva: { ...DEMO_META.cva, hasCva: false, variants: {} } } })} />);
    expect(plain).not.toContain('>Variants<');
  });
  it('names the file and the syntax error when the active file does not parse', () => {
    const problem = { fileName: 'Button.tsx', message: 'Expected corresponding JSX closing tag for <buttonP>. (41:4)' };
    const empty = html(<SidebarView store={store({ meta: null, problem })} />);
    expect(empty).toContain('Can&#x27;t read Button.tsx');
    expect(empty).toContain('Expected corresponding JSX closing tag');
    expect(empty).not.toContain('No component selected');
    const stale = html(<SidebarView store={store({ problem })} />);
    expect(stale).toContain('role="alert"');
    expect(stale).toContain('showing the last version that parsed');
    expect(html(<SidebarView store={store()} />)).not.toContain('role="alert"');
  });
  it('uses only token colours', () => {
    const out = html(<SidebarView store={store({ dirty: true })} />).replace(/placeholder="[^"]*"/g, '').replace(/style="[^"]*"/g, '').replace(/value="[^"]*"/g, '');
    expect(out).not.toMatch(/zinc-|indigo-|rose-|emerald-|amber-|#[0-9a-f]{6}/i);
  });

  it('populates Sidebar Content, Layout, Typography, and Appearance from selected element computedStyle', () => {
    const out = html(
      <SidebarView
        store={store({
          targetLabel: '<input>',
          stage: {
            ...DEFAULT_STAGE_STATE,
            targetElement: 'input',
            targetIndex: 0,
            harmonicsClass: 'search-input',
            baselineClass: 'search-input',
            baselineText: 'Search tasks...',
            propValues: { ...DEFAULT_STAGE_STATE.propValues, label: 'Search tasks...' },
            computedStyle: {
              px: '18px',
              py: '10px',
              w: '420px',
              text: '16px',
              fontWeight: '500',
              bgColor: '#fafbf7',
              textColor: '#203b30',
              border: '1px',
              borderColor: '#dce4d6',
              rounded: '10px',
            },
          },
        })}
      />
    );
    expect(out).toContain('value="Search tasks..."');
    expect(out).toContain('value="18"');
    expect(out).toContain('value="16"');
    expect(out).toContain('value="#fafbf7"');
    expect(out).toContain('value="#203b30"');
    expect(out).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>500</);
  });
});
