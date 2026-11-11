import * as vscode from 'vscode';
import * as path from 'node:path';
import {
  extractCvaMetadata,
  extractElementClassName,
  analyzeProps,
  listElements,
  ComponentMetadata,
  StageState,
  StageOpenMode,
  StageTabId,
  WebviewMessage,
  HostMessage,
} from '@retune/core';
import { getRetuneConfig, updateRetuneConfig } from '../config/extension-config';
import { buildWebviewHtml, getWebviewDistDir } from './webview-html';
import {
  fileClassFor,
  normalizeTarget,
  planClassMutation,
  planVariantMutation,
  reconcile,
  resolveTarget,
  type MutationPlan,
  type TargetRef,
} from '../state/stage-state';

export type SinkId = 'stage' | 'sidebar';

const sinks = new Map<SinkId, (msg: HostMessage) => void>();

export class StagePanel {
  public static currentPanel: StagePanel | undefined;
  private static _activeDocument: vscode.TextDocument | undefined;
  private static _stageState: StageState = {
    selectedVariants: {},
    propValues: {},
    harmonicsClass: '',
    baselineClass: '',
    viewport: 'responsive',
    showGrid: true,
    activeTab: 'stage',
  };

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static registerSink(id: SinkId, post: (msg: HostMessage) => void): vscode.Disposable {
    sinks.set(id, post);
    return new vscode.Disposable(() => {
      if (sinks.get(id) === post) sinks.delete(id);
    });
  }

  public static broadcast(msg: HostMessage, except?: SinkId) {
    for (const [id, post] of sinks) {
      if (id !== except) post(msg);
    }
  }

  public static syncAll(except?: SinkId) {
    StagePanel.broadcast(
      { type: 'SYNC_COMPONENT', payload: StagePanel.getActiveMetadata() },
      except
    );
    StagePanel.broadcast({ type: 'SYNC_STAGE_STATE', payload: StagePanel._stageState }, except);
    StagePanel.broadcast({ type: 'SYNC_CONFIG', payload: getRetuneConfig() }, except);
  }

  public static getStageState(): StageState {
    return StagePanel._stageState;
  }

