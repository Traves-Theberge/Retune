export type Shortcut = 'undo' | 'redo' | 'sync';

export function matchShortcut(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey?: boolean },
  inTextField: boolean,
): Shortcut | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const key = e.key.toLowerCase();
  if (key === 's') return 'sync';
  if (inTextField) return null;
  if (key === 'z') return e.shiftKey ? 'redo' : 'undo';
  if (key === 'y') return 'redo';
  return null;
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number']);

/** True when the element takes typed text, so the browser owns undo/redo there. */
export function isTextField(el: { tagName?: string; type?: string; isContentEditable?: boolean } | null): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') return !el.type || TEXT_INPUT_TYPES.has(el.type.toLowerCase());
  return false;
}
