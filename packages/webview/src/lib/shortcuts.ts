export type Shortcut = 'undo' | 'redo' | 'sync';

export function matchShortcut(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  inTextField: boolean,
): Shortcut | null {
  if (!(e.ctrlKey || e.metaKey)) return null;
  const key = e.key.toLowerCase();
  if (key === 's') return 'sync';
  if (inTextField) return null;
  if (key === 'z') return e.shiftKey ? 'redo' : 'undo';
  if (key === 'y') return 'redo';
  return null;
}
