import * as vscode from 'vscode';
import { StagePanel } from './providers/stage-panel';
import { RetuneCodeLensProvider } from './providers/codelens.provider';
import { RetuneSidebarProvider } from './providers/sidebar.provider';
import { registerStageCommands } from './commands/open-stage.command';
import { getRetuneConfig } from './config/extension-config';
import { createRetuneDaemon } from '@retune/engine';

let daemonInstance: ReturnType<typeof createRetuneDaemon> | undefined;

export function activate(context: vscode.ExtensionContext) {
  const config = getRetuneConfig();

  // 1. Register Sidebar Webview Provider FIRST so the Sidebar never hangs on load
  const sidebarProvider = new RetuneSidebarProvider(context.extensionUri);
  const sidebarDisposable = vscode.window.registerWebviewViewProvider(
    RetuneSidebarProvider.viewType,
    sidebarProvider,
    { webviewOptions: { retainContextWhenHidden: true } }
  );

  // 2. Register Editor Tab & Split Stage Commands + CodeLens Provider
  const stageCommands = registerStageCommands(context);
  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    [
      { language: 'typescriptreact', scheme: 'file' },
      { language: 'javascriptreact', scheme: 'file' },
    ],
    new RetuneCodeLensProvider()
  );

  // 3. Boot local Retune Daemon for Scalar & AST endpoints (non-blocking)
  try {
    daemonInstance = createRetuneDaemon(config.daemonPort);
  } catch (e) {
    console.warn('Retune daemon failed to bind port (may already be running):', e);
  }

  // 4. Sync initial active .tsx/.jsx editor if open
  if (
    vscode.window.activeTextEditor &&
    (vscode.window.activeTextEditor.document.fileName.endsWith('.tsx') ||
      vscode.window.activeTextEditor.document.fileName.endsWith('.jsx'))
  ) {
    StagePanel.setActiveDocument(vscode.window.activeTextEditor.document);
  }

  // 5. Listen to Active Editor Changes & Document Saves
  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
    const currentConfig = getRetuneConfig();
    if (!currentConfig.autoSyncActiveEditor) return;
    if (
      editor &&
      (editor.document.fileName.endsWith('.tsx') || editor.document.fileName.endsWith('.jsx'))
    ) {
      StagePanel.setActiveDocument(editor.document);
    }
  });

  const docChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    if (
      vscode.window.activeTextEditor &&
      event.document === vscode.window.activeTextEditor.document &&
      (event.document.fileName.endsWith('.tsx') || event.document.fileName.endsWith('.jsx'))
    ) {
      StagePanel.setActiveDocument(event.document);
    }
  });

  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('retune')) {
      StagePanel.currentPanel?.syncAll();
      sidebarProvider.syncSidebar();
    }
  });

  context.subscriptions.push(
    sidebarDisposable,
    sidebarProvider,
    codeLensProvider,
    editorChangeDisposable,
    docChangeDisposable,
    configChangeDisposable,
    ...stageCommands
  );
}

export function deactivate() {
  if (daemonInstance) {
    daemonInstance.close();
  }
}
