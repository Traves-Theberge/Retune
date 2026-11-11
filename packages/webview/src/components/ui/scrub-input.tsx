import { RotateCcw } from 'lucide-react';
import { clamp, nudgeValue } from '../../lib/scrub';
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
        className={`flex-1 min-w-0 h-1 accent-accent ${has ? '' : 'opacity-40'} ${focusRing}`}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={has ? num : ''}
        placeholder="–"
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isNaN(n)) onClear();
          else onChange(`${clamp(n, min, max)}${unit}`);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const next = nudgeValue(has ? num : min, e.key === 'ArrowUp' ? 1 : -1, step, min, max, {
            shift: e.shiftKey,
            alt: e.altKey,
          });
          onChange(`${next}${unit}`);
        }}
        className={`${fieldClass} ${focusRing} w-12 px-1 py-0.5 text-[11px] font-mono text-right`}
      />
      <IconButton icon={RotateCcw} label="Reset" onClick={onClear} disabled={!has} />
    </div>
  );
}
