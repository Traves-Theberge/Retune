import type { ElementInfo } from '@retune/core';
import { splitClasses } from '../../lib/arbitrary-style';
import { focusRing } from '../ui/scrub-input';

export interface ElementRef {
  name: string;
  index: number;
}

const rowClass = (selected: boolean) =>
  `flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition ${focusRing} ${
    selected ? 'bg-active text-active-fg' : 'text-muted hover:text-fg hover:bg-hover'
  }`;

export function ElementList({
  elements,
  rootLabel,
  target,
  onSelect,
}: {
  elements: ElementInfo[];
  rootLabel: string;
  target: { name?: string; index?: number };
  onSelect: (ref: ElementRef | null) => void;
}) {
  const seen: Record<string, number> = {};
  const rows = elements.map((element) => {
    const index = seen[element.name] ?? 0;
    seen[element.name] = index + 1;
    const selected = target.name === element.name && (target.index ?? 0) === index;
    return { element, index, selected };
  });

  return (
    <div role="listbox" aria-label="Elements" className="max-h-40 overflow-y-auto rounded border border-line bg-raised p-0.5">
      <button
        role="option"
        aria-selected={target.name === undefined}
        data-row="root"
        type="button"
        onClick={() => onSelect(null)}
        className={rowClass(target.name === undefined)}
      >
        {rootLabel}
      </button>
      {rows.map(({ element, index, selected }) => (
        <button
          key={`${element.name}-${element.start}`}
          role="option"
          aria-selected={selected}
          data-row="element"
          type="button"
          onClick={() => onSelect({ name: element.name, index })}
          className={rowClass(selected)}
        >
          <span className="font-mono">{`<${element.name}>`}</span>
          <span className="font-mono text-subtle">{`L${element.line}`}</span>
          <span className="ml-auto text-subtle">{`${splitClasses(element.className).length} cls`}</span>
        </button>
      ))}
    </div>
  );
}
