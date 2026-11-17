import {
  analyzeProps,
  applyEdits,
  computeClassNameEdit,
  computeCvaBaseEdit,
  computeCvaVariantEdit,
  computeDefaultVariantEdit,
  extractComponentName,
  extractCvaMetadata,
  extractPreviewTree,
  listElements,
  type ComponentMetadata,
  type ElementInfo,
  type FileProblem,
  type HostMessage,
  type RetuneExtensionConfig,
  type StageState,
  type TextEdit,
  type ViewportPreset,
  type WebviewMessage,
} from '@retune/core';
import type { HostBridge } from './host';

export interface OrcaDisposable {
  dispose(): void;
}

export type OrcaEditorContent =
  | string
  | Uint8Array
  | { kind: 'text'; text: string }
  | { kind: 'bytes'; bytes: ArrayBuffer };

export interface OrcaEditorDocument {
  readonly version: number;
  readonly readOnly: boolean;
  readonly content: OrcaEditorContent;
}

export interface OrcaEditorSession<T = string> {
  readonly value: T;
  readonly readOnly: boolean;
  change(next: T): void;
  flush(): Promise<void>;
  onReplace(handler: (value: T) => void): OrcaDisposable;
  dispose(): void;
}

export interface OrcaDocumentApi {
  get(): Promise<OrcaEditorDocument>;
  onDidChange(handler: (document: OrcaEditorDocument) => void): OrcaDisposable;
  applyEdit(edit: { baseVersion: number; content: { kind: 'text'; text: string } | string }): Promise<null>;
  session?<T = string>(options?: {
    merge?: (base: T, outside: T, mine: T) => T;
    debounceMs?: number;
  }): Promise<OrcaEditorSession<T>>;
}

export interface OrcaStorageApi {
  get<T = unknown>(key: string): Promise<T | null | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  onDidChange(handler: (change: { key: string; newValue?: unknown }) => void): OrcaDisposable;
}

export interface OrcaSettingsApi {
  get<T = unknown>(key?: string): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
  onDidChange(handler: (change: { key: string; newValue?: unknown }) => void): OrcaDisposable;
}

export interface OrcaFrameApi {
  readonly document?: OrcaDocumentApi;
  readonly storage?: OrcaStorageApi;
  readonly settings?: OrcaSettingsApi;
  on?(event: 'theme', handler: (payload: { colorScheme: 'light' | 'dark' }) => void): OrcaDisposable;
}

const SNAPSHOT_KEY = 'retune.snapshot';
const INTENT_KEY = 'retune.intent';

interface OrcaSnapshot {
  meta: ComponentMetadata | null;
  stage: StageState;
  problem: FileProblem | null;
  config: RetuneExtensionConfig;
}

interface OrcaIntent {
  id: number;
  message: WebviewMessage;
}

const DEFAULT_CONFIG: RetuneExtensionConfig = {
  daemonPort: 49221,
  sandboxPort: 5173,
  openMode: 'tab',
  defaultViewport: 'responsive',
  showGrid: true,
  autoSyncActiveEditor: true,
  scalarLayout: 'modern',
};

function decodeContent(content: OrcaEditorContent): string {
  if (typeof content === 'string') return content;
  if (content instanceof Uint8Array) return new TextDecoder().decode(content);
  if (content && typeof content === 'object') {
    if (content.kind === 'text') return content.text;
    if (content.kind === 'bytes') return new TextDecoder().decode(new Uint8Array(content.bytes));
  }
  return '';
}

function toJsonPayload<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveElement(elements: ElementInfo[], name?: string, index = 0): ElementInfo | undefined {
  if (!name) return undefined;
  return elements.filter((el) => el.name === name)[index];
}

function fileClassesFor(meta: ComponentMetadata, state: StageState): string {
  if (state.cvaTarget) {
    return meta.cva.variantClasses?.[state.cvaTarget.group]?.[state.cvaTarget.key] ?? '';
  }
  if (state.targetElement) {
    return resolveElement(meta.elements ?? [], state.targetElement, state.targetIndex)?.className ?? '';
  }
  if (meta.cva.hasCva) return meta.cva.baseClasses;
  return meta.elements?.[0]?.className ?? '';
}

