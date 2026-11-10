import * as vscode from 'vscode';
import { StagePanel } from '../providers/stage-panel';

function isReactDocument(doc?: vscode.TextDocument): doc is vscode.TextDocument {
  if (!doc) return false;
  return doc.fileName.endsWith('.tsx') || doc.fileName.endsWith('.jsx');
}

export function registerStageCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
  const openStage = vscode.commands.registerCommand('retune.openStage', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && isReactDocument(editor.document)) {
      StagePanel.render(context.extensionUri, editor.document);
    } else {
      StagePanel.render(context.extensionUri, undefined);
    }
  });

  const openStageTab = vscode.commands.registerCommand('retune.openStageTab', () => {
    const editor = vscode.window.activeTextEditor;
    const doc = editor && isReactDocument(editor.document) ? editor.document : undefined;
    StagePanel.render(context.extensionUri, doc, { openMode: 'tab', tab: 'stage' });
  });

  const openStageSplit = vscode.commands.registerCommand('retune.openStageSplit', () => {
    const editor = vscode.window.activeTextEditor;
    const doc = editor && isReactDocument(editor.document) ? editor.document : undefined;
    StagePanel.render(context.extensionUri, doc, { openMode: 'split', tab: 'stage' });
  });

  const openScalarApi = vscode.commands.registerCommand('retune.openScalarApi', () => {
    const editor = vscode.window.activeTextEditor;
    const doc = editor && isReactDocument(editor.document) ? editor.document : undefined;
    StagePanel.render(context.extensionUri, doc, { tab: 'api' });
  });

  return [openStage, openStageTab, openStageSplit, openScalarApi];
}
