import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

describe('retune-vscode standalone bundle & activation', () => {
  it('loads dist/extension.js without external npm dependencies and registers Sidebar & Stage Tab commands', () => {
    const extBundlePath = path.resolve(__dirname, '..', '..', 'dist', 'extension.js');
    expect(fs.existsSync(extBundlePath)).toBe(true);

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

    const customRequire = createRequire(__filename);
    const Module = customRequire('module');
    const origLoad = Module._load;
    Module._load = (request: string, parent: any, isMain: boolean) => {
      if (request === 'vscode') return mockVscode;
      return origLoad(request, parent, isMain);
    };

    try {
      const ext = customRequire(extBundlePath);
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
      };
      capturedSidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
      expect(mockWebviewView.webview.html).toContain('window.RETUNE_VIEW_MODE = "sidebar"');
      expect(mockWebviewView.webview.html).toContain('<div id="root"></div>');

      ext.deactivate();
    } finally {
      Module._load = origLoad;
    }
  });
});

