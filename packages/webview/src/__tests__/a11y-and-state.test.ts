import { describe, it, expect } from 'vitest';
import { contrastGrade, contrastRatio, isSmallTouchTarget, parseCssColor } from '../lib/a11y';
import { getArbitrary, parseArbitraryStyle, resolveSimulatedClasses, setArbitrary } from '../lib/arbitrary-style';

describe('a11y helpers', () => {
  it('parses rgb/rgba and computes WCAG contrast ratio', () => {
    expect(parseCssColor('rgb(255, 255, 255)')).toEqual([255, 255, 255, 1]);
    expect(parseCssColor('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5]);
    const ratio = contrastRatio('rgb(255, 255, 255)', 'rgb(79, 70, 229)')!;
    expect(ratio).toBeGreaterThan(5);
    expect(contrastGrade(ratio)).toBe('AA');
    expect(contrastGrade(8)).toBe('AAA');
  });

  it('flags touch targets smaller than 44x44px', () => {
    expect(isSmallTouchTarget(80, 36)).toBe(true);
    expect(isSmallTouchTarget(88, 44)).toBe(false);
  });
});

describe('pseudo-state simulation and scoped arbitrary editing', () => {
  it('simulates hover and focus utilities over base utilities', () => {
    const resolved = resolveSimulatedClasses('bg-indigo-600 text-white hover:bg-indigo-500 scale-100 hover:scale-105', 'hover');
    expect(resolved).toContain('bg-indigo-500');
    expect(resolved).not.toContain('bg-indigo-600');
    expect(resolved).toContain('hover:scale-105'.replace('hover:', ''));
  });

  it('edits and reads arbitrary tokens scoped to a pseudo-state', () => {
    const initial = 'px-4 bg-[#112233]';
    const next = setArbitrary(initial, 'bg', '#445566', { kind: 'color', state: 'hover' });
    expect(next).toBe('px-4 bg-[#112233] hover:bg-[#445566]');
    expect(getArbitrary(next, 'bg', 'color', 'hover')).toBe('#445566');
    expect(parseArbitraryStyle(next, 'hover').backgroundColor).toBe('#445566');
    expect(parseArbitraryStyle(next, 'none').backgroundColor).toBe('#112233');
  });
});
