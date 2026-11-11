import type { CSSProperties } from 'react';
import { Baseline, Hash, Layers, PaintBucket, Ruler, Square, Type } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { focusRing } from '../ui/scrub-input';
import type { PANELS, PanelKind } from './edit-panels';

const PANEL_ICONS: Record<PanelKind, LucideIcon> = {
  text: Type,
  fill: PaintBucket,
  type: Baseline,
  spacing: Ruler,
  shape: Square,
  variants: Layers,
  classes: Hash,
};

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
      className="absolute z-20 flex items-center gap-0.5 rounded-xl border border-line bg-overlay/90 p-1 text-xs text-muted shadow-xl backdrop-blur"
    >
      {panels.map((p) => {
        const Icon = PANEL_ICONS[p.kind];
        return (
          <button
            key={p.kind}
            type="button"
            title={p.title}
            onClick={() => onOpen(p.kind)}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:bg-hover hover:text-fg ${focusRing}`}
          >
            <Icon size={14} aria-hidden="true" />
            <span>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}
