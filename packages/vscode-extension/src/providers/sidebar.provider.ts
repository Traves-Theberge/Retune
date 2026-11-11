import * as vscode from 'vscode';
import * as path from 'node:path';
import { WebviewMessage } from '@retune/core';
import { getRetuneConfig } from '../config/extension-config';
import { buildWebviewHtml, getWebviewDistDir } from './webview-html';
import { StagePanel } from './stage-panel';

export class RetuneSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'retune.sidebarView';
  private _sink?: vscode.Disposable;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri,
        vscode.Uri.file(getWebviewDistDir(this._extensionUri)),
        vscode.Uri.file(path.resolve(this._extensionUri.fsPath, '..', 'webview', 'dist')),
      ],
    };

    const config = getRetuneConfig();
    webviewView.webview.html = buildWebviewHtml(
      webviewView.webview,
      this._extensionUri,
      'sidebar',
      config.sandboxPort
    );

    this._sink?.dispose();
    this._sink = StagePanel.registerSink('sidebar', (msg) => {
      webviewView.webview.postMessage(msg);
    });

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) =>
      StagePanel.handleSharedMessage(message, this._extensionUri, 'sidebar')
    );
  }

  public dispose() {
    this._sink?.dispose();
    this._sink = undefined;
  }
}
