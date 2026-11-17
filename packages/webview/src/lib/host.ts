import type { HostMessage, WebviewMessage } from '@retune/core';
import { createOrcaHost, type OrcaFrameApi } from './host-orca';

export interface HostBridge {
  readonly kind: 'vscode' | 'standalone';
  post(message: WebviewMessage): void;
  subscribe(listener: (message: HostMessage) => void): () => void;
}

export interface HostWindow {
  vscode?: { postMessage(message: unknown): void };
  orca?: OrcaFrameApi;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

function isHostMessage(data: unknown): data is HostMessage {
  return typeof data === 'object' && data !== null && typeof (data as { type?: unknown }).type === 'string';
}

export function createHost(win: HostWindow): HostBridge {
  if (win.orca) {
    return createOrcaHost(win.orca);
  }
  const vscode = win.vscode;
  return {
    kind: vscode ? 'vscode' : 'standalone',
    post(message) {
      vscode?.postMessage(message);
    },
    subscribe(listener) {
      const handler = (event: { data: unknown }) => {
        if (isHostMessage(event.data)) listener(event.data);
      };
      win.addEventListener('message', handler);
      return () => win.removeEventListener('message', handler);
    },
  };
}

let memoised: HostBridge | undefined;

export function getHost(): HostBridge {
  memoised ??= createHost(window as unknown as HostWindow);
  return memoised;
}
