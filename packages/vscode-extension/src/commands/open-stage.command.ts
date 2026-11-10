import * as vscode from 'vscode';
import { StagePanel } from '../providers/stage-panel';

async function resolveTargetDocument(uri?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  if (uri && uri.scheme === 'file') {
    try {
      return await vscode.workspace.openTextDocument(uri);
    } catch {
      // Fallback to active editor below
    }
  }
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    return editor.document;
  }
  return undefined;
}

function extractSymbolAtCursor(editor?: vscode.TextEditor): string | undefined {
  if (!editor) return undefined;
  const doc = editor.document;
  const selection = editor.selection;
  if (!selection.isEmpty) {
    const selectedText = doc.getText(selection).trim();
    const jsxMatch = /^<?([A-Za-z_][A-Za-z0-9_.]*)/.exec(selectedText);
    if (jsxMatch) return jsxMatch[1];
  }
  const wordRange = doc.getWordRangeAtPosition(selection.active, /[A-Za-z_][A-Za-z0-9_.]*/);
  if (wordRange) {
    return doc.getText(wordRange);
  }
  return undefined;
}

export function registerStageCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
  const openStage = vscode.commands.registerCommand('retune.openStage', async (uri?: vscode.Uri) => {
    const doc = await resolveTargetDocument(uri);
    const targetElement = extractSymbolAtCursor(vscode.window.activeTextEditor);
    StagePanel.render(context.extensionUri, doc, { targetElement });
  });

  const tuneComponentAtCursor = vscode.commands.registerCommand(
    'retune.tuneComponentAtCursor',
    async (uri?: vscode.Uri, explicitSymbol?: string) => {
      const doc = await resolveTargetDocument(uri);
      const targetElement =
        typeof explicitSymbol === 'string' && explicitSymbol
          ? explicitSymbol
          : extractSymbolAtCursor(vscode.window.activeTextEditor);
      StagePanel.render(context.extensionUri, doc, {
        tab: 'stage',
        targetElement,
      });
    }
  );

  const openStageTab = vscode.commands.registerCommand(
    'retune.openStageTab',
    async (uri?: vscode.Uri, explicitSymbol?: string) => {
      const doc = await resolveTargetDocument(uri);
      const targetElement =
        typeof explicitSymbol === 'string' && explicitSymbol
          ? explicitSymbol
          : extractSymbolAtCursor(vscode.window.activeTextEditor);
      StagePanel.render(context.extensionUri, doc, {
        openMode: 'tab',
        tab: 'stage',
        targetElement,
      });
    }
  );

  const openStageSplit = vscode.commands.registerCommand(
    'retune.openStageSplit',
    async (uri?: vscode.Uri, explicitSymbol?: string) => {
      const doc = await resolveTargetDocument(uri);
      const targetElement =
        typeof explicitSymbol === 'string' && explicitSymbol
          ? explicitSymbol
          : extractSymbolAtCursor(vscode.window.activeTextEditor);
      StagePanel.render(context.extensionUri, doc, {
        openMode: 'split',
        tab: 'stage',
        targetElement,
      });
    }
  );

  const inspectAstTab = vscode.commands.registerCommand(
    'retune.inspectAstTab',
    async (uri?: vscode.Uri, explicitSymbol?: string) => {
      const doc = await resolveTargetDocument(uri);
      const targetElement =
        typeof explicitSymbol === 'string' && explicitSymbol
          ? explicitSymbol
          : extractSymbolAtCursor(vscode.window.activeTextEditor);
      StagePanel.render(context.extensionUri, doc, {
        tab: 'ast',
        targetElement,
      });
    }
  );

  const openScalarApi = vscode.commands.registerCommand(
    'retune.openScalarApi',
    async (uri?: vscode.Uri) => {
      const doc = await resolveTargetDocument(uri);
      StagePanel.render(context.extensionUri, doc, { tab: 'api' });
    }
  );

  return [
    openStage,
    tuneComponentAtCursor,
    openStageTab,
    openStageSplit,
    inspectAstTab,
    openScalarApi,
  ];
}
