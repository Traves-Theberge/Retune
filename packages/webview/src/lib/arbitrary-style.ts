import type { CSSProperties } from 'react';

/**
 * Tailwind arbitrary values (e.g. `px-[14px]`, `bg-[#4f46e5]`) are generated at runtime by the
 * Retune inspector, but the webview's compiled CSS can't contain them. The class string stays
 * the single source of truth: we parse arbitrary classes and mirror them as inline styles in
 * the preview, and write the real Tailwind class into the source file on sync.
 */

const ARBITRARY = /^([a-z-]+)-\[(.+)\]$/;
const isColor = (v: string) => /^(#|rgb|hsl|oklch|var\()/i.test(v);

export function splitClasses(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

export function parseArbitraryStyle(classes: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const token of splitClasses(classes)) {
    const m = ARBITRARY.exec(token);
    if (!m) continue;
    const [, prefix, raw] = m;
    const v = raw.replace(/_/g, ' ');
    switch (prefix) {
      case 'p': style.padding = v; break;
      case 'px': style.paddingLeft = v; style.paddingRight = v; break;
      case 'py': style.paddingTop = v; style.paddingBottom = v; break;
      case 'pt': style.paddingTop = v; break;
      case 'pb': style.paddingBottom = v; break;
      case 'pl': style.paddingLeft = v; break;
      case 'pr': style.paddingRight = v; break;
      case 'gap': style.gap = v; break;
      case 'w': style.width = v; break;
      case 'h': style.height = v; break;
      case 'rounded': style.borderRadius = v; break;
      case 'opacity': style.opacity = v; break;
      case 'tracking': style.letterSpacing = v; break;
      case 'leading': style.lineHeight = v; break;
      case 'bg': style.backgroundColor = v; break;
      case 'text':
        if (isColor(v)) style.color = v; else style.fontSize = v;
        break;
      case 'border':
        if (isColor(v)) { style.borderColor = v; style.borderStyle = 'solid'; }
        else { style.borderWidth = v; style.borderStyle = 'solid'; }
        break;
      default: break;
    }
  }
  return style as CSSProperties;
}

/** Read the value of an arbitrary class for `prefix` (optionally only colors or only lengths). */
export function getArbitrary(
  classes: string,
  prefix: string,
  kind?: 'color' | 'length'
): string | undefined {
  for (const token of splitClasses(classes)) {
    const m = ARBITRARY.exec(token);
    if (!m || m[1] !== prefix) continue;
    const v = m[2];
    if (kind === 'color' && !isColor(v)) continue;
    if (kind === 'length' && isColor(v)) continue;
    return v;
  }
  return undefined;
}

/**
 * Replace/remove the arbitrary class for `prefix`. Also strips preset tokens that conflict
 * (passed as `conflicts`) so the written file never contains contradictory utilities.
 */
export function setArbitrary(
  classes: string,
  prefix: string,
  value: string | null,
  options: { kind?: 'color' | 'length'; conflicts?: string[] } = {}
): string {
  const { kind, conflicts = [] } = options;
  const kept = splitClasses(classes).filter((token) => {
    if (conflicts.includes(token)) return value === null;
    const m = ARBITRARY.exec(token);
    if (!m || m[1] !== prefix) return true;
    if (kind === 'color' && !isColor(m[2])) return true;
    if (kind === 'length' && isColor(m[2])) return true;
    return false;
  });
  if (value !== null && value !== '') {
    kept.push(`${prefix}-[${value.replace(/\s+/g, '_')}]`);
  }
  return kept.join(' ');
}

export function toggleClass(classes: string, token: string): string {
  const tokens = splitClasses(classes);
  return tokens.includes(token)
    ? tokens.filter((t) => t !== token).join(' ')
    : [...tokens, token].join(' ');
}

export function removeClass(classes: string, token: string): string {
  return splitClasses(classes).filter((t) => t !== token).join(' ');
}

export function addClasses(classes: string, input: string): string {
  const existing = splitClasses(classes);
  for (const t of splitClasses(input)) {
    if (!existing.includes(t)) existing.push(t);
  }
  return existing.join(' ');
}
