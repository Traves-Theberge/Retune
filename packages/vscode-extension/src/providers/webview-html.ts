import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  viewMode: 'editor-tab' | 'sidebar',
  sandboxPort = 5173
): string {
  // Resolve monorepo webview dist if built, otherwise fall back to local Vite dev server
  const monorepoWebviewDist = path.resolve(extensionUri.fsPath, '..', 'webview', 'dist');
  const assetsDir = path.join(monorepoWebviewDist, 'assets');

  let scriptTag = `<script type="module" src="http://localhost:${sandboxPort}/src/main.tsx"></script>`;
  let styleTag = '';

  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const jsFile = files.find((f) => f.endsWith('.js'));
    const cssFile = files.find((f) => f.endsWith('.css'));

    if (jsFile) {
      const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetsDir, jsFile)));
      scriptTag = `<script type="module" src="${jsUri}"></script>`;
    }
    if (cssFile) {
      const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetsDir, cssFile)));
      styleTag = `<link rel="stylesheet" href="${cssUri}" />`;
    }
  }

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Retune</title>
      <script src="https://cdn.tailwindcss.com"></script>
      ${styleTag}
      <script>
        window.RETUNE_VIEW_MODE = "${viewMode}";
        const vscode = acquireVsCodeApi();
      </script>
    </head>
    <body class="bg-zinc-950 text-zinc-100">
      <div id="root"></div>
      ${scriptTag}
    </body>
  </html>`;
}

