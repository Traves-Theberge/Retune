import * as vscode from 'vscode';

export class RetuneCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (!document.fileName.endsWith('.tsx')) {
      return [];
    }

    const text = document.getText();
    const lenses: vscode.CodeLens[] = [];
    const cvaMatch = /cva\s*\(/.exec(text);

    if (cvaMatch && cvaMatch.index !== undefined) {
      const pos = document.positionAt(cvaMatch.index);
      const range = new vscode.Range(pos, pos);
      lenses.push(
        new vscode.CodeLens(range, {
          title: '$(symbol-color) Retune: Open Visual Stage',
          command: 'retune.openStage',
        })
      );
    }

    return lenses;
  }
}

