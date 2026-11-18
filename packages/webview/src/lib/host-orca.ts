import {
  analyzeProps,
  applyEdits,
  computeClassNameEdit,
  computeCvaBaseEdit,
  computeCvaVariantEdit,
  computeDefaultVariantEdit,
  computeTextEdit,
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
import { resolveSelectedElementText } from './preview';

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

interface WorkspaceIndex {
  files: Record<string, string>;
  cssByDir: Record<string, string>;
}

const normSlashes = (p: string) => p.replace(/\\/g, '/');
const normLf = (s: string) => s.replace(/\r\n/g, '\n');

function resolvePosixRelative(fromFile: string, specifier: string): string {
  const parts = normSlashes(fromFile).split('/');
  parts.pop();
  for (const seg of specifier.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (parts.length > 1) parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.join('/');
}

function baseNameNoExt(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  const file = idx >= 0 ? filePath.slice(idx + 1) : filePath;
  const dot = file.lastIndexOf('.');
  return dot >= 0 ? file.slice(0, dot) : file;
}

function matchesComponentName(filePath: string, diskText: string, componentName: string): boolean {
  if (!componentName || componentName === 'Component') return false;
  if (baseNameNoExt(filePath) === componentName) return true;
  const declRe = new RegExp(`\\b(?:export\\s+(?:default\\s+)?)?(?:function|const|class)\\s+${componentName}\\b`);
  return declRe.test(diskText);
}

function findWorkspaceMatch(
  index: WorkspaceIndex | undefined,
  sourceText: string,
  componentName: string,
  prevMatch: string
): string {
  if (!index?.files) return '';
  const norm = normLf(sourceText);

  if (prevMatch && index.files[prevMatch] !== undefined) {
    const prev = index.files[prevMatch];
    if (!prev.startsWith('data:') && normLf(prev) === norm) return prevMatch;
  }

  const candidates: string[] = [];
  for (const [filePath, diskText] of Object.entries(index.files)) {
    if (diskText.startsWith('data:')) continue;
    if (normLf(diskText) === norm) return filePath;
    if (matchesComponentName(filePath, diskText, componentName)) {
      candidates.push(filePath);
    }
  }

  if (prevMatch && candidates.includes(prevMatch)) return prevMatch;
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    const head = norm.slice(0, 160);
    const byHead = candidates.find((c) => normLf(index.files[c]).slice(0, 160) === head);
    if (byHead) return byHead;
    const byName = candidates.find((c) => baseNameNoExt(c) === componentName);
    if (byName) return byName;
  }
  if (prevMatch && index.files[prevMatch] !== undefined) return prevMatch;
  return '';
}

function lookupWorkspaceCss(index: WorkspaceIndex | undefined, filePath: string, sourceText = ''): string {
  if (!index?.cssByDir) return '';
  if (filePath) {
    const parts = normSlashes(filePath).split('/');
    parts.pop();
    for (let i = 0; i < 4 && parts.length > 0; i++) {
      const dir = parts.join('/');
      if (index.cssByDir[dir]) return index.cssByDir[dir];
      if (parts.length === 1) break;
      parts.pop();
    }
  }
  if (!sourceText) return '';
  const classTokens = new Set<string>();
  const clsRe = new RegExp('class(?:Name)?\\s*=\\s*(?:["\']([^"\']+)["\']|\\{\\s*`([^$`]+))', 'g');
  let m: RegExpExecArray | null;
  while ((m = clsRe.exec(sourceText)) !== null) {
    const raw = (m[1] || m[2] || '').trim();
    for (const tok of raw.split(/\s+/)) {
      if (tok && !tok.endsWith('-')) classTokens.add(tok);
    }
  }
  if (classTokens.size === 0) return '';
  let bestCss = '';
  let bestScore = 0;
  for (const css of Object.values(index.cssByDir)) {
    let score = 0;
    for (const tok of classTokens) {
      if (css.includes(`.${tok}`)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCss = css;
    }
  }
  return bestScore > 0 ? bestCss : '';
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

function fileTextFor(meta: ComponentMetadata, state: StageState): string {
  return resolveSelectedElementText(meta, state.targetElement, state.targetIndex ?? 0);
}

function applyClassEdit(
  source: string,
  state: StageState,
  className: string,
  text?: string
): { ok: boolean; updated?: string; message: string } {
  try {
    let next = source;
    let didClass = false;
    const classChanged = className !== state.baselineClass;
    const textChanged = text !== undefined && text !== state.baselineText;

    if (classChanged || !textChanged) {
      let edit: TextEdit | null = null;
      if (state.cvaTarget) {
        edit = computeCvaVariantEdit(next, state.cvaTarget.group, state.cvaTarget.key, className);
        if (!edit) return { ok: false, message: `Variant "${state.cvaTarget.group}.${state.cvaTarget.key}" could not be edited` };
      } else if (state.targetElement) {
        const el = resolveElement(listElements(next), state.targetElement, state.targetIndex);
        if (!el) return { ok: false, message: `No <${state.targetElement}> element found` };
        edit = computeClassNameEdit(next, { offset: el.start }, className);
      } else if (extractCvaMetadata(next).hasCva) {
        edit = computeCvaBaseEdit(next, className);
        if (!edit) return { ok: false, message: 'cva() base classes are not a plain string' };
      } else {
        edit = computeClassNameEdit(next, {}, className);
      }
      if (edit) {
        next = applyEdits(next, edit);
        didClass = true;
      } else if (!textChanged) {
        return { ok: false, message: 'No JSX element found' };
      }
    }

    if (textChanged && !state.cvaTarget) {
      const target = state.targetElement
        ? { offset: resolveElement(listElements(next), state.targetElement, state.targetIndex)?.start }
        : {};
      if (state.targetElement && target.offset === undefined) {
        return { ok: false, message: `No <${state.targetElement}> element found` };
      }
      const textEdit = computeTextEdit(next, target, text!);
      if (!textEdit && !didClass) {
        return { ok: false, message: 'No editable JSX text found' };
      }
      if (textEdit) {
        next = applyEdits(next, textEdit);
      }
    }

    if (next === source) return { ok: true, message: 'Already up to date' };
    return { ok: true, updated: next, message: 'Synced to code' };
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

  let lastMatchedPath = '';

  const ingestSource = (nextSource: string, firstLoad: boolean) => {
    sourceText = nextSource;
    try {
      const cva = extractCvaMetadata(nextSource);
      const props = analyzeProps(nextSource);
      const componentName = extractComponentName(nextSource);
      const elements = listElements(nextSource);
      const workspaceIndex =
        typeof window !== 'undefined'
          ? (window as unknown as { RETUNE_WORKSPACE_INDEX?: WorkspaceIndex }).RETUNE_WORKSPACE_INDEX
          : undefined;
      const matchedPath = findWorkspaceMatch(workspaceIndex, nextSource, componentName, lastMatchedPath);
      if (matchedPath) lastMatchedPath = matchedPath;

      const resolveImport =
        matchedPath && workspaceIndex
          ? (specifier: string, fromId?: string) => {
              if (!specifier.startsWith('.')) return null;
              const base = resolvePosixRelative(fromId || matchedPath, specifier);
              for (const ext of ['', '.tsx', '.jsx', '.ts', '.js', '/index.tsx', '/index.jsx', '.svg']) {
                const cand = `${base}${ext}`;
                const hit = workspaceIndex.files[cand];
                if (hit !== undefined) return { id: cand, source: hit };
              }
              return null;
            }
          : undefined;

      const previewTree = extractPreviewTree(
        nextSource,
        matchedPath ? { sourceId: matchedPath, resolveImport } : undefined
      );
      const workspaceCss = lookupWorkspaceCss(workspaceIndex, matchedPath, nextSource);
      meta = {
        componentName,
        filePath: matchedPath,
        cva,
        props,
        rawSource: nextSource,
        elements,
        previewTree,
        ...(workspaceCss ? { workspaceCss } : {}),
      };
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
      const fileTxt = fileTextFor(meta, stage);
      const labelClean = String(stage.propValues.label ?? '') === (stage.baselineText ?? '');
      if (firstLoad || stage.harmonicsClass === stage.baselineClass) {
        stage = { ...stage, harmonicsClass: fileCls, baselineClass: fileCls };
      } else {
        stage = { ...stage, baselineClass: fileCls };
      }
      if (firstLoad || labelClean) {
        stage = {
          ...stage,
          baselineText: fileTxt,
          propValues: { ...stage.propValues, label: fileTxt },
        };
      } else {
        stage = { ...stage, baselineText: fileTxt };
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
      const nextStage: StageState = {
        ...stage,
        targetElement: ref?.name,
        targetIndex: ref?.index,
        cvaTarget: null,
      };
      const txt = fileTextFor(meta, nextStage);
      stage = {
        ...nextStage,
        harmonicsClass: cls,
        baselineClass: cls,
        baselineText: txt,
        computedStyle: null,
        matchedCssRules: undefined,
        propValues: { ...stage.propValues, label: txt },
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
      const res = applyClassEdit(sourceText, stage, message.payload.className, message.payload.text);
      if (res.ok && res.updated) {
        stage = {
          ...stage,
          harmonicsClass: message.payload.className,
          baselineClass: message.payload.className,
          ...(message.payload.text !== undefined
            ? {
                baselineText: message.payload.text,
                propValues: { ...stage.propValues, label: message.payload.text },
              }
            : {}),
        };
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
