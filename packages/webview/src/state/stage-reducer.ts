import type {
  ComponentMetadata,
  FileProblem,
  HostMessage,
  RetuneExtensionConfig,
  StageState,
} from '@retune/core';
import { applyChange, createSession, redo, undo, type EditSession } from '../lib/edit-session';
import { DEFAULT_CONFIG, DEFAULT_STAGE_STATE, DEMO_META, EMPTY_STAGE_STATE } from './demo';

export interface StageModel {
  meta: ComponentMetadata | null;
  stage: StageState;
  config: RetuneExtensionConfig;
  session: EditSession;
  /** True until the next SYNC_STAGE_STATE, which then starts a clean undo history. */
  pendingReset: boolean;
  /** Set while the active file cannot be analysed (syntax error). */
  problem: FileProblem | null;
}

export type StageAction =
  | { type: 'host'; message: HostMessage; now: number }
  | { type: 'setClasses'; classes: string; now: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'patchStage'; patch: Partial<StageState> }
  | { type: 'patchConfig'; patch: Partial<RetuneExtensionConfig> }
  | { type: 'markSynced' };

export function initialModel(kind: 'vscode' | 'standalone'): StageModel {
  const meta = kind === 'standalone' ? DEMO_META : null;
  const stage = kind === 'standalone' ? DEFAULT_STAGE_STATE : EMPTY_STAGE_STATE;
  return {
    meta,
    stage,
    config: DEFAULT_CONFIG,
    session: createSession(stage.harmonicsClass),
    pendingReset: kind === 'vscode',
    problem: null,
  };
}

function reduceHost(model: StageModel, message: HostMessage, now: number): StageModel {
  switch (message.type) {
    case 'SYNC_COMPONENT': {
      const next = message.payload;
      const changed =
        (model.meta === null) !== (next === null) || model.meta?.filePath !== next?.filePath;
      return {
        ...model,
        meta: next,
        session: changed ? createSession(model.stage.harmonicsClass) : model.session,
        pendingReset: changed ? true : model.pendingReset,
      };
    }
    case 'SYNC_STAGE_STATE': {
      const next = message.payload;
      const session =
        !model.pendingReset && sameTarget(model.stage, next)
          ? applyChange(model.session, next.harmonicsClass, now)
          : createSession(next.harmonicsClass);
      return { ...model, stage: next, session, pendingReset: false };
    }
    case 'SYNC_CONFIG':
      return { ...model, config: message.payload };
    case 'SYNC_PROBLEM':
      return { ...model, problem: message.payload };
    default:
      return model;
  }
}

export function reduce(model: StageModel, action: StageAction): StageModel {
  switch (action.type) {
    case 'host':
      return reduceHost(model, action.message, action.now);
    case 'setClasses':
      return {
        ...model,
        stage: { ...model.stage, harmonicsClass: action.classes },
        session: applyChange(model.session, action.classes, action.now),
      };
    case 'undo': {
      const session = undo(model.session);
      return { ...model, session, stage: { ...model.stage, harmonicsClass: session.present } };
    }
    case 'redo': {
      const session = redo(model.session);
      return { ...model, session, stage: { ...model.stage, harmonicsClass: session.present } };
    }
    case 'patchStage':
      return { ...model, stage: { ...model.stage, ...action.patch } };
    case 'patchConfig':
      return { ...model, config: { ...model.config, ...action.patch } };
    case 'markSynced':
      return { ...model, stage: { ...model.stage, baselineClass: model.stage.harmonicsClass } };
  }
}

export function isDirty(model: StageModel): boolean {
  return model.stage.harmonicsClass !== model.stage.baselineClass;
}

export function computePreviewClass(model: StageModel, classes?: string): string {
  const base = classes ?? model.stage.harmonicsClass;
  const groups = model.meta?.cva.variantClasses ?? {};
  const variantParts = Object.entries(model.stage.selectedVariants).map(
    ([group, value]) => groups[group]?.[value] ?? '',
  );
  return [base, ...variantParts].filter(Boolean).join(' ').trim();
}

export function targetLabel(model: StageModel): string {
  if (model.stage.targetElement) return `<${model.stage.targetElement}>`;
  const meta = model.meta;
  if (!meta) return 'Component';
  if (meta.cva.hasCva && meta.cva.cvaIdentifier) return meta.cva.cvaIdentifier;
  if (meta.elements && meta.elements.length > 0) return `<${meta.elements[0].name}>`;
  return meta.componentName;
}

export function sameTarget(a: StageState, b: StageState): boolean {
  return a.targetElement === b.targetElement && (a.targetIndex ?? 0) === (b.targetIndex ?? 0);
}
