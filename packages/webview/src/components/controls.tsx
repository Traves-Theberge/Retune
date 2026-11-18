import { useRef } from 'react';
import type { ComputedElementStyle, PseudoStateMode } from '@retune/core';
import { getArbitrary, setArbitrary, splitClasses, statePrefix } from '../lib/arbitrary-style';
import { scrubValue } from '../lib/scrub';
import { ColorField, Row, ScrubInput, Segmented } from './ui';

/* ---------- Token presets shared by the sidebar, modals and context menu ---------- */

export const PX = ['px-2', 'px-3', 'px-4', 'px-6', 'px-8'];
export const PY = ['py-1', 'py-1.5', 'py-2', 'py-2.5', 'py-3'];
export const GAP = ['gap-1', 'gap-1.5', 'gap-2', 'gap-3', 'gap-4'];
export const HEIGHT = ['h-7', 'h-8', 'h-9', 'h-10', 'h-11', 'h-12'];
export const TEXT_SIZE = ['text-xs', 'text-sm', 'text-base', 'text-lg'];
export const WEIGHT = ['font-normal', 'font-medium', 'font-semibold', 'font-bold'];
export const RADIUS = ['rounded-none', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-full'];
export const SHADOW = ['shadow-none', 'shadow-sm', 'shadow', 'shadow-lg', 'shadow-xl'];
export const BG_PRESETS = [
  { token: 'bg-indigo-600', name: 'Indigo', color: '#4f46e5' },
  { token: 'bg-zinc-800', name: 'Graphite', color: '#27272a' },
  { token: 'bg-emerald-600', name: 'Emerald', color: '#059669' },
  { token: 'bg-rose-600', name: 'Rose', color: '#e11d48' },
  { token: 'bg-sky-600', name: 'Sky', color: '#0284c7' },
  { token: 'bg-violet-600', name: 'Violet', color: '#7c3aed' },
  { token: 'bg-amber-500', name: 'Amber', color: '#f59e0b' },
  { token: 'bg-white', name: 'White', color: '#ffffff' },
  { token: 'bg-transparent', name: 'Transparent', color: 'transparent' },
];
export const BG_TOKENS = BG_PRESETS.map((p) => p.token);

const SCALE_LENGTHS: Record<string, string> = {
  'px-2': '8px', 'px-3': '12px', 'px-4': '16px', 'px-6': '24px', 'px-8': '32px',
  'py-1': '4px', 'py-1.5': '6px', 'py-2': '8px', 'py-2.5': '10px', 'py-3': '12px',
  'gap-1': '4px', 'gap-1.5': '6px', 'gap-2': '8px', 'gap-3': '12px', 'gap-4': '16px',
  'h-7': '28px', 'h-8': '32px', 'h-9': '36px', 'h-10': '40px', 'h-11': '44px', 'h-12': '48px',
  'text-xs': '12px', 'text-sm': '14px', 'text-base': '16px', 'text-lg': '18px',
  'rounded-none': '0px', 'rounded': '4px', 'rounded-md': '6px', 'rounded-lg': '8px',
  'rounded-xl': '12px', 'rounded-full': '999px',
};

const SCALE_COLORS: Record<string, string> = {
  ...Object.fromEntries(BG_PRESETS.filter((p) => p.color.startsWith('#')).map((p) => [p.token, p.color])),
  'text-white': '#ffffff',
  'text-zinc-100': '#f4f4f5',
  'text-zinc-300': '#d4d4d8',
  'border-zinc-700': '#3f3f46',
};

function weightPresetFromComputed(weight?: string): string | undefined {
  const n = weight ? parseInt(weight, 10) : NaN;
  if (Number.isNaN(n)) return undefined;
  if (n >= 700) return 'font-bold';
  if (n >= 600) return 'font-semibold';
  if (n >= 500) return 'font-medium';
  return 'font-normal';
}

function radiusPresetFromComputed(rounded?: string): string | undefined {
  const n = rounded ? parseFloat(rounded) : NaN;
  if (Number.isNaN(n)) return undefined;
  if (n <= 0) return 'rounded-none';
  if (n >= 100) return 'rounded-full';
  if (n >= 11) return 'rounded-xl';
  if (n >= 8) return 'rounded-lg';
  if (n >= 5) return 'rounded-md';
  return 'rounded';
}

function shadowPresetFromComputed(shadow?: string): string | undefined {
  if (!shadow) return undefined;
  if (shadow === 'none') return 'shadow-none';
  if (shadow === 'md') return 'shadow';
  return SHADOW.includes(shadow) ? shadow : undefined;
}

/* ---------- Scrubbable length row ---------- */

export function LengthRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onClear,
}: {
  label: string;
  value: string | undefined;
  min: number;
  max: number;
  step?: number;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const start = useRef(min);
  return (
    <Row
      label={label}
      onScrubStart={() => {
        const n = value !== undefined ? parseFloat(value) : NaN;
        start.current = Number.isNaN(n) ? min : n;
      }}
      onScrub={(dx) => onChange(`${scrubValue(start.current, dx, step, min, max)}px`)}
    >
      <ScrubInput label={label} value={value} min={min} max={max} step={step} onChange={onChange} onClear={onClear} />
    </Row>
  );
}

