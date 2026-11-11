import type { CvaMetadata } from '@retune/core';
import { focusRing } from '../ui/scrub-input';

export function VariantPicker({
  cva,
  selected,
  onSelect,
  onSetDefault,
}: {
  cva: CvaMetadata;
  selected: Record<string, string>;
  onSelect: (group: string, value: string) => void;
  onSetDefault: (group: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {Object.entries(cva.variants).map(([group, options]) => {
        const current = selected[group] ?? cva.defaultVariants[group] ?? options[0];
        return (
          <div key={group} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted">{group}</span>
              <button
                type="button"
                title="Write as defaultVariant in the file"
                onClick={() => onSetDefault(group, current)}
                className={`rounded px-1 text-[11px] text-subtle transition hover:text-fg ${focusRing}`}
              >
                set default
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {options.map((option) => {
                const active = option === current;
                return (
                  <button
                    key={option}
                    aria-pressed={active}
                    type="button"
                    onClick={() => onSelect(group, option)}
                    className={`rounded px-2 py-0.5 font-mono text-[11px] transition ${focusRing} ${
                      active ? 'bg-active text-active-fg' : 'bg-raised border border-line text-muted hover:text-fg hover:bg-hover'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
