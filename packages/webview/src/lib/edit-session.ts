export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 400;

export interface EditSession {
  past: string[];
  present: string;
  future: string[];
  lastChangeAt: number;
}

export function createSession(classes: string): EditSession {
  return { past: [], present: classes, future: [], lastChangeAt: -Infinity };
}

export function applyChange(s: EditSession, next: string, now: number): EditSession {
  if (next === s.present) return s;
  const coalesce = now - s.lastChangeAt < COALESCE_MS;
  const past = coalesce ? s.past : [...s.past, s.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastChangeAt: now };
}

export function undo(s: EditSession): EditSession {
  if (s.past.length === 0) return s;
  const previous = s.past[s.past.length - 1];
  return {
    past: s.past.slice(0, -1),
    present: previous,
    future: [s.present, ...s.future],
    lastChangeAt: -Infinity,
  };
}

export function redo(s: EditSession): EditSession {
  if (s.future.length === 0) return s;
  const [next, ...rest] = s.future;
  return {
    past: [...s.past, s.present].slice(-HISTORY_LIMIT),
    present: next,
    future: rest,
    lastChangeAt: -Infinity,
  };
}

export function canUndo(s: EditSession): boolean {
  return s.past.length > 0;
}

export function canRedo(s: EditSession): boolean {
  return s.future.length > 0;
}
