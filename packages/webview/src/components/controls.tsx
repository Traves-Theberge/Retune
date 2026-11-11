import { useRef } from 'react';
import { getArbitrary, setArbitrary, splitClasses } from '../lib/arbitrary-style';
import { scrubValue } from '../lib/scrub';
import { ColorField, Row, ScrubInput, Segmented, Section } from './ui';

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

export function createClassEditor(classes: string, set: (next: string) => void) {
  const activePreset = (group: string[]) => splitClasses(classes).find((t) => group.includes(t));

  const pickPreset = (group: string[], token: string) => {
    const filtered = splitClasses(classes).filter((t) => !group.includes(t));
    set([...filtered, token].join(' '));
  };

  const lenProps = (prefix: string, conflicts: string[]) => ({
    value: getArbitrary(classes, prefix, 'length'),
    onChange: (v: string) => set(setArbitrary(classes, prefix, v, { kind: 'length', conflicts })),
    onClear: () => set(setArbitrary(classes, prefix, null, { kind: 'length' })),
  });

  const len = (prefix: string, conflicts: string[], min: number, max: number, step = 1) => (
    <ScrubInput min={min} max={max} step={step} {...lenProps(prefix, conflicts)} />
  );

  const lenRow = (label: string, prefix: string, conflicts: string[], min: number, max: number, step = 1) => (
    <LengthRow label={label} min={min} max={max} step={step} {...lenProps(prefix, conflicts)} />
  );

  const col = (prefix: string, conflicts: string[] = []) => (
    <ColorField
      value={getArbitrary(classes, prefix, 'color')}
      onChange={(v) => set(setArbitrary(classes, prefix, v, { kind: 'color', conflicts }))}
      onClear={() => set(setArbitrary(classes, prefix, null, { kind: 'color' }))}
    />
  );

  const opacity = (
    <ScrubInput
      value={getArbitrary(classes, 'opacity')}
      min={0}
      max={1}
      step={0.05}
      unit=""
      onChange={(v) => set(setArbitrary(classes, 'opacity', v))}
      onClear={() => set(setArbitrary(classes, 'opacity', null))}
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
      active={activePreset(WEIGHT)}
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
      active={activePreset(RADIUS)}
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
      active={activePreset(SHADOW)}
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
