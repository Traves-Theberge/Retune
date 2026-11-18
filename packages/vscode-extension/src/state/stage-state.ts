import {
  applyEdits,
  computeClassNameEdit,
  computeCvaBaseEdit,
  computeCvaVariantEdit,
  computeDefaultVariantEdit,
  computeTextEdit,
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
  cvaTarget?: { group: string; key: string } | null;
}

export type MutationPlan =
  | { ok: true; edit: TextEdit | null; edits?: TextEdit[]; message: string }
  | { ok: false; message: string };

/** Nth element whose name === name (exact, case-sensitive). */
export function resolveTarget(elements: ElementInfo[], name?: string, index = 0): ElementInfo | undefined {
  if (!name) return undefined;
  return elements.filter((el) => el.name === name)[index];
}

export function findElementAtOffset(
  elements: ElementInfo[],
  offset: number
): { targetElement: string; targetIndex: number } | undefined {
  const containing = elements
    .filter((el) => el.start <= offset && offset <= el.end)
    .sort((a, b) => a.end - a.start - (b.end - b.start));
  const chosen = containing[0];
  if (!chosen) return undefined;
  const sameTag = elements.filter((el) => el.name === chosen.name);
  const idx = sameTag.indexOf(chosen);
  return { targetElement: chosen.name, targetIndex: idx >= 0 ? idx : 0 };
}

export function sameTargetRef(a: TargetRef, b: TargetRef): boolean {
  return (
    a.targetElement === b.targetElement &&
    (a.targetIndex ?? 0) === (b.targetIndex ?? 0) &&
    (a.cvaTarget?.group ?? null) === (b.cvaTarget?.group ?? null) &&
    (a.cvaTarget?.key ?? null) === (b.cvaTarget?.key ?? null)
  );
}

/** Returns {} when name is missing or matches nothing; otherwise { targetElement: name, targetIndex } with index clamped to the last match. */
export function normalizeTarget(elements: ElementInfo[], name?: string, index?: number): TargetRef {
  if (!name) return {};
  const count = elements.filter((el) => el.name === name).length;
  if (count === 0) return {};
  const targetIndex = Math.min(Math.max(index ?? 0, 0), count - 1);
  return { targetElement: name, targetIndex };
}

/** Classes the file holds for the target; cvaTarget -> variantClasses, element -> element className, root -> cva base or first element. */
export function fileClassFor(cva: CvaMetadata, elements: ElementInfo[], target: TargetRef): string {
  if (target.cvaTarget) {
    return cva.variantClasses?.[target.cvaTarget.group]?.[target.cvaTarget.key] ?? '';
  }
  if (target.targetElement) {
    return resolveTarget(elements, target.targetElement, target.targetIndex)?.className ?? '';
  }
  if (cva.hasCva) return cva.baseClasses;
  return elements[0]?.className ?? '';
}

export function fileTextFor(elements: ElementInfo[], target: TargetRef): string {
  if (target.targetElement) {
    return resolveTarget(elements, target.targetElement, target.targetIndex)?.text ?? '';
  }
  return elements[0]?.text ?? '';
}

export function reconcile(
  state: StageState,
  fileClass: string,
  targetChanged: boolean,
  fileText?: string
): StageState {
  const next: StageState =
    targetChanged || state.harmonicsClass === state.baselineClass
      ? { ...state, harmonicsClass: fileClass, baselineClass: fileClass }
      : { ...state, baselineClass: fileClass };

  if (targetChanged) {
    next.computedStyle = null;
    next.matchedCssRules = undefined;
  }

  if (fileText !== undefined) {
    const labelClean = String(state.propValues.label ?? '') === (state.baselineText ?? '');
    next.baselineText = fileText;
    if (targetChanged || labelClean) {
      next.propValues = { ...state.propValues, label: fileText };
    }
  }

  return next;
}

function noop(): MutationPlan {
  return { ok: true, edit: null, message: 'Already up to date' };
}

function finish(source: string, edit: TextEdit | null): MutationPlan {
  if (!edit) return { ok: false, message: 'No JSX element found' };
  if (applyEdits(source, edit) === source) return noop();
  return { ok: true, edit, message: 'Synced to code' };
}

export function planCvaVariantMutation(
  source: string,
  group: string,
  key: string,
  className: string
): MutationPlan {
  try {
    const edit = computeCvaVariantEdit(source, group, key, className);
    if (!edit) return { ok: false, message: `Variant "${group}.${key}" could not be edited` };
    if (applyEdits(source, edit) === source) return noop();
    return { ok: true, edit, message: `Saved ${group}.${key} to code` };
  } catch {
    return { ok: false, message: 'Could not parse file' };
  }
}

export function planClassMutation(
  source: string,
  target: TargetRef,
  className: string,
  newText?: string
): MutationPlan {
  try {
    if (target.cvaTarget) {
      return planCvaVariantMutation(source, target.cvaTarget.group, target.cvaTarget.key, className);
    }

    const elements = listElements(source);
    let classEdit: TextEdit | null = null;
    let textTarget: { offset?: number } = {};

    if (target.targetElement) {
      const el = resolveTarget(elements, target.targetElement, target.targetIndex);
      if (!el) return { ok: false, message: `No <${target.targetElement}> element found` };
      textTarget = { offset: el.start };
      classEdit = computeClassNameEdit(source, textTarget, className);
    } else if (extractCvaMetadata(source).hasCva) {
      classEdit = computeCvaBaseEdit(source, className);
      if (!classEdit && newText === undefined) {
        return { ok: false, message: 'cva() base classes are not a plain string' };
      }
    } else {
      if (elements.length === 0) return { ok: false, message: 'No JSX element found' };
      classEdit = computeClassNameEdit(source, {}, className);
    }

    const classChanged = Boolean(classEdit && applyEdits(source, classEdit) !== source);
    const activeClassEdit = classChanged ? classEdit : null;

    if (newText === undefined) {
      return finish(source, classEdit);
    }

    const textEdit = computeTextEdit(source, textTarget, newText);
    const textChanged = Boolean(textEdit && applyEdits(source, textEdit) !== source);
    const activeTextEdit = textChanged ? textEdit : null;

    if (!activeClassEdit && !activeTextEdit) return noop();
    if (activeClassEdit && !activeTextEdit) return { ok: true, edit: activeClassEdit, message: 'Synced to code' };
    if (!activeClassEdit && activeTextEdit) return { ok: true, edit: activeTextEdit, message: 'Synced to code' };

    const a = activeClassEdit!;
    const b = activeTextEdit!;
    if (a.start === a.end && b.start === b.end && a.start === b.start) {
      return {
        ok: true,
        edit: { start: a.start, end: a.end, text: `${a.text}${b.text}` },
        message: 'Synced to code',
      };
    }
    if (a.end <= b.start || b.end <= a.start) {
      return { ok: true, edit: a, edits: [a, b], message: 'Synced to code' };
    }
    const intermediate = applyEdits(source, a);
    const nextTextTarget = target.targetElement
      ? { offset: resolveTarget(listElements(intermediate), target.targetElement, target.targetIndex)?.start }
      : {};
    const seqText = computeTextEdit(intermediate, nextTextTarget, newText);
    const combined = seqText ? applyEdits(intermediate, seqText) : intermediate;
    return { ok: true, edit: { start: 0, end: source.length, text: combined }, message: 'Synced to code' };
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
