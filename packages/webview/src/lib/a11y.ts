/**
 * Accessibility helpers computed from resolved runtime colors and element geometry.
 * Avoids static palette tables so contrast reflects actual computed styles on the canvas.
 */

export type Rgba = [number, number, number, number];

export function parseCssColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  if (!s || s === 'none' || s === 'transparent') return [0, 0, 0, 0];

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) {
    const raw = hex[1];
    if (raw.length === 3) {
      return [
        parseInt(raw[0] + raw[0], 16),
        parseInt(raw[1] + raw[1], 16),
        parseInt(raw[2] + raw[2], 16),
        1,
      ];
    }
    return [
      parseInt(raw.slice(0, 2), 16),
      parseInt(raw.slice(2, 4), 16),
      parseInt(raw.slice(4, 6), 16),
      1,
    ];
  }

  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (rgb) {
    let alpha = 1;
    if (rgb[4] !== undefined) {
      alpha = rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    }
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Math.max(0, Math.min(1, alpha))];
  }

  return null;
}

export function blendOver(fg: Rgba, bg: [number, number, number]): [number, number, number] {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
  ];
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fgColor: string, bgColor: string, backdrop: [number, number, number] = [18, 18, 22]): number | null {
  const fg = parseCssColor(fgColor);
  const bg = parseCssColor(bgColor);
  if (!fg || !bg) return null;

  const resolvedBg = bg[3] < 1 ? blendOver(bg, backdrop) : ([bg[0], bg[1], bg[2]] as [number, number, number]);
  const resolvedFg = fg[3] < 1 ? blendOver(fg, resolvedBg) : ([fg[0], fg[1], fg[2]] as [number, number, number]);

  const l1 = relativeLuminance(resolvedFg);
  const l2 = relativeLuminance(resolvedBg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 10) / 10;
}

export function contrastGrade(ratio: number): 'AAA' | 'AA' | 'AA Large' | 'Low' {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Low';
}

export function isSmallTouchTarget(width: number, height: number): boolean {
  return width > 0 && height > 0 && (width < 44 || height < 44);
}
