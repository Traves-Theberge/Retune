import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function getWebviewDistDir(extensionUri: vscode.Uri): string {
  const bundledDist = path.join(extensionUri.fsPath, 'webview-dist');
  if (fs.existsSync(path.join(bundledDist, 'assets'))) {
    return bundledDist;
  }
  return path.resolve(extensionUri.fsPath, '..', 'webview', 'dist');
}

export function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  viewMode: 'editor-tab' | 'sidebar',
  sandboxPort = 5173
): string {
  const distDir = getWebviewDistDir(extensionUri);
  const assetsDir = path.join(distDir, 'assets');

  let baseTag = '';
  let scriptTag = `<script type="module" src="http://localhost:${sandboxPort}/src/main.tsx"></script>`;
  let styleTag = '';

  if (fs.existsSync(assetsDir)) {
    const distUri = webview.asWebviewUri(vscode.Uri.file(distDir));
    baseTag = `<base href="${distUri}/" />`;

    const files = fs.readdirSync(assetsDir);
    const jsFile =
      files.find((f) => f.startsWith('index-') && f.endsWith('.js')) ||
      files.find((f) => f.endsWith('.js'));
    const cssFile =
      files.find((f) => f.startsWith('index-') && f.endsWith('.css')) ||
      files.find((f) => f.endsWith('.css'));

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
      ${baseTag}
      <title>Retune</title>
      ${styleTag}
      <script src="https://cdn.tailwindcss.com" async defer></script>
      <script>
        window.RETUNE_VIEW_MODE = "${viewMode}";
        const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;
        window.vscode = vscode;
      </script>
    </head>
    <body class="bg-zinc-950 text-zinc-100">
      <div id="root"></div>
      ${scriptTag}
    </body>
  </html>`;
}
