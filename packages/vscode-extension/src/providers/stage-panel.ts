import * as vscode from 'vscode';
import * as path from 'node:path';
import {
  extractCvaMetadata,
  extractElementClassName,
  analyzeProps,
  mutateClassName,
  mutateDefaultVariant,
  ComponentMetadata,
  StageState,
  StageOpenMode,
  StageTabId,
  WebviewMessage,
  HostMessage,
} from '@retune/core';
import { getRetuneConfig, updateRetuneConfig } from '../config/extension-config';
import { buildWebviewHtml, getWebviewDistDir } from './webview-html';

export class StagePanel {
  public static currentPanel: StagePanel | undefined;
  private static _stateListeners: Array<(state: StageState, meta: ComponentMetadata | null) => void> = [];
  private static _activeDocument: vscode.TextDocument | undefined;
  private static _stageState: StageState = {
    selectedVariants: {},
    propValues: {},
    harmonicsClass: '',
    viewport: 'responsive',
    showGrid: true,
    activeTab: 'stage',
  };

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static onDidStateChange(
    listener: (state: StageState, meta: ComponentMetadata | null) => void
  ): vscode.Disposable {
    StagePanel._stateListeners.push(listener);
    return new vscode.Disposable(() => {
      StagePanel._stateListeners = StagePanel._stateListeners.filter((l) => l !== listener);
    });
  }

  public static getStageState(): StageState {
    return StagePanel._stageState;
  }

  public static getActiveMetadata(): ComponentMetadata | null {
    const doc = StagePanel._activeDocument;
    if (!doc) return null;
    const text = doc.getText();
    const cvaMeta = extractCvaMetadata(text);
    const props = analyzeProps(text);
    const componentName = path.basename(doc.fileName, path.extname(doc.fileName));
    return {
      componentName,
      filePath: doc.fileName,
      cva: cvaMeta,
      props,
      rawSource: text,
    };
  }

