import { describe, it, expect } from 'vitest';
import { HISTORY_LIMIT, applyChange, canRedo, canUndo, createSession, redo, undo } from '../lib/edit-session';

describe('edit session', () => {
  it('coalesces a burst into one undo step', () => {
    let s = createSession('a');
    s = applyChange(s, 'b', 1000); s = applyChange(s, 'c', 1100); s = applyChange(s, 'd', 1200);
    expect(s.past).toEqual(['a']); expect(s.present).toBe('d');
    s = undo(s); expect(s.present).toBe('a'); expect(s.future).toEqual(['d']); expect(canUndo(s)).toBe(false);
    s = redo(s); expect(s.present).toBe('d'); expect(canRedo(s)).toBe(false);
  });
  it('separates changes that are far apart and clears redo on a new change', () => {
    let s = createSession('a');
    s = applyChange(s, 'b', 1000); s = applyChange(s, 'c', 2000);
    expect(s.past).toEqual(['a', 'b']);
    s = undo(s); s = applyChange(s, 'x', 2050);
    expect(s.past).toEqual(['a', 'b']); expect(s.present).toBe('x'); expect(s.future).toEqual([]);
  });
  it('returns the same object for a no-op and caps history', () => {
    let s = createSession('a');
    expect(applyChange(s, 'a', 5)).toBe(s);
    for (let i = 0; i < 150; i++) s = applyChange(s, `c${i}`, i * 1000);
    expect(s.past.length).toBe(HISTORY_LIMIT);
    expect(undo(createSession('a')).present).toBe('a');
  });
});