  public static getActiveMetadata(): ComponentMetadata | null {
    if (!StagePanel._activeDocument) {
      const candidate =
        vscode.window.activeTextEditor?.document ||
        vscode.window.visibleTextEditors.find(
          (ed) =>
            ed.document.fileName.endsWith('.tsx') || ed.document.fileName.endsWith('.jsx')
        )?.document;
      if (
        candidate &&
        (candidate.fileName.endsWith('.tsx') || candidate.fileName.endsWith('.jsx'))
      ) {
        StagePanel._activeDocument = candidate;
      }
    }
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
      elements: listElements(text),
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

    if (options?.tab) {
      StagePanel._stageState = { ...StagePanel._stageState, activeTab: options.tab };
    }
    if (options?.targetElement) {
      const meta = StagePanel.getActiveMetadata();
      if (meta) {
        StagePanel._setTarget(normalizeTarget(meta.elements ?? [], options.targetElement), meta);
      }
    }

    // Reveal the Retune Activity Bar Sidebar alongside the Stage Tab in the application
    vscode.commands.executeCommand('workbench.view.extension.retune-sidebar').then(
      () => {},
      () => {}
    );

    if (StagePanel.currentPanel) {
      StagePanel.currentPanel._panel.reveal(viewColumn);
      StagePanel.syncAll();
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
    const targetChanged = StagePanel._activeDocument?.uri.toString() !== document.uri.toString();
    StagePanel._activeDocument = document;
    const meta = StagePanel.getActiveMetadata();

    if (meta) {
      let next: StageState = StagePanel._stageState;
      if (targetChanged) {
        const cfg = getRetuneConfig();
        next = {
          ...next,
          selectedVariants: { ...meta.cva.defaultVariants },
          viewport: cfg.defaultViewport,
          showGrid: cfg.showGrid,
        };
        delete next.targetElement;
        delete next.targetIndex;
      }
      const target: TargetRef = { targetElement: next.targetElement, targetIndex: next.targetIndex };
      const elements = meta.elements ?? [];
      const resolves =
        !target.targetElement ||
        resolveTarget(elements, target.targetElement, target.targetIndex) !== undefined;
      const fileClass = resolves ? fileClassFor(meta.cva, elements, target) : next.baselineClass;
      StagePanel._stageState = reconcile(next, fileClass, targetChanged);
    }

    if (StagePanel.currentPanel) {
      StagePanel.currentPanel._panel.title = `Retune: ${meta?.componentName || 'Stage'}`;
    }
    StagePanel.syncAll();
  }

  public static async handleSharedMessage(
    message: WebviewMessage,
    extensionUri: vscode.Uri,
    source: SinkId
  ) {
    if (message.type === 'READY') {
      StagePanel.syncAll();
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
      StagePanel.broadcast({ type: 'SYNC_STAGE_STATE', payload: StagePanel._stageState }, source);
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
      StagePanel.broadcast({ type: 'SYNC_STAGE_STATE', payload: StagePanel._stageState }, source);
      return;
    }

    if (message.type === 'UPDATE_CONFIG') {
      await updateRetuneConfig(message.payload);
      StagePanel.broadcast({ type: 'SYNC_CONFIG', payload: getRetuneConfig() });
      return;
    }

    if (message.type === 'SELECT_ELEMENT') {
      const meta = StagePanel.getActiveMetadata();
      if (!meta) return;
      const elements = meta.elements ?? [];
      const target = normalizeTarget(elements, message.payload?.name, message.payload?.index);
      StagePanel._setTarget(target, meta);
      StagePanel.syncAll();

      const el = resolveTarget(elements, target.targetElement, target.targetIndex);
      const doc = StagePanel._activeDocument;
      if (el && doc) {
        const editor = vscode.window.visibleTextEditors.find(
          (ed) => ed.document.uri.toString() === doc.uri.toString()
        );
        if (editor) {
          const pos = doc.positionAt(el.start);
          editor.revealRange(
            new vscode.Range(pos, pos),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
          );
        }
      }
      return;
    }

    if (message.type === 'MUTATE_CLASSES') {
      const { className } = message.payload;
      const doc = StagePanel._activeDocument;
      const result = doc
        ? await StagePanel._applyPlan(doc, planClassMutation(doc.getText(), StagePanel._stageState, className))
        : { ok: false, message: 'No active component file' };
      if (result.ok) {
        StagePanel._stageState = {
          ...StagePanel._stageState,
          baselineClass: className,
          harmonicsClass: className,
        };
      }
      StagePanel.broadcast({ type: 'MUTATION_RESULT', payload: { ...result, kind: 'classes' } });
      StagePanel.syncAll();
      return;
    }

    if (message.type === 'MUTATE_VARIANT') {
      const { variantGroup, variantValue } = message.payload;
      const doc = StagePanel._activeDocument;
      const result = doc
        ? await StagePanel._applyPlan(doc, planVariantMutation(doc.getText(), variantGroup, variantValue))
        : { ok: false, message: 'No active component file' };
      StagePanel.broadcast({ type: 'MUTATION_RESULT', payload: { ...result, kind: 'variant' } });
      StagePanel.syncAll();
      return;
    }
  }

  private static _setTarget(target: TargetRef, meta: ComponentMetadata) {
    const base: StageState = { ...StagePanel._stageState };
    delete base.targetElement;
    delete base.targetIndex;
    StagePanel._stageState = reconcile(
      { ...base, ...target },
      fileClassFor(meta.cva, meta.elements ?? [], target),
      true
    );
  }

  private static async _applyPlan(
    doc: vscode.TextDocument,
    plan: MutationPlan
  ): Promise<{ ok: boolean; message: string }> {
    if (!plan.ok) return { ok: false, message: plan.message };
    if (plan.edit) {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        doc.uri,
        new vscode.Range(doc.positionAt(plan.edit.start), doc.positionAt(plan.edit.end)),
        plan.edit.text
      );
      if (!(await vscode.workspace.applyEdit(edit))) {
        return { ok: false, message: 'VS Code rejected the edit' };
      }
    }
    return { ok: true, message: plan.message };
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

    this._disposables.push(
      StagePanel.registerSink('stage', (msg) => {
        this._panel.webview.postMessage(msg);
      })
    );

    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) =>
        StagePanel.handleSharedMessage(message, this._extensionUri, 'stage'),
      null,
      this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    StagePanel.syncAll();
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
