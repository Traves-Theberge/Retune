import type { KeyboardEvent } from 'react';

export function Segmented({
  options,
  active,
  onPick,
  label,
}: {
  options: { id: string; label: string }[];
  active?: string;
  onPick: (id: string) => void;
  label?: string;
}) {
  const found = options.findIndex((o) => o.id === active);
  const activeIndex = found === -1 ? 0 : found;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onPick(options[next].id);
    const group = e.currentTarget.parentElement;
    (group?.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className="flex bg-raised border border-line rounded p-0.5 gap-0.5">
      {options.map((o, i) => {
        const checked = i === activeIndex;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onPick(o.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`flex-1 py-0.5 rounded-[3px] text-[11px] transition outline-none focus-visible:ring-1 focus-visible:ring-focus ${
              checked ? 'bg-active text-active-fg' : 'text-muted hover:text-fg hover:bg-hover'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
