import { describe, it, expect } from 'vitest';
import type { HostMessage } from '@retune/core';
import { createOrcaHost, type OrcaFrameApi } from '../lib/host-orca';

function createMockStorage() {
  const store = new Map<string, unknown>();
  const listeners = new Set<(ev: { key: string; newValue?: unknown }) => void>();
  return {
    async get<T>(key: string) {
      return store.get(key) as T | undefined;
    },
    async set(key: string, value: unknown) {
      store.set(key, value);
      for (const l of listeners) l({ key, newValue: value });
    },
    async delete(key: string) {
      store.delete(key);
    },
    onDidChange(handler: (ev: { key: string; newValue?: unknown }) => void) {
      listeners.add(handler);
      return { dispose: () => listeners.delete(handler) };
    },
  };
}

describe('Orca host adapter', () => {
  const INITIAL_SOURCE = `import { cva } from 'class-variance-authority';
const cardVariants = cva('rounded-lg p-4', {
  variants: { tone: { neutral: 'bg-zinc-900', accent: 'bg-indigo-600' } },
  defaultVariants: { tone: 'neutral' },
});
export function FeatureCard() {
  return <div className="p-4"><span className="text-sm">Hi</span></div>;
}`;

  it('analyses the Orca custom editor document in-frame and commits minimal edits', async () => {
    let docText = INITIAL_SOURCE;
    let flushedCount = 0;
    const storage = createMockStorage();

    const orcaEditor: OrcaFrameApi = {
      document: {
        get: async () => ({ version: 1, readOnly: false, content: docText }),
        onDidChange: () => ({ dispose: () => {} }),
        applyEdit: async () => null,
        session: async () => ({
          get value() {
            return docText;
          },
          readOnly: false,
          change(next: string) {
            docText = next;
          },
          async flush() {
            flushedCount += 1;
          },
          onReplace: () => ({ dispose: () => {} }),
          dispose: () => {},
        }),
      },
      storage,
      settings: {
        get: async () => ({ 'stage.showGrid': false, 'daemon.port': 49999 }),
        set: async () => {},
        onDidChange: () => ({ dispose: () => {} }),
      },
    };

    const host = createOrcaHost(orcaEditor);
    const messages: HostMessage[] = [];
    const unsub = host.subscribe((m) => messages.push(m));

    await new Promise((r) => setTimeout(r, 20));
    const compMsg = messages.find((m) => m.type === 'SYNC_COMPONENT') as any;
    expect(compMsg?.payload?.componentName).toBe('FeatureCard');
    expect(compMsg?.payload?.cva?.hasCva).toBe(true);
    expect(compMsg?.payload?.previewTree?.children[0]?.tag).toBe('span');

    const cfgMsg = messages.find((m) => m.type === 'SYNC_CONFIG') as any;
    expect(cfgMsg?.payload?.showGrid).toBe(false);
    expect(cfgMsg?.payload?.daemonPort).toBe(49999);

    host.post({ type: 'MUTATE_CLASSES', payload: { className: 'rounded-xl p-6' } });
    await new Promise((r) => setTimeout(r, 20));
    expect(docText).toContain("cva('rounded-xl p-6'");
    expect(flushedCount).toBe(1);

    host.post({
      type: 'MUTATE_CVA_VARIANT',
      payload: { variantGroup: 'tone', variantKey: 'brand', className: 'bg-sky-600 text-white' },
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(docText).toContain('brand: "bg-sky-600 text-white"');

    // Verify snapshot was published to Orca storage for the right-sidebar panel
    const panelHost = createOrcaHost({ storage });
    const panelMessages: HostMessage[] = [];
    const unsubPanel = panelHost.subscribe((m) => panelMessages.push(m));
    await new Promise((r) => setTimeout(r, 20));
    const panelComp = panelMessages.find((m) => m.type === 'SYNC_COMPONENT') as any;
    expect(panelComp?.payload?.componentName).toBe('FeatureCard');

    // Inspector intent modifies state in the editor frame
    panelHost.post({ type: 'SELECT_ELEMENT', payload: { name: 'span', index: 0 } });
    await new Promise((r) => setTimeout(r, 20));
    const latestStage = messages.filter((m) => m.type === 'SYNC_STAGE_STATE').pop() as any;
    expect(latestStage?.payload?.targetElement).toBe('span');
    expect(latestStage?.payload?.harmonicsClass).toBe('text-sm');

    unsub();
    unsubPanel();
  });
});
