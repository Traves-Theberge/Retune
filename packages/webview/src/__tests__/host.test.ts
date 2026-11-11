import { describe, it, expect } from 'vitest';
import { createHost, type HostWindow } from '../lib/host';

function fakeWindow(withVscode: boolean) {
  const sent: unknown[] = []; const listeners = new Set<(e: { data: unknown }) => void>();
  const win: HostWindow = {
    vscode: withVscode ? { postMessage: (m) => { sent.push(m); } } : undefined,
    addEventListener: (_t, l) => { listeners.add(l); },
    removeEventListener: (_t, l) => { listeners.delete(l); },
  };
  return { win, sent, emit: (data: unknown) => listeners.forEach((l) => l({ data })), count: () => listeners.size };
}

describe('host bridge', () => {
  it('posts to VS Code and reports its kind', () => {
    const f = fakeWindow(true); const host = createHost(f.win);
    host.post({ type: 'READY' });
    expect(host.kind).toBe('vscode'); expect(f.sent).toEqual([{ type: 'READY' }]);
  });
  it('is a silent standalone host without the API', () => {
    const f = fakeWindow(false); const host = createHost(f.win);
    expect(host.kind).toBe('standalone'); expect(() => host.post({ type: 'READY' })).not.toThrow();
  });
  it('delivers only well-formed messages and unsubscribes', () => {
    const f = fakeWindow(true); const got: unknown[] = [];
    const off = createHost(f.win).subscribe((m) => got.push(m));
    f.emit(null); f.emit('x'); f.emit({ nope: 1 }); f.emit({ type: 'SYNC_COMPONENT', payload: null });
    expect(got).toEqual([{ type: 'SYNC_COMPONENT', payload: null }]);
    off(); expect(f.count()).toBe(0);
  });
});
