import React, { useState } from 'react';
import { getArbitrary, setArbitrary, splitClasses } from '../lib/arbitrary-style';

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
  { token: 'bg-indigo-600', color: '#4f46e5' },
  { token: 'bg-zinc-800', color: '#27272a' },
  { token: 'bg-emerald-600', color: '#059669' },
  { token: 'bg-rose-600', color: '#e11d48' },
  { token: 'bg-sky-600', color: '#0284c7' },
  { token: 'bg-violet-600', color: '#7c3aed' },
  { token: 'bg-amber-500', color: '#f59e0b' },
  { token: 'bg-white', color: '#ffffff' },
  { token: 'bg-transparent', color: 'transparent' },
];
export const BG_TOKENS = BG_PRESETS.map((p) => p.token);

export const field =
  'bg-[#16161b] border border-zinc-800 focus:border-indigo-500 rounded text-zinc-100 outline-none transition';

/* ---------- Building blocks ---------- */

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-2">
      <span className="text-[11px] text-zinc-400 truncate">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Segmented({
  options,
  active,
  onPick,
}: {
  options: { id: string; label: string }[];
  active?: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex bg-[#16161b] border border-zinc-800 rounded p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onPick(o.id)}
          className={`flex-1 py-0.5 rounded-[3px] text-[10px] font-mono transition ${
            active === o.id ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  unit = 'px',
  onChange,
  onClear,
}: {
  value: string | undefined;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const num = value !== undefined ? parseFloat(value) : NaN;
  const has = !Number.isNaN(num);
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={has ? num : min}
        onChange={(e) => onChange(`${e.target.value}${unit}`)}
        className="flex-1 min-w-0 accent-indigo-500 h-1"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={has ? num : ''}
        placeholder="–"
        onChange={(e) => (e.target.value === '' ? onClear() : onChange(`${e.target.value}${unit}`))}
        className={`${field} w-12 px-1 py-0.5 text-[11px] font-mono text-right`}
      />
      <button
        type="button"
        onClick={onClear}
        disabled={!has}
        title="Reset"
        className="text-[11px] text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition"
      >
        ↺
      </button>
    </div>
  );
}

export function ColorField({
  value,
  onChange,
  onClear,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const hex = value && value.startsWith('#') && value.length === 7 ? value : '#000000';
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded border border-zinc-700 bg-transparent p-0 cursor-pointer"
      />
      <input
        type="text"
        value={value ?? ''}
        placeholder="#hex / rgb()"
        onChange={(e) => (e.target.value ? onChange(e.target.value) : onClear())}
        className={`${field} flex-1 min-w-0 px-2 py-0.5 text-[11px] font-mono`}
      />
      <button
        type="button"
        onClick={onClear}
        disabled={!value}
        title="Reset"
        className="text-[11px] text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition"
      >
        ↺
      </button>
    </div>
  );
}

/* ---------- Class editor: one implementation behind sidebar, modals and menus ---------- */

export function createClassEditor(classes: string, set: (next: string) => void) {
  const activePreset = (group: string[]) => splitClasses(classes).find((t) => group.includes(t));

  const pickPreset = (group: string[], token: string) => {
    const filtered = splitClasses(classes).filter((t) => !group.includes(t));
    set([...filtered, token].join(' '));
  };

  const len = (prefix: string, conflicts: string[], min: number, max: number, step = 1) => (
    <Slider
      value={getArbitrary(classes, prefix, 'length')}
      min={min}
      max={max}
      step={step}
      onChange={(v) => set(setArbitrary(classes, prefix, v, { kind: 'length', conflicts }))}
      onClear={() => set(setArbitrary(classes, prefix, null, { kind: 'length' }))}
    />
  );

  const col = (prefix: string, conflicts: string[] = []) => (
    <ColorField
      value={getArbitrary(classes, prefix, 'color')}
      onChange={(v) => set(setArbitrary(classes, prefix, v, { kind: 'color', conflicts }))}
      onClear={() => set(setArbitrary(classes, prefix, null, { kind: 'color' }))}
    />
  );

  const opacity = (
    <Slider
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
      {BG_PRESETS.map((p) => (
        <button
          key={p.token}
          type="button"
          title={p.token}
          onClick={() => pickPreset(BG_TOKENS, p.token)}
          className={`w-4 h-4 rounded-full border transition ${
            activePreset(BG_TOKENS) === p.token
              ? 'border-indigo-400 ring-1 ring-indigo-400'
              : 'border-zinc-600'
          }`}
          style={{ backgroundColor: p.color }}
        />
      ))}
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

  return { activePreset, pickPreset, len, col, opacity, swatches, weight, radiusPresets, shadowPresets };
}

/* ---------- Collapsible sidebar section ---------- */

export function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-zinc-800/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 hover:text-zinc-300 transition"
      >
        <span>{title}</span>
        <span className="font-mono text-zinc-600">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3 pb-3 space-y-2.5">{children}</div>}
    </section>
  );
}