function applyClassEdit(source: string, state: StageState, className: string): { ok: boolean; updated?: string; message: string } {
  try {
    let edit: TextEdit | null = null;
    if (state.cvaTarget) {
      edit = computeCvaVariantEdit(source, state.cvaTarget.group, state.cvaTarget.key, className);
      if (!edit) return { ok: false, message: `Variant "${state.cvaTarget.group}.${state.cvaTarget.key}" could not be edited` };
    } else if (state.targetElement) {
      const el = resolveElement(listElements(source), state.targetElement, state.targetIndex);
      if (!el) return { ok: false, message: `No <${state.targetElement}> element found` };
      edit = computeClassNameEdit(source, { offset: el.start }, className);
    } else if (extractCvaMetadata(source).hasCva) {
      edit = computeCvaBaseEdit(source, className);
      if (!edit) return { ok: false, message: 'cva() base classes are not a plain string' };
    } else {
      edit = computeClassNameEdit(source, {}, className);
    }

    if (!edit) return { ok: false, message: 'No JSX element found' };
    const updated = applyEdits(source, edit);
    if (updated === source) return { ok: true, message: 'Already up to date' };
    return { ok: true, updated, message: 'Synced to code' };
  } catch {
    return { ok: false, message: 'Could not parse file' };
  }
}

async function readOrcaConfig(orca: OrcaFrameApi, base: RetuneExtensionConfig): Promise<RetuneExtensionConfig> {
  if (!orca.settings) return base;
  try {
    const raw = await orca.settings.get<Record<string, unknown>>();
    if (!raw || typeof raw !== 'object') return base;
    return {
      ...base,
      ...(typeof raw['daemon.port'] === 'number' ? { daemonPort: raw['daemon.port'] } : {}),
      ...(typeof raw['stage.defaultViewport'] === 'string'
        ? { defaultViewport: raw['stage.defaultViewport'] as ViewportPreset }
        : {}),
      ...(typeof raw['stage.showGrid'] === 'boolean' ? { showGrid: raw['stage.showGrid'] } : {}),
      ...(raw['scalar.layout'] === 'modern' || raw['scalar.layout'] === 'classic'
        ? { scalarLayout: raw['scalar.layout'] }
        : {}),
    };
  } catch {
    return base;
  }
}

async function writeOrcaConfig(orca: OrcaFrameApi, patch: Partial<RetuneExtensionConfig>): Promise<void> {
  if (!orca.settings) return;
  try {
    if (patch.daemonPort !== undefined) await orca.settings.set('daemon.port', patch.daemonPort);
    if (patch.defaultViewport !== undefined) await orca.settings.set('stage.defaultViewport', patch.defaultViewport);
    if (patch.showGrid !== undefined) await orca.settings.set('stage.showGrid', patch.showGrid);
    if (patch.scalarLayout !== undefined) await orca.settings.set('scalar.layout', patch.scalarLayout);
  } catch {
    // Ignore read-only/missing setting writes cleanly
  }
}

/**
 * HostBridge adapter when Retune runs inside Orca (`onorca.dev`).
 *
 * Returns `kind: 'vscode'` because both VS Code and Orca run as host-managed editors
 * (unlike the standalone browser demo). Custom Editor frames own document parsing and
 * edits locally in-frame; the right-sidebar Inspector panel stays synchronized via `orca.storage`.
 */
