import type { CSSProperties } from 'react';
import { focusRing } from '../ui/scrub-input';
import type { PANELS, PanelKind } from './edit-panels';

export function SelectionToolbar({
  panels,
  style,
  onOpen,
}: {
  panels: typeof PANELS;
  style: CSSProperties;
  onOpen: (kind: PanelKind) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Edit element"
      style={style}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-20 flex items-center gap-0.5 rounded border border-line bg-overlay p-0.5 text-xs text-muted shadow-lg"
    >
      {panels.map((p) => (
        <button
          key={p.kind}
          type="button"
          title={p.title}
          onClick={() => onOpen(p.kind)}
          className={`rounded px-2 py-1 transition hover:bg-hover hover:text-fg ${focusRing}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
