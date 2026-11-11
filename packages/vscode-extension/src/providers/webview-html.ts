import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { renderWebviewHtml } from './webview-html-template';

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
  const nonce = randomBytes(16).toString('base64');

  let baseHref: string | undefined;
  let scriptSrc: string | undefined;
  let styleHref: string | undefined;
  let devOrigin: string | undefined;

  if (fs.existsSync(assetsDir)) {
    const distUri = webview.asWebviewUri(vscode.Uri.file(distDir));
    baseHref = `${distUri}/`;

    const files = fs.readdirSync(assetsDir);
    const jsFile =
      files.find((f) => f.startsWith('index-') && f.endsWith('.js')) ||
      files.find((f) => f.endsWith('.js'));
    const cssFile =
      files.find((f) => f.startsWith('index-') && f.endsWith('.css')) ||
      files.find((f) => f.endsWith('.css'));

    if (jsFile) {
      scriptSrc = webview.asWebviewUri(vscode.Uri.file(path.join(assetsDir, jsFile))).toString();
    }
    if (cssFile) {
      styleHref = webview.asWebviewUri(vscode.Uri.file(path.join(assetsDir, cssFile))).toString();
    }
  }

  if (!scriptSrc) {
    devOrigin = `http://localhost:${sandboxPort}`;
    scriptSrc = `${devOrigin}/src/main.tsx`;
  }

  return renderWebviewHtml({
    cspSource: webview.cspSource,
    nonce,
    viewMode,
    scriptSrc,
    styleHref,
    baseHref,
    devOrigin,
  });
}
