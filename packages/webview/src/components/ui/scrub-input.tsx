import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { clamp, nudgeValue, roundToStep } from '../../lib/scrub';
import { IconButton } from './button';

export const fieldClass = 'bg-raised border border-line rounded text-fg outline-none transition focus:border-focus';

export const focusRing = 'outline-none focus-visible:ring-1 focus-visible:ring-focus';

export function ScrubInput({
  value,
  min,
  max,
  step = 1,
  unit = 'px',
  onChange,
  onClear,
  label,
}: {
  value: string | undefined;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: string) => void;
  onClear: () => void;
  label?: string;
}) {
  const num = value !== undefined ? parseFloat(value) : NaN;
  const has = !Number.isNaN(num);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (text: string) => {
    setDraft(null);
    if (text === (has ? String(num) : '')) return;
    const n = parseFloat(text);
    if (Number.isNaN(n)) {
      if (text.trim() === '' && has) onClear();
      return;
    }
    onChange(`${roundToStep(clamp(n, min, max), step)}${unit}`);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={has ? num : min}
        aria-label={label}
        onChange={(e) => onChange(`${e.target.value}${unit}`)}
        className={`flex-1 min-w-0 h-1 accent-accent ${has ? '' : 'opacity-40'} ${focusRing}`}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft ?? (has ? num : '')}
        aria-label={label ? `${label} value` : undefined}
        placeholder="–"
        onFocus={(e) => setDraft(e.target.value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
            return;
          }
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const next = nudgeValue(has ? num : min, e.key === 'ArrowUp' ? 1 : -1, step, min, max, {
            shift: e.shiftKey,
            alt: e.altKey,
          });
          setDraft(null);
          onChange(`${next}${unit}`);
        }}
        className={`${fieldClass} ${focusRing} w-12 px-1 py-0.5 text-[11px] font-mono text-right`}
      />
      <IconButton icon={RotateCcw} label="Reset" onClick={onClear} disabled={!has} />
    </div>
  );
}
