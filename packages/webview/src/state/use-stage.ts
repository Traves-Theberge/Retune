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
import { resolveSelectedElementText } from '../lib/preview';
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
  selectCvaTarget?(target: { group: string; key: string } | null): void;
  saveCvaVariant?(group: string, key: string, className?: string): void;
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
    const { baselineClass, baselineText, propValues } = modelRef.current.stage;
    setClasses(baselineClass);
    if (baselineText !== undefined) {
      dispatch({
        type: 'patchStage',
        patch: { propValues: { ...propValues, label: baselineText } },
      });
      host.post({ type: 'UPDATE_PROP_VALUE', payload: { propName: 'label', value: baselineText } });
    }
  }, [host, setClasses]);

  const sync = useCallback(() => {
    const { stage, meta, config } = modelRef.current;
    const labelVal = String(stage.propValues.label ?? '');
    const textChanged = stage.baselineText !== undefined && labelVal !== stage.baselineText;
    const textPayload = textChanged ? { text: labelVal } : {};
    if (host.kind === 'vscode') {
      host.post({ type: 'MUTATE_CLASSES', payload: { className: stage.harmonicsClass, ...textPayload } });
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
        ...(stage.targetIndex !== undefined ? { targetIndex: stage.targetIndex } : {}),
        className: stage.harmonicsClass,
        ...textPayload,
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
      const cur = modelRef.current;
      const txt = resolveSelectedElementText(cur.meta, ref?.name, ref?.index ?? 0);
      if (host.kind === 'vscode') {
        dispatch({
          type: 'patchStage',
          patch: {
            targetElement: ref?.name,
            targetIndex: ref?.index,
            cvaTarget: null,
            baselineText: txt,
            computedStyle: null,
            propValues: { ...cur.stage.propValues, label: txt },
          },
        });
      }
      host.post({ type: 'SELECT_ELEMENT', payload: ref });
      if (host.kind === 'standalone') {
        const cls = ref
          ? cur.meta?.elements?.filter((el) => el.name === ref.name)[ref.index]?.className ?? ''
          : cur.meta?.cva.hasCva
          ? cur.meta.cva.baseClasses
          : cur.meta?.elements?.[0]?.className ?? '';
        patchStage({
          targetElement: ref?.name,
          targetIndex: ref?.index,
          cvaTarget: null,
          harmonicsClass: cls,
          baselineClass: cls,
          baselineText: txt,
          computedStyle: null,
          propValues: { ...cur.stage.propValues, label: txt },
        });
      }
    },
    [host, patchStage],
  );

  const selectCvaTarget = useCallback(
    (target: { group: string; key: string } | null) => {
      host.post({ type: 'SELECT_CVA_TARGET', payload: target });
      if (host.kind === 'standalone') {
        const meta = modelRef.current.meta;
        const cls = target
          ? meta?.cva.variantClasses?.[target.group]?.[target.key] ?? ''
          : meta?.cva.baseClasses ?? '';
        patchStage({
          targetElement: undefined,
          targetIndex: undefined,
          cvaTarget: target,
          selectedVariants: target
            ? { ...modelRef.current.stage.selectedVariants, [target.group]: target.key }
            : modelRef.current.stage.selectedVariants,
          harmonicsClass: cls,
          baselineClass: cls,
        });
      }
    },
    [host, patchStage],
  );

  const saveCvaVariant = useCallback(
    (group: string, key: string, className?: string) => {
      const classes = className ?? modelRef.current.stage.harmonicsClass;
      if (host.kind === 'vscode') {
        host.post({
          type: 'MUTATE_CVA_VARIANT',
          payload: { variantGroup: group, variantKey: key, className: classes },
        });
        return;
      }
      const curMeta = modelRef.current.meta;
      if (!curMeta) return;
      const existingOpts = curMeta.cva.variants[group] ?? [];
      const nextOpts = existingOpts.includes(key) ? existingOpts : [...existingOpts, key];
      const nextMeta = {
        ...curMeta,
        cva: {
          ...curMeta.cva,
          variants: { ...curMeta.cva.variants, [group]: nextOpts },
          variantClasses: {
            ...curMeta.cva.variantClasses,
            [group]: { ...(curMeta.cva.variantClasses?.[group] ?? {}), [key]: classes },
          },
        },
      };
      dispatch({ type: 'host', now: Date.now(), message: { type: 'SYNC_COMPONENT', payload: nextMeta } });
      patchStage({
        cvaTarget: { group, key },
        selectedVariants: { ...modelRef.current.stage.selectedVariants, [group]: key },
        harmonicsClass: classes,
        baselineClass: classes,
      });
      notify(`Saved variant ${group}.${key}`, 'success');
    },
    [host, notify, patchStage],
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
    selectCvaTarget,
    saveCvaVariant,
    openStage,
    notify,
  };
}
