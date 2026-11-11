import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const customRequire = createRequire(__filename);
const Module = customRequire('module');
const extBundlePath = path.resolve(__dirname, '..', '..', 'dist', 'extension.js');

function loadExtension() {
  const registeredViews: string[] = [];
  const registeredCommands: string[] = [];
  let capturedSidebarProvider: any = null;

  const mockVscode = {
    Uri: {
      file: (p: string) => ({ fsPath: p, toString: () => `file://${p}` }),
    },
    Disposable: class {
      constructor(private fn?: () => void) {}
      dispose() {
        if (this.fn) this.fn();
      }
    },
    ViewColumn: {
      Active: 1,
      Beside: 2,
    },
    ConfigurationTarget: {
      Global: 1,
    },
    Range: class {
      constructor(public start: any, public end: any) {}
    },
    CodeLens: class {
      constructor(public range: any, public command: any) {}
    },
    WorkspaceEdit: class {
      replace() {}
    },
    workspace: {
      getConfiguration: () => ({
        get: (_k: string, def: any) => def,
        update: async () => {},
      }),
      onDidChangeTextDocument: () => ({ dispose: () => {} }),
      onDidChangeConfiguration: () => ({ dispose: () => {} }),
    },
    window: {
      activeTextEditor: undefined,
      visibleTextEditors: [],
      registerWebviewViewProvider: (viewType: string, provider: any) => {
        registeredViews.push(viewType);
        capturedSidebarProvider = provider;
        return { dispose: () => {} };
      },
      onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
      createWebviewPanel: () => ({
        webview: {
          html: '',
          asWebviewUri: (u: any) => u.fsPath,
          onDidReceiveMessage: () => ({ dispose: () => {} }),
          postMessage: async () => true,
        },
        onDidDispose: () => ({ dispose: () => {} }),
        reveal: () => {},
        dispose: () => {},
      }),
    },
    commands: {
      registerCommand: (cmd: string) => {
        registeredCommands.push(cmd);
        return { dispose: () => {} };
      },
      executeCommand: async () => {},
    },
    languages: {
      registerCodeLensProvider: () => ({ dispose: () => {} }),
    },
  };

  // Load a fresh bundle so the mock 'vscode' binding and StagePanel statics belong to this call.
  delete customRequire.cache[extBundlePath];
  const origLoad = Module._load;
  Module._load = (request: string, parent: any, isMain: boolean) => {
    if (request === 'vscode') return mockVscode;
    return origLoad(request, parent, isMain);
  };
  try {
    const ext = customRequire(extBundlePath);
    return {
      ext,
      mockVscode,
      registeredViews,
      registeredCommands,
      getSidebarProvider: () => capturedSidebarProvider,
    };
  } finally {
    Module._load = origLoad;
  }
}

describe('retune-vscode standalone bundle & activation', () => {
  it('loads dist/extension.js without external npm dependencies and registers Sidebar & Stage Tab commands', () => {
    expect(fs.existsSync(extBundlePath)).toBe(true);

    const { ext, mockVscode, registeredViews, registeredCommands, getSidebarProvider } =
      loadExtension();

    const subscriptions: any[] = [];
    ext.activate({
      extensionUri: mockVscode.Uri.file(path.resolve(__dirname, '..', '..')),
      subscriptions,
    });

    expect(registeredViews).toContain('retune.sidebarView');
    expect(registeredCommands).toEqual(
      expect.arrayContaining([
        'retune.openStage',
        'retune.tuneComponentAtCursor',
        'retune.openStageTab',
        'retune.openStageSplit',
        'retune.inspectAstTab',
        'retune.openScalarApi',
      ])
    );

    // Verify Sidebar WebviewView resolves HTML cleanly
    const mockWebviewView = {
      webview: {
        options: {},
        html: '',
        asWebviewUri: (u: any) => u.fsPath,
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        postMessage: async () => true,
      },
      onDidDispose: () => ({ dispose: () => {} }),
    };
    getSidebarProvider().resolveWebviewView(mockWebviewView, {}, {});
    expect(mockWebviewView.webview.html).toContain('window.RETUNE_VIEW_MODE = "sidebar"');
    expect(mockWebviewView.webview.html).toContain('<div id="root"></div>');

    ext.deactivate();
  });

  it('syncs null component, does not echo state to the sender, and reports mutation failures', async () => {
    const { ext, mockVscode, getSidebarProvider } = loadExtension();
    ext.activate({ extensionUri: mockVscode.Uri.file(path.resolve(__dirname, '..', '..')), subscriptions: [] });
    const posted: any[] = [];
    let receive: (m: any) => unknown = () => {};
    const view = { webview: {
      options: {}, html: '', cspSource: 'vscode-resource:', asWebviewUri: (u: any) => u.fsPath,
      onDidReceiveMessage: (fn: any) => { receive = fn; return { dispose() {} }; },
      postMessage: async (m: any) => { posted.push(m); return true; },
    }, onDidDispose: () => ({ dispose() {} }) };
    getSidebarProvider().resolveWebviewView(view, {}, {});
    await receive({ type: 'READY' });
    expect(posted.find((m) => m.type === 'SYNC_COMPONENT')).toEqual({ type: 'SYNC_COMPONENT', payload: null });
    expect(posted.find((m) => m.type === 'SYNC_STAGE_STATE').payload).toHaveProperty('baselineClass');
    posted.length = 0;
    await receive({ type: 'UPDATE_STAGE_STATE', payload: { showGrid: false } });
    expect(posted.filter((m) => m.type === 'SYNC_STAGE_STATE')).toEqual([]);
    await receive({ type: 'MUTATE_CLASSES', payload: { className: 'p-2' } });
    expect(posted.find((m) => m.type === 'MUTATION_RESULT').payload).toEqual({ ok: false, kind: 'classes', message: 'No active component file' });
    ext.deactivate();
  });

  it('isolates a throwing sink so the sender handler still resolves', async () => {
    const { ext, mockVscode, getSidebarProvider } = loadExtension();
    ext.activate({ extensionUri: mockVscode.Uri.file(path.resolve(__dirname, '..', '..')), subscriptions: [] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let receive: (m: any) => unknown = () => {};
    const view = { webview: {
      options: {}, html: '', cspSource: 'vscode-resource:', asWebviewUri: (u: any) => u.fsPath,
      onDidReceiveMessage: (fn: any) => { receive = fn; return { dispose() {} }; },
      postMessage: () => { throw new Error('webview gone'); },
    }, onDidDispose: () => ({ dispose() {} }) };
    getSidebarProvider().resolveWebviewView(view, {}, {});
    await expect(receive({ type: 'READY' })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    ext.deactivate();
  });
});
