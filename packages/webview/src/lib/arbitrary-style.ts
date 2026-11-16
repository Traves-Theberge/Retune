import type { CSSProperties } from 'react';
import type { PseudoStateMode } from '@retune/core';

/**
 * Tailwind arbitrary values (e.g. `px-[14px]`, `bg-[rgb(79_70_229)]`) are generated at runtime by the
 * Retune inspector, but the webview's compiled CSS can't contain them. The class string stays
 * the single source of truth: we parse arbitrary classes (and active pseudo-state modifiers)
 * and mirror them as inline styles in the preview, writing the real Tailwind class into the source file on sync.
 */

const MODIFIED_TOKEN = /^((?:hover|focus-visible|focus|active):)?(.+)$/;
const ARBITRARY = /^([a-z-]+)-\[(.+)\]$/;
const isColor = (v: string) => /^(#|rgb|hsl|oklch|var\()/i.test(v);

export function splitClasses(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

export function statePrefix(mode: PseudoStateMode = 'none'): string {
  if (mode === 'hover') return 'hover:';
  if (mode === 'focus') return 'focus-visible:';
  if (mode === 'active') return 'active:';
  return '';
}

function matchesState(modifier: string | undefined, activeState: PseudoStateMode): boolean {
  if (!modifier) return false;
  if (activeState === 'hover') return modifier === 'hover:';
  if (activeState === 'focus') return modifier === 'focus-visible:' || modifier === 'focus:';
  if (activeState === 'active') return modifier === 'active:';
  return false;
}

function utilityFamily(utility: string): string {
  if (/^p-\[|^p-[\d.]/.test(utility)) return 'p';
  if (/^px-/.test(utility)) return 'px';
  if (/^py-/.test(utility)) return 'py';
  if (/^gap-/.test(utility)) return 'gap';
  if (/^w-/.test(utility)) return 'w';
  if (/^h-/.test(utility)) return 'h';
  if (/^rounded(?:$|-)/.test(utility)) return 'rounded';
  if (/^shadow(?:$|-)/.test(utility)) return 'shadow';
  if (/^opacity-/.test(utility)) return 'opacity';
  if (/^tracking-/.test(utility)) return 'tracking';
  if (/^font-(?:normal|medium|semibold|bold)$/.test(utility)) return 'font-weight';
  if (/^bg-/.test(utility)) return 'bg';
  if (/^text-(?:\[|xs$|sm$|base$|lg$|xl$)/.test(utility)) return 'text-size';
  if (/^text-/.test(utility)) return 'text-color';
  if (/^border-\[(?:#|rgb|hsl|oklch|var)/.test(utility) || /^border-(?:zinc|indigo|rose|emerald|amber|sky|violet|white|black|transparent)/.test(utility)) {
    return 'border-color';
  }
  if (/^border(?:$|-)/.test(utility)) return 'border-width';
  return utility;
}

/**
 * When a pseudo-state is being simulated (`hover`, `focus`, `active`), promote matching
 * state-prefixed utility tokens over their unprefixed counterparts so standard Tailwind
 * utilities preview immediately on the Stage without pointer hover.
 */
export function resolveSimulatedClasses(
  classes: string,
  activeState: PseudoStateMode = 'none'
): string {
  const tokens = splitClasses(classes);
  if (activeState === 'none') return tokens.join(' ');

  const simulated = new Map<string, string>();
  const passthrough: string[] = [];

  for (const token of tokens) {
    const m = MODIFIED_TOKEN.exec(token);
    if (!m) continue;
    const [, mod, core] = m;
    if (!mod) {
      passthrough.push(core);
    } else if (matchesState(mod, activeState)) {
      simulated.set(utilityFamily(core), core);
    }
  }

  if (simulated.size === 0) return tokens.join(' ');
  const baseKept = passthrough.filter((core) => !simulated.has(utilityFamily(core)));
  return [...baseKept, ...simulated.values()].join(' ');
}

function applyArbitraryToken(style: Record<string, string>, token: string): void {
  const m = ARBITRARY.exec(token);
  if (!m) return;
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

export function parseArbitraryStyle(
  classes: string,
  activeState: PseudoStateMode = 'none'
): CSSProperties {
  const style: Record<string, string> = {};
  const tokens = splitClasses(classes);

  // First pass: base unprefixed arbitrary values
  for (const token of tokens) {
    if (!token.includes(':')) applyArbitraryToken(style, token);
  }
  // Second pass: active simulated pseudo-state overrides
  if (activeState !== 'none') {
    for (const token of tokens) {
      const m = MODIFIED_TOKEN.exec(token);
      if (m && matchesState(m[1], activeState)) {
        applyArbitraryToken(style, m[2]);
      }
    }
  }
  return style as CSSProperties;
}

/** Read the value of an arbitrary class for `prefix` (optionally scoped to a pseudo-state). */
export function getArbitrary(
  classes: string,
  prefix: string,
  kind?: 'color' | 'length',
  state: PseudoStateMode = 'none'
): string | undefined {
  const wantedMod = statePrefix(state);
  for (const token of splitClasses(classes)) {
    const modMatch = MODIFIED_TOKEN.exec(token);
    if (!modMatch) continue;
    const mod = modMatch[1] ?? '';
    if (mod !== wantedMod && !(state === 'focus' && mod === 'focus:')) continue;
    const m = ARBITRARY.exec(modMatch[2]);
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
 * within the same state modifier (`none`, `hover:`, `focus-visible:`, `active:`).
 */
export function setArbitrary(
  classes: string,
  prefix: string,
  value: string | null,
  options: { kind?: 'color' | 'length'; conflicts?: string[]; state?: PseudoStateMode } = {}
): string {
  const { kind, conflicts = [], state = 'none' } = options;
  const wantedMod = statePrefix(state);
  const kept = splitClasses(classes).filter((token) => {
    const modMatch = MODIFIED_TOKEN.exec(token);
    if (!modMatch) return true;
    const mod = modMatch[1] ?? '';
    const core = modMatch[2];
    const sameState = mod === wantedMod || (state === 'focus' && mod === 'focus:');
    if (!sameState) return true;

    if (conflicts.includes(core)) return value === null;
    const m = ARBITRARY.exec(core);
    if (!m || m[1] !== prefix) return true;
    if (kind === 'color' && !isColor(m[2])) return true;
    if (kind === 'length' && isColor(m[2])) return true;
    return false;
  });
  if (value !== null && value !== '') {
    kept.push(`${wantedMod}${prefix}-[${value.replace(/\s+/g, '_')}]`);
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