  public static render(
    extensionUri: vscode.Uri,
    document?: vscode.TextDocument,
    options?: { openMode?: StageOpenMode; tab?: StageTabId; targetElement?: string }
  ) {
    const config = getRetuneConfig();
    const openMode = options?.openMode || config.openMode;
    const viewColumn =
      openMode === 'tab' ? vscode.ViewColumn.Active : vscode.ViewColumn.Beside;

    if (document) {
      StagePanel.setActiveDocument(document);
    }

    if (options?.tab || options?.targetElement) {
      const docText = StagePanel._activeDocument?.getText() || '';
      const elementClasses = options.targetElement
        ? extractElementClassName(docText, options.targetElement)
        : '';
      StagePanel._stageState = {
        ...StagePanel._stageState,
        ...(options.tab ? { activeTab: options.tab } : {}),
        ...(options.targetElement ? { targetElement: options.targetElement } : {}),
        ...(elementClasses ? { harmonicsClass: elementClasses } : {}),
      };
    }

    // Reveal the Retune Activity Bar Sidebar alongside the Stage Tab in the application
    vscode.commands.executeCommand('workbench.view.extension.retune-sidebar').then(
      () => {},
      () => {}
    );

    if (StagePanel.currentPanel) {
      StagePanel.currentPanel._panel.reveal(viewColumn);
      StagePanel.currentPanel.syncAll();
      StagePanel._notifyListeners();
      return;
    }

    const compName = document
      ? path.basename(document.fileName, path.extname(document.fileName))
      : 'Stage';

    const panel = vscode.window.createWebviewPanel(
      'retuneStage',
      `Retune: ${compName}`,
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          extensionUri,
          vscode.Uri.file(getWebviewDistDir(extensionUri)),
          vscode.Uri.file(path.resolve(extensionUri.fsPath, '..', 'webview', 'dist')),
        ],
      }
    );

    StagePanel.currentPanel = new StagePanel(panel, extensionUri);
  }

  public static setActiveDocument(document: vscode.TextDocument) {
    const isNewDoc = StagePanel._activeDocument?.uri.toString() !== document.uri.toString();
    StagePanel._activeDocument = document;
    const meta = StagePanel.getActiveMetadata();

    if (meta && isNewDoc) {
      const cfg = getRetuneConfig();
      const fallbackElementClass =
        meta.cva.baseClasses || extractElementClassName(document.getText());
      StagePanel._stageState = {
        ...StagePanel._stageState,
        selectedVariants: { ...meta.cva.defaultVariants },
        harmonicsClass: fallbackElementClass || '',
        viewport: cfg.defaultViewport,
        showGrid: cfg.showGrid,
      };
    }

    if (StagePanel.currentPanel) {
      StagePanel.currentPanel._panel.title = `Retune: ${meta?.componentName || 'Stage'}`;
      StagePanel.currentPanel.syncAll();
    }
    StagePanel._notifyListeners();
  }

  public static async handleSharedMessage(message: WebviewMessage, extensionUri: vscode.Uri) {
    if (message.type === 'READY') {
      StagePanel.currentPanel?.syncAll();
      StagePanel._notifyListeners();
      return;
    }

    if (message.type === 'OPEN_STAGE_TAB') {
      StagePanel.render(extensionUri, StagePanel._activeDocument, message.payload);
      return;
    }

    if (message.type === 'UPDATE_STAGE_STATE') {
      StagePanel._stageState = {
        ...StagePanel._stageState,
        ...message.payload,
      };
      StagePanel.currentPanel?.postMessage({
        type: 'SYNC_STAGE_STATE',
        payload: StagePanel._stageState,
      });
      StagePanel._notifyListeners();
      return;
    }

    if (message.type === 'UPDATE_PROP_VALUE') {
      StagePanel._stageState = {
        ...StagePanel._stageState,
        propValues: {
          ...StagePanel._stageState.propValues,
          [message.payload.propName]: message.payload.value,
        },
      };
      StagePanel.currentPanel?.postMessage({
        type: 'SYNC_STAGE_STATE',
        payload: StagePanel._stageState,
      });
      StagePanel._notifyListeners();
      return;
    }

    if (message.type === 'UPDATE_CONFIG') {
      await updateRetuneConfig(message.payload);
      StagePanel.currentPanel?.postMessage({
        type: 'SYNC_CONFIG',
        payload: getRetuneConfig(),
      });
      StagePanel._notifyListeners();
      return;
    }

    if (message.type === 'MUTATE_CLASSES' && StagePanel._activeDocument) {
      const doc = StagePanel._activeDocument;
      const { componentName, className } = message.payload;
      const originalText = doc.getText();
      const mutated = mutateClassName(originalText, componentName, className);

      if (mutated !== originalText) {
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(originalText.length)
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(doc.uri, fullRange, mutated);
        await vscode.workspace.applyEdit(edit);
      }
      return;
    }

    if (message.type === 'MUTATE_VARIANT' && StagePanel._activeDocument) {
      const doc = StagePanel._activeDocument;
      const { variantGroup, variantValue } = message.payload;
      const originalText = doc.getText();
      const mutated = mutateDefaultVariant(originalText, variantGroup, variantValue);

      if (mutated !== originalText) {
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(originalText.length)
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(doc.uri, fullRange, mutated);
        await vscode.workspace.applyEdit(edit);
      }
      return;
    }
  }

  private static _notifyListeners() {
    const meta = StagePanel.getActiveMetadata();
    for (const listener of StagePanel._stateListeners) {
      listener(StagePanel._stageState, meta);
    }
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    const config = getRetuneConfig();
    this._panel.webview.html = buildWebviewHtml(
      this._panel.webview,
      this._extensionUri,
      'editor-tab',
      config.sandboxPort
    );

    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => StagePanel.handleSharedMessage(message, this._extensionUri),
      null,
      this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this.syncAll();
  }

  public updateDocument(document: vscode.TextDocument) {
    StagePanel.setActiveDocument(document);
  }

  public postMessage(msg: HostMessage) {
    this._panel.webview.postMessage(msg);
  }

  public syncAll() {
    const meta = StagePanel.getActiveMetadata();
    if (meta) {
      this._panel.webview.postMessage({
        type: 'SYNC_COMPONENT',
        payload: meta,
      } satisfies HostMessage);
    }
    this._panel.webview.postMessage({
      type: 'SYNC_STAGE_STATE',
      payload: StagePanel._stageState,
    } satisfies HostMessage);
    this._panel.webview.postMessage({
      type: 'SYNC_CONFIG',
      payload: getRetuneConfig(),
    } satisfies HostMessage);
  }

  public dispose() {
    StagePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
}
