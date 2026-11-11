import { describe, it, expect } from 'vitest';
import { clampMenu, placePopover } from '../lib/placement';

describe('placePopover', () => {
  const pop = { width: 280, height: 200 };
  it('centres below the anchor when there is room', () => {
    expect(placePopover({ left: 400, top: 100, width: 100, height: 40 }, pop, { width: 800, height: 600 }))
      .toEqual({ left: 310, top: 148, side: 'below', maxHeight: 444 });
  });
  it('flips above near the bottom edge', () => {
    expect(placePopover({ left: 400, top: 500, width: 100, height: 40 }, pop, { width: 800, height: 600 }))
      .toEqual({ left: 310, top: 292, side: 'above', maxHeight: 484 });
  });
  it('clamps to the margin at the left edge and in a container narrower than the popover', () => {
    expect(placePopover({ left: 0, top: 100, width: 40, height: 20 }, pop, { width: 800, height: 600 }).left).toBe(8);
    expect(placePopover({ left: 100, top: 100, width: 40, height: 20 }, pop, { width: 250, height: 600 }).left).toBe(8);
  });
  it('picks the roomier side and never goes below 80px or above the margin when nothing fits', () => {
    const p = placePopover({ left: 100, top: 60, width: 40, height: 40 }, pop, { width: 800, height: 150 });
    expect(p.side).toBe('above'); expect(p.maxHeight).toBe(80); expect(p.top).toBe(8);
  });
});

describe('clampMenu', () => {
  it('keeps the menu inside the viewport', () => {
    expect(clampMenu({ x: 790, y: 590 }, { width: 224, height: 300 }, { width: 800, height: 600 })).toEqual({ left: 572, top: 296 });
    expect(clampMenu({ x: 10, y: 20 }, { width: 224, height: 300 }, { width: 800, height: 600 })).toEqual({ left: 10, top: 20 });
    expect(clampMenu({ x: 150, y: 150 }, { width: 224, height: 300 }, { width: 200, height: 200 })).toEqual({ left: 4, top: 4 });
  });
});
