import { describe, it, expect } from 'vitest';
import { isTextField, matchShortcut } from '../lib/shortcuts';
const k = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) =>
  ({ key, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });

describe('matchShortcut', () => {
  it('maps the editing shortcuts', () => {
    expect(matchShortcut(k('s', { ctrlKey: true }), false)).toBe('sync');
    expect(matchShortcut(k('S', { metaKey: true }), true)).toBe('sync');
    expect(matchShortcut(k('z', { ctrlKey: true }), false)).toBe('undo');
    expect(matchShortcut(k('Z', { ctrlKey: true, shiftKey: true }), false)).toBe('redo');
    expect(matchShortcut(k('y', { metaKey: true }), false)).toBe('redo');
  });
  it('leaves undo/redo to text fields and ignores unmodified keys', () => {
    expect(matchShortcut(k('z', { ctrlKey: true }), true)).toBeNull();
    expect(matchShortcut(k('y', { ctrlKey: true }), true)).toBeNull();
    expect(matchShortcut(k('s'), false)).toBeNull();
    expect(matchShortcut(k('a', { ctrlKey: true }), false)).toBeNull();
  });
  it('ignores AltGr combinations', () => {
    expect(matchShortcut({ ...k('s', { ctrlKey: true }), altKey: true }, false)).toBeNull();
  });
});

describe('isTextField', () => {
  it('is false for non-text inputs and null', () => {
    expect(isTextField({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(isTextField({ tagName: 'INPUT', type: 'color' })).toBe(false);
    expect(isTextField({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTextField({ tagName: 'BUTTON' })).toBe(false);
    expect(isTextField(null)).toBe(false);
  });
  it('is true for text-like inputs, textarea and contentEditable', () => {
    expect(isTextField({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTextField({ tagName: 'INPUT', type: 'number' })).toBe(true);
    expect(isTextField({ tagName: 'INPUT' })).toBe(true);
    expect(isTextField({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextField({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });
});
