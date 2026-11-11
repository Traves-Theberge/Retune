import { describe, it, expect } from 'vitest';
import { clamp, nudgeValue, roundToStep, scrubValue } from '../lib/scrub';

describe('scrub maths', () => {
  it('rounds to the step without float noise', () => {
    expect(roundToStep(0.30000000000000004, 0.05)).toBe(0.3);
    expect(roundToStep(7, 4)).toBe(8);
    expect(clamp(70, 0, 64)).toBe(64);
  });
  it('scrubs one step per two pixels within the range', () => {
    expect(scrubValue(16, 10, 1, 0, 64)).toBe(21);
    expect(scrubValue(16, -100, 1, 0, 64)).toBe(0);
    expect(scrubValue(16, 3, 1, 0, 64)).toBe(17);
    expect(scrubValue(0.5, 4, 0.05, 0, 1)).toBe(0.6);
  });
  it('nudges with shift and alt modifiers', () => {
    expect(nudgeValue(16, 1, 1, 0, 64)).toBe(17);
    expect(nudgeValue(16, 1, 1, 0, 64, { shift: true })).toBe(26);
    expect(nudgeValue(60, 1, 1, 0, 64, { shift: true })).toBe(64);
    expect(nudgeValue(16, -1, 1, 0, 64, { alt: true })).toBe(15.9);
  });
});
