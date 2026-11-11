import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type {
  FileProblem,
  ComponentMetadata,
  RetuneExtensionConfig,
  StageOpenMode,
  StageState,
  StageTabId,
} from '@retune/core';
import { getHost } from '../lib/host';
import { canRedo, canUndo, redo as redoSession, undo as undoSession } from '../lib/edit-session';
import type { ElementRef } from '../components/shared/element-list';
import type { ToastState, ToastTone } from '../components/ui';
import {
  computePreviewClass,
  initialModel,
  isDirty,
  reduce,
  targetLabel,
  type StageModel,
} from './stage-reducer';

export interface StageStore {
  hostKind: 'vscode' | 'standalone';
  meta: ComponentMetadata | null;
  config: RetuneExtensionConfig;
  stage: StageState;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  toast: ToastState | null;
  /** The active file's analysis error, if any. Optional so test fixtures can omit it. */
  problem?: FileProblem | null;
  targetLabel: string;
  previewClass: string;
  baselinePreviewClass: string;
  setClasses(next: string): void;
  undo(): void;
  redo(): void;
  discard(): void;
  sync(): void;
  selectVariant(group: string, value: string): void;
  commitVariant(group: string, value: string): void;
  setProp(name: string, value: string | boolean | number): void;
  patchStage(patch: Partial<StageState>): void;
  patchConfig(patch: Partial<RetuneExtensionConfig>): void;
  selectElement(ref: ElementRef | null): void;
  openStage(openMode?: StageOpenMode, tab?: StageTabId): void;
  notify(message: string, tone?: ToastTone): void;
}

const TOAST_MS: Record<ToastTone, number> = { success: 1500, info: 1500, error: 4000 };

export function useStage(): StageStore {
  const host = getHost();
  const [model, dispatch] = useReducer(reduce, host.kind, initialModel);
  const [toast, setToast] = useState<ToastState | null>(null);
  const modelRef = useRef<StageModel>(model);
  modelRef.current = model;
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS[tone]);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    const unsubscribe = host.subscribe((message) => {
      dispatch({ type: 'host', message, now: Date.now() });
      if (message.type === 'MUTATION_RESULT') {
        notify(message.payload.message, message.payload.ok ? 'success' : 'error');
      }
    });
    host.post({ type: 'READY' });
    return unsubscribe;
  }, [host, notify]);

  const patchStage = useCallback(
    (patch: Partial<StageState>) => {
      dispatch({ type: 'patchStage', patch });
      host.post({ type: 'UPDATE_STAGE_STATE', payload: patch });
    },
    [host],
  );

  const setClasses = useCallback(
    (next: string) => {
      dispatch({ type: 'setClasses', classes: next, now: Date.now() });
      host.post({ type: 'UPDATE_STAGE_STATE', payload: { harmonicsClass: next } });
    },
    [host],
  );

  const undo = useCallback(() => {
    const session = modelRef.current.session;
    if (!canUndo(session)) return;
    dispatch({ type: 'undo' });
    host.post({ type: 'UPDATE_STAGE_STATE', payload: { harmonicsClass: undoSession(session).present } });
  }, [host]);

  const redo = useCallback(() => {
    const session = modelRef.current.session;
    if (!canRedo(session)) return;
    dispatch({ type: 'redo' });
    host.post({ type: 'UPDATE_STAGE_STATE', payload: { harmonicsClass: redoSession(session).present } });
  }, [host]);

  const discard = useCallback(() => {
    setClasses(modelRef.current.stage.baselineClass);
  }, [setClasses]);

  const sync = useCallback(() => {
    const { stage, meta, config } = modelRef.current;
    if (host.kind === 'vscode') {
      host.post({ type: 'MUTATE_CLASSES', payload: { className: stage.harmonicsClass } });
      return;
    }
    dispatch({ type: 'markSynced' });
    notify('Synced (demo)', 'success');
    fetch(`http://127.0.0.1:${config.daemonPort}/v1/components/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileContent: meta?.rawSource ?? '',
        componentName: stage.targetElement || meta?.componentName,
        className: stage.harmonicsClass,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { updatedContent?: string } | null) => {
        const current = modelRef.current.meta;
        if (data?.updatedContent && current) {
          dispatch({
            type: 'host',
            now: Date.now(),
            message: { type: 'SYNC_COMPONENT', payload: { ...current, rawSource: data.updatedContent } },
          });
        }
      })
      .catch(() => {
        // The daemon is not running in the pure browser preview; the demo sync still succeeded.
      });
  }, [host, notify]);

  const selectVariant = useCallback(
    (group: string, value: string) => {
      patchStage({ selectedVariants: { ...modelRef.current.stage.selectedVariants, [group]: value } });
    },
    [patchStage],
  );

  const commitVariant = useCallback(
    (group: string, value: string) => {
      selectVariant(group, value);
      host.post({ type: 'MUTATE_VARIANT', payload: { variantGroup: group, variantValue: value } });
    },
    [host, selectVariant],
  );

  const setProp = useCallback(
    (name: string, value: string | boolean | number) => {
      dispatch({
        type: 'patchStage',
        patch: { propValues: { ...modelRef.current.stage.propValues, [name]: value } },
      });
      host.post({ type: 'UPDATE_PROP_VALUE', payload: { propName: name, value } });
    },
    [host],
  );

  const patchConfig = useCallback(
    (patch: Partial<RetuneExtensionConfig>) => {
      dispatch({ type: 'patchConfig', patch });
      host.post({ type: 'UPDATE_CONFIG', payload: patch });
    },
    [host],
  );

  const selectElement = useCallback(
    (ref: ElementRef | null) => {
      host.post({ type: 'SELECT_ELEMENT', payload: ref });
      if (host.kind === 'standalone') {
        patchStage({ targetElement: ref?.name, targetIndex: ref?.index });
      }
    },
    [host, patchStage],
  );

  const openStage = useCallback(
    (openMode?: StageOpenMode, tab?: StageTabId) => {
      if (tab) patchStage({ activeTab: tab });
      host.post({ type: 'OPEN_STAGE_TAB', payload: { openMode, tab } });
    },
    [host, patchStage],
  );

  const { meta, config, stage, session } = model;
  return {
    hostKind: host.kind,
    meta,
    config,
    stage,
    dirty: isDirty(model),
    canUndo: canUndo(session),
    canRedo: canRedo(session),
    toast,
    problem: model.problem,
    targetLabel: targetLabel(model),
    previewClass: computePreviewClass(model),
    baselinePreviewClass: computePreviewClass(model, stage.baselineClass),
    setClasses,
    undo,
    redo,
    discard,
    sync,
    selectVariant,
    commitVariant,
    setProp,
    patchStage,
    patchConfig,
    selectElement,
    openStage,
    notify,
  };
}
