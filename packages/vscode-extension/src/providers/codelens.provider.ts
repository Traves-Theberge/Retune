import * as vscode from 'vscode';

export class RetuneCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (!document.fileName.endsWith('.tsx') && !document.fileName.endsWith('.jsx')) {
      return [];
    }

    const text = document.getText();
    const lenses: vscode.CodeLens[] = [];
    const addedLines = new Set<number>();

    const addLensAtIndex = (index: number, title: string, command: string, args?: unknown[]) => {
      const pos = document.positionAt(index);
      if (addedLines.has(pos.line) && command === 'retune.openStage') {
        return;
      }
      addedLines.add(pos.line);
      const range = new vscode.Range(pos, pos);
      lenses.push(
        new vscode.CodeLens(range, {
          title,
          command,
          arguments: args,
        })
      );
    };

    const cvaMatch = /cva\s*\(/.exec(text);
    if (cvaMatch && cvaMatch.index !== undefined) {
      addLensAtIndex(
        cvaMatch.index,
        '$(symbol-color) Retune: Open Visual Stage',
        'retune.openStage',
        [document.uri]
      );
    }

    const componentRegex =
      /(?:export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)|export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=)/g;
    let match: RegExpExecArray | null;
    while ((match = componentRegex.exec(text)) !== null) {
      const compName = match[1] || match[2];
      const pos = document.positionAt(match.index);
      const range = new vscode.Range(pos, pos);
      lenses.push(
        new vscode.CodeLens(range, {
          title: `$(wand) Retune: Tune <${compName} /> in Stage`,
          command: 'retune.tuneComponentAtCursor',
          arguments: [document.uri, compName],
        }),
        new vscode.CodeLens(range, {
          title: '$(symbol-structure) Inspect AST & Props',
          command: 'retune.inspectAstTab',
          arguments: [document.uri, compName],
        })
      );
    }

    return lenses;
  }
}