export function createOrcaHost(orca: OrcaFrameApi): HostBridge {
  const listeners = new Set<(msg: HostMessage) => void>();
  const emit = (msg: HostMessage) => {
    for (const listener of listeners) listener(msg);
  };

  // Surface B: Right-sidebar Inspector panel (no orca.document)
  if (!orca.document) {
    let initialized = false;
    let unsubs: OrcaDisposable[] = [];

    const pushSnapshot = (snap: OrcaSnapshot | undefined) => {
      if (!snap) return;
      emit({ type: 'SYNC_COMPONENT', payload: snap.meta });
      emit({ type: 'SYNC_PROBLEM', payload: snap.problem });
      emit({ type: 'SYNC_STAGE_STATE', payload: snap.stage });
      emit({ type: 'SYNC_CONFIG', payload: snap.config });
    };

    const ensureInit = async () => {
      if (initialized) return;
      initialized = true;
      const snap = await orca.storage?.get<OrcaSnapshot>(SNAPSHOT_KEY);
      if (snap) {
        pushSnapshot(snap);
      } else {
        const cfg = await readOrcaConfig(orca, DEFAULT_CONFIG);
        emit({ type: 'SYNC_CONFIG', payload: cfg });
      }
      if (orca.storage) {
        const storage = orca.storage;
        unsubs.push(
          storage.onDidChange((ev) => {
            if (ev.key !== SNAPSHOT_KEY) return;
            if (ev.newValue) {
              pushSnapshot(ev.newValue as OrcaSnapshot);
              return;
            }
            void storage.get<OrcaSnapshot>(SNAPSHOT_KEY).then((latest) => {
              if (latest) pushSnapshot(latest);
            });
          }),
        );
      }
    };

    return {
      kind: 'vscode',
      post(message) {
        if (message.type === 'READY') {
          void ensureInit().then(async () => {
            const snap = await orca.storage?.get<OrcaSnapshot>(SNAPSHOT_KEY);
            if (snap) pushSnapshot(snap);
          });
          return;
        }
        if (message.type === 'UPDATE_CONFIG') {
          void writeOrcaConfig(orca, message.payload);
        }
        const intent: OrcaIntent = { id: Date.now() + Math.random(), message };
        void orca.storage?.set(INTENT_KEY, toJsonPayload(intent)).catch(() => {});
      },
      subscribe(listener) {
        listeners.add(listener);
        void ensureInit();
        return () => {
          listeners.delete(listener);
          if (listeners.size === 0) {
            unsubs.forEach((d) => d.dispose());
            unsubs = [];
            initialized = false;
          }
        };
      },
    };
  }

  // Surface A: Isolated Custom Editor frame (owns `orca.document`)
  const docApi = orca.document;
  let sourceText = '';
  let docVersion = 0;
  let session: OrcaEditorSession<string> | null = null;
  let meta: ComponentMetadata | null = null;
  let lastGood: ComponentMetadata | null = null;
  let problem: FileProblem | null = null;
  let config: RetuneExtensionConfig = { ...DEFAULT_CONFIG };
  let stage: StageState = {
    selectedVariants: {},
    propValues: {},
    harmonicsClass: '',
    baselineClass: '',
    viewport: 'responsive',
    showGrid: true,
    activeTab: 'stage',
  };
  let lastHandledIntentId = 0;
  let initialized = false;
  let initPromise: Promise<void> | null = null;
  let subs: OrcaDisposable[] = [];

  const publishSnapshot = () => {
    if (!orca.storage) return;
    // Strip large fields before writing to plugin storage (Orca limits storage & panel payloads to 64 KiB).
    const trimmedMeta = meta
      ? {
          ...meta,
          rawSource: meta.rawSource.length > 16384 ? '' : meta.rawSource,
          previewTree: null,
          workspaceCss: undefined,
        }
      : null;
    const snap: OrcaSnapshot = toJsonPayload({ meta: trimmedMeta, stage, problem, config });
    void orca.storage.set(SNAPSHOT_KEY, snap).catch(() => {});
  };

  const syncAll = () => {
    emit({ type: 'SYNC_COMPONENT', payload: meta });
    emit({ type: 'SYNC_PROBLEM', payload: problem });
    emit({ type: 'SYNC_STAGE_STATE', payload: stage });
    emit({ type: 'SYNC_CONFIG', payload: config });
    publishSnapshot();
  };

  const ingestSource = (nextSource: string, firstLoad: boolean) => {
    sourceText = nextSource;
    try {
      const cva = extractCvaMetadata(nextSource);
      const props = analyzeProps(nextSource);
      const componentName = extractComponentName(nextSource);
      const elements = listElements(nextSource);
      const previewTree = extractPreviewTree(nextSource);
      meta = { componentName, filePath: '', cva, props, rawSource: nextSource, elements, previewTree };
      lastGood = meta;
      problem = null;

      if (firstLoad) {
        stage = {
          ...stage,
          selectedVariants: { ...cva.defaultVariants },
          viewport: config.defaultViewport,
          showGrid: config.showGrid,
        };
      }
      const fileCls = fileClassesFor(meta, stage);
      if (firstLoad || stage.harmonicsClass === stage.baselineClass) {
        stage = { ...stage, harmonicsClass: fileCls, baselineClass: fileCls };
      } else {
        stage = { ...stage, baselineClass: fileCls };
      }
    } catch (err) {
      meta = lastGood;
      problem = {
        fileName: 'component.tsx',
        message: err instanceof Error ? err.message : String(err),
      };
    }
    syncAll();
  };

  const commitDocument = async (updated: string) => {
    sourceText = updated;
    if (session) {
      session.change(updated);
      await session.flush().catch(() => {});
    } else {
      await docApi.applyEdit({ baseVersion: docVersion, content: { kind: 'text', text: updated } });
      docVersion += 1;
    }
    ingestSource(updated, false);
  };

  const handleMessage = async (message: WebviewMessage) => {
    await ensureInit();

    if (message.type === 'READY') {
      syncAll();
      return;
    }

    if (message.type === 'UPDATE_STAGE_STATE') {
      stage = { ...stage, ...message.payload };
      syncAll();
      return;
    }

    if (message.type === 'UPDATE_PROP_VALUE') {
      stage = {
        ...stage,
        propValues: { ...stage.propValues, [message.payload.propName]: message.payload.value },
      };
      syncAll();
      return;
    }

    if (message.type === 'UPDATE_CONFIG') {
      config = { ...config, ...message.payload };
      await writeOrcaConfig(orca, message.payload);
      syncAll();
      return;
    }

    if (message.type === 'SELECT_ELEMENT' && meta) {
      const ref = message.payload;
      const cls = ref
        ? resolveElement(meta.elements ?? [], ref.name, ref.index)?.className ?? ''
        : fileClassesFor(meta, { ...stage, targetElement: undefined, targetIndex: undefined, cvaTarget: null });
      stage = {
        ...stage,
        targetElement: ref?.name,
        targetIndex: ref?.index,
        cvaTarget: null,
        harmonicsClass: cls,
        baselineClass: cls,
      };
      syncAll();
      return;
    }

    if (message.type === 'SELECT_CVA_TARGET' && meta) {
      const cvaTarget = message.payload;
      const cls = cvaTarget
        ? meta.cva.variantClasses?.[cvaTarget.group]?.[cvaTarget.key] ?? ''
        : meta.cva.baseClasses;
      stage = {
        ...stage,
        targetElement: undefined,
        targetIndex: undefined,
        cvaTarget,
        selectedVariants: cvaTarget
          ? { ...stage.selectedVariants, [cvaTarget.group]: cvaTarget.key }
          : stage.selectedVariants,
        harmonicsClass: cls,
        baselineClass: cls,
      };
      syncAll();
      return;
    }

    if (message.type === 'MUTATE_CLASSES') {
      const res = applyClassEdit(sourceText, stage, message.payload.className);
      if (res.ok && res.updated) {
        stage = { ...stage, harmonicsClass: message.payload.className, baselineClass: message.payload.className };
        await commitDocument(res.updated);
      }
      emit({ type: 'MUTATION_RESULT', payload: { ok: res.ok, kind: 'classes', message: res.message } });
      syncAll();
      return;
    }

    if (message.type === 'MUTATE_VARIANT') {
      const edit = computeDefaultVariantEdit(sourceText, message.payload.variantGroup, message.payload.variantValue);
      if (!edit) {
        emit({ type: 'MUTATION_RESULT', payload: { ok: false, kind: 'variant', message: 'No defaultVariants block found' } });
        return;
      }
      const updated = applyEdits(sourceText, edit);
      await commitDocument(updated);
      emit({
        type: 'MUTATION_RESULT',
        payload: {
          ok: true,
          kind: 'variant',
          message: `Default ${message.payload.variantGroup} set to ${message.payload.variantValue}`,
        },
      });
      return;
    }

    if (message.type === 'MUTATE_CVA_VARIANT') {
      const { variantGroup, variantKey, className } = message.payload;
      const edit = computeCvaVariantEdit(sourceText, variantGroup, variantKey, className);
      if (!edit) {
        emit({
          type: 'MUTATION_RESULT',
          payload: { ok: false, kind: 'variant', message: `Variant "${variantGroup}.${variantKey}" could not be edited` },
        });
        return;
      }
      const updated = applyEdits(sourceText, edit);
      stage = {
        ...stage,
        cvaTarget: { group: variantGroup, key: variantKey },
        selectedVariants: { ...stage.selectedVariants, [variantGroup]: variantKey },
        harmonicsClass: className,
        baselineClass: className,
      };
      await commitDocument(updated);
      emit({
        type: 'MUTATION_RESULT',
        payload: { ok: true, kind: 'variant', message: `Saved ${variantGroup}.${variantKey} to code` },
      });
    }
  };

  const ensureInit = () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      config = await readOrcaConfig(orca, config);
      if (docApi.session) {
        session = await docApi.session<string>({ debounceMs: 250 });
        ingestSource(session.value, true);
        subs.push(
          session.onReplace((next) => {
            ingestSource(next, false);
          }),
        );
      } else {
        const doc = await docApi.get();
        docVersion = doc.version;
        ingestSource(decodeContent(doc.content), true);
        subs.push(
          docApi.onDidChange((next) => {
            docVersion = next.version;
            ingestSource(decodeContent(next.content), false);
          }),
        );
      }
      if (orca.settings) {
        subs.push(
          orca.settings.onDidChange(() => {
            void readOrcaConfig(orca, config).then((nextCfg) => {
              config = nextCfg;
              syncAll();
            });
          }),
        );
      }
      if (orca.storage) {
        const storage = orca.storage;
        subs.push(
          storage.onDidChange((ev) => {
            if (ev.key !== INTENT_KEY) return;
            const consume = (intent: OrcaIntent | null | undefined) => {
              if (intent && intent.id > lastHandledIntentId) {
                lastHandledIntentId = intent.id;
                void handleMessage(intent.message);
              }
            };
            if (ev.newValue) {
              consume(ev.newValue as OrcaIntent);
            } else {
              void storage.get<OrcaIntent>(INTENT_KEY).then(consume);
            }
          }),
        );
      }
      initialized = true;
    })();
    return initPromise;
  };

  return {
    kind: 'vscode',
    post(message) {
      void handleMessage(message);
    },
    subscribe(listener) {
      listeners.add(listener);
      if (initialized) {
        syncAll();
      } else {
        void ensureInit();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          subs.forEach((d) => d.dispose());
          subs = [];
          session?.dispose();
          session = null;
          initialized = false;
          initPromise = null;
        }
      };
    },
  };
}
