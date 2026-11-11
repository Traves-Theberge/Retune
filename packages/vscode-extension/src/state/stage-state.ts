import {
  applyEdits,
  computeClassNameEdit,
  computeCvaBaseEdit,
  computeDefaultVariantEdit,
  extractCvaMetadata,
  listElements,
  type CvaMetadata,
  type ElementInfo,
  type StageState,
  type TextEdit,
} from '@retune/core';

/** Pure stage-state logic. Must not import `vscode`. */

export interface TargetRef {
  targetElement?: string;
  targetIndex?: number;
}

export type MutationPlan =
  | { ok: true; edit: TextEdit | null; message: string }
  | { ok: false; message: string };

/** Nth element whose name === name (exact, case-sensitive). */
export function resolveTarget(elements: ElementInfo[], name?: string, index = 0): ElementInfo | undefined {
  if (!name) return undefined;
  return elements.filter((el) => el.name === name)[index];
}

export function sameTargetRef(a: TargetRef, b: TargetRef): boolean {
  return a.targetElement === b.targetElement && (a.targetIndex ?? 0) === (b.targetIndex ?? 0);
}

/** Returns {} when name is missing or matches nothing; otherwise { targetElement: name, targetIndex } with index clamped to the last match. */
export function normalizeTarget(elements: ElementInfo[], name?: string, index?: number): TargetRef {
  if (!name) return {};
  const count = elements.filter((el) => el.name === name).length;
  if (count === 0) return {};
  const targetIndex = Math.min(Math.max(index ?? 0, 0), count - 1);
  return { targetElement: name, targetIndex };
}

/** Classes the file holds for the target; root = cva base when hasCva, else first element's className, else ''. */
export function fileClassFor(cva: CvaMetadata, elements: ElementInfo[], target: TargetRef): string {
  if (target.targetElement) {
    return resolveTarget(elements, target.targetElement, target.targetIndex)?.className ?? '';
  }
  if (cva.hasCva) return cva.baseClasses;
  return elements[0]?.className ?? '';
}

export function reconcile(state: StageState, fileClass: string, targetChanged: boolean): StageState {
  if (targetChanged || state.harmonicsClass === state.baselineClass) {
    return { ...state, harmonicsClass: fileClass, baselineClass: fileClass };
  }
  return { ...state, baselineClass: fileClass };
}

function noop(): MutationPlan {
  return { ok: true, edit: null, message: 'Already up to date' };
}

function finish(source: string, edit: TextEdit | null): MutationPlan {
  if (!edit) return { ok: false, message: 'No JSX element found' };
  if (applyEdits(source, edit) === source) return noop();
  return { ok: true, edit, message: 'Synced to code' };
}

export function planClassMutation(source: string, target: TargetRef, className: string): MutationPlan {
  try {
    if (target.targetElement) {
      const el = resolveTarget(listElements(source), target.targetElement, target.targetIndex);
      if (!el) return { ok: false, message: `No <${target.targetElement}> element found` };
      return finish(source, computeClassNameEdit(source, { offset: el.start }, className));
    }
    if (extractCvaMetadata(source).hasCva) {
      const edit = computeCvaBaseEdit(source, className);
      if (!edit) return { ok: false, message: 'cva() base classes are not a plain string' };
      return finish(source, edit);
    }
    if (listElements(source).length === 0) return { ok: false, message: 'No JSX element found' };
    return finish(source, computeClassNameEdit(source, {}, className));
  } catch {
    return { ok: false, message: 'Could not parse file' };
  }
}

export function planVariantMutation(source: string, group: string, value: string): MutationPlan {
  try {
    const edit = computeDefaultVariantEdit(source, group, value);
    if (!edit) return { ok: false, message: 'No defaultVariants block found' };
    if (applyEdits(source, edit) === source) return noop();
    return { ok: true, edit, message: `Default ${group} set to ${value}` };
  } catch {
    return { ok: false, message: 'Could not parse file' };
  }
}
