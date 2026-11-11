import { describe, it, expect } from 'vitest';
import { previewTag } from '../lib/preview';

describe('previewTag', () => {
  it('uses safe intrinsic targets and falls back by component name', () => {
    expect(previewTag('span')).toBe('span');
    expect(previewTag('h2', 'Card')).toBe('h2');
    expect(previewTag('Card', 'Card')).toBe('div');
    expect(previewTag(undefined, 'IconButton')).toBe('button');
    expect(previewTag('script')).toBe('div');
    expect(previewTag('input', 'Field')).toBe('div');
    expect(previewTag()).toBe('div');
  });
});
