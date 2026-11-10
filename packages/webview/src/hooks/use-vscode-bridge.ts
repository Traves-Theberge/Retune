import { useCallback } from 'react';
import { WebviewMessage } from '@retune/core';

declare const vscode:
  | {
      postMessage: (message: WebviewMessage) => void;
    }
  | undefined;

export function useVscodeBridge() {
  const postMessage = useCallback((message: WebviewMessage) => {
    if (typeof vscode !== 'undefined' && vscode?.postMessage) {
      vscode.postMessage(message);
    }
  }, []);

  return { postMessage };
}

