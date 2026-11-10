import * as vscode from 'vscode';
import * as path from 'node:path';
import { HostMessage, WebviewMessage } from '@retune/core';
import { getRetuneConfig } from '../config/extension-config';
import { buildWebviewHtml, getWebviewDistDir } from './webview-html';
import { StagePanel } from './stage-panel';

export class RetuneSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'retune.sidebarView';
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._disposables.push(
      StagePanel.onDidStateChange((state, meta) => {
        if (!this._view) return;
        if (meta) {
          this._view.webview.postMessage({
            type: 'SYNC_COMPONENT',
            payload: meta,
          } satisfies HostMessage);
        }
        this._view.webview.postMessage({
          type: 'SYNC_STAGE_STATE',
          payload: state,
        } satisfies HostMessage);
        this._view.webview.postMessage({
          type: 'SYNC_CONFIG',
          payload: getRetuneConfig(),
        } satisfies HostMessage);
      })
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

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

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      StagePanel.handleSharedMessage(message, this._extensionUri);
      if (message.type === 'READY') {
        this.syncSidebar();
      }
    });

    this.syncSidebar();
  }

  public syncSidebar() {
    if (!this._view) return;
    const meta = StagePanel.getActiveMetadata();
    if (meta) {
      this._view.webview.postMessage({
        type: 'SYNC_COMPONENT',
        payload: meta,
      } satisfies HostMessage);
    }
    this._view.webview.postMessage({
      type: 'SYNC_STAGE_STATE',
      payload: StagePanel.getStageState(),
    } satisfies HostMessage);
    this._view.webview.postMessage({
      type: 'SYNC_CONFIG',
      payload: getRetuneConfig(),
    } satisfies HostMessage);
  }

  public dispose() {
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}