/* ---------- Class editor: one implementation behind sidebar, modals and menus ---------- */

export function createClassEditor(
  classes: string,
  set: (next: string) => void,
  state: PseudoStateMode = 'none',
  computed?: ComputedElementStyle | null
) {
  const mod = statePrefix(state);
  const tokens = splitClasses(classes);
  const prefixed = (group: string[]) => group.map((t) => `${mod}${t}`);

  const stateCores = () =>
    tokens
      .filter((tok) => (mod === '' ? !tok.includes(':') : tok.startsWith(mod)))
      .map((tok) => (mod ? tok.slice(mod.length) : tok));

  const activePreset = (group: string[]) => {
    const targets = prefixed(group);
    const match = tokens.find((t) => targets.includes(t));
    return match ? match.slice(mod.length) : undefined;
  };

  const pickPreset = (group: string[], token: string) => {
    const targets = prefixed(group);
    const filtered = tokens.filter((t) => !targets.includes(t));
    set([...filtered, `${mod}${token}`].join(' '));
  };

  const resolveScaleLength = (prefix: string): string | undefined => {
    for (const core of stateCores()) {
      if (core !== prefix && !core.startsWith(`${prefix}-`)) continue;
      if (SCALE_LENGTHS[core]) return SCALE_LENGTHS[core];
      if (prefix === 'border') {
        if (core === 'border') return '1px';
        const bw = /^border-(\d+)$/.exec(core);
        if (bw) return `${bw[1]}px`;
      }
      const sp = /^(?:px|py|gap|w|h)-(\d+(?:\.5)?)$/.exec(core);
      if (sp) return `${parseFloat(sp[1]) * 4}px`;
    }
    return undefined;
  };

  const resolveScaleColor = (prefix: string): string | undefined => {
    for (const core of stateCores()) {
      if (core.startsWith(`${prefix}-`) && SCALE_COLORS[core]) return SCALE_COLORS[core];
    }
    return undefined;
  };

  const lenProps = (prefix: string, conflicts: string[]) => ({
    value:
      getArbitrary(classes, prefix, 'length', state) ??
      resolveScaleLength(prefix) ??
      (state === 'none' ? computed?.[prefix as keyof ComputedElementStyle] : undefined),
    onChange: (v: string) => set(setArbitrary(classes, prefix, v, { kind: 'length', conflicts, state })),
    onClear: () => set(setArbitrary(classes, prefix, null, { kind: 'length', state })),
  });

  const len = (prefix: string, conflicts: string[], min: number, max: number, step = 1) => (
    <ScrubInput min={min} max={max} step={step} {...lenProps(prefix, conflicts)} />
  );

  const lenRow = (label: string, prefix: string, conflicts: string[], min: number, max: number, step = 1) => (
    <LengthRow label={label} min={min} max={max} step={step} {...lenProps(prefix, conflicts)} />
  );

  const col = (prefix: string, conflicts: string[] = []) => {
    const computedColor =
      state === 'none'
        ? prefix === 'bg'
          ? computed?.bgColor
          : prefix === 'text'
            ? computed?.textColor
            : computed?.borderColor
        : undefined;
    return (
      <ColorField
        value={getArbitrary(classes, prefix, 'color', state) ?? resolveScaleColor(prefix) ?? computedColor}
        onChange={(v) => set(setArbitrary(classes, prefix, v, { kind: 'color', conflicts, state }))}
        onClear={() => set(setArbitrary(classes, prefix, null, { kind: 'color', state }))}
      />
    );
  };

  const opacity = (
    <ScrubInput
      value={getArbitrary(classes, 'opacity', undefined, state) ?? (state === 'none' ? computed?.opacity : undefined)}
      min={0}
      max={1}
      step={0.05}
      unit=""
      onChange={(v) => set(setArbitrary(classes, 'opacity', v, { state }))}
      onClear={() => set(setArbitrary(classes, 'opacity', null, { state }))}
    />
  );

  const swatches = (
    <div className="flex flex-wrap gap-1.5">
      {BG_PRESETS.map((p) => {
        const active = activePreset(BG_TOKENS) === p.token;
        return (
          <button
            key={p.token}
            type="button"
            aria-label={p.name}
            aria-pressed={active}
            title={p.name}
            onClick={() => pickPreset(BG_TOKENS, p.token)}
            className={`w-4 h-4 rounded-full border transition outline-none focus-visible:ring-1 focus-visible:ring-focus ${
              active ? 'border-focus ring-1 ring-focus' : 'border-line'
            }`}
            style={{ backgroundColor: p.color }}
          />
        );
      })}
    </div>
  );

  const weight = (
    <Segmented
      options={[
        { id: 'font-normal', label: '400' },
        { id: 'font-medium', label: '500' },
        { id: 'font-semibold', label: '600' },
        { id: 'font-bold', label: '700' },
      ]}
      active={activePreset(WEIGHT) ?? (state === 'none' ? weightPresetFromComputed(computed?.fontWeight) : undefined)}
      onPick={(id) => pickPreset(WEIGHT, id)}
    />
  );

  const radiusPresets = (
    <Segmented
      options={[
        { id: 'rounded-none', label: '0' },
        { id: 'rounded', label: 'sm' },
        { id: 'rounded-md', label: 'md' },
        { id: 'rounded-lg', label: 'lg' },
        { id: 'rounded-xl', label: 'xl' },
        { id: 'rounded-full', label: '∞' },
      ]}
      active={activePreset(RADIUS) ?? (state === 'none' ? radiusPresetFromComputed(computed?.rounded) : undefined)}
      onPick={(id) => pickPreset(RADIUS, id)}
    />
  );

  const shadowPresets = (
    <Segmented
      options={[
        { id: 'shadow-none', label: '0' },
        { id: 'shadow-sm', label: 'sm' },
        { id: 'shadow', label: 'md' },
        { id: 'shadow-lg', label: 'lg' },
        { id: 'shadow-xl', label: 'xl' },
      ]}
      active={activePreset(SHADOW) ?? (state === 'none' ? shadowPresetFromComputed(computed?.shadow) : undefined)}
      onPick={(id) => pickPreset(SHADOW, id)}
    />
  );

  return {
    activePreset,
    pickPreset,
    len,
    lenRow,
    col,
    opacity,
    swatches,
    weight,
    radiusPresets,
    shadowPresets,
  };
}
