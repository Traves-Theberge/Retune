import React from 'react';
import { Grid2x2, Grid3x3, Monitor, Moon, MoveHorizontal, Smartphone, Sun, Tablet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PseudoStateMode, ViewportPreset } from '@retune/core';
import { VIEWPORTS } from '../shared/viewports';

const VIEWPORT_ICONS: Record<ViewportPreset, LucideIcon> = {
  responsive: MoveHorizontal,
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

const STATES: { id: PseudoStateMode; label: string }[] = [
  { id: 'none', label: 'Base' },
  { id: 'hover', label: ':hover' },
  { id: 'focus', label: ':focus' },
  { id: 'active', label: ':active' },
];

const focusRing = 'outline-none focus-visible:ring-1 focus-visible:ring-focus';
const item = `flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] transition ${focusRing}`;
const idle = 'text-muted hover:bg-hover hover:text-fg';
const on = 'bg-active text-active-fg';

/** Floating canvas controls: viewport width, pseudo-state simulator, variant matrix, grid and backdrop tone. */
export function CanvasDock({
  viewport,
  onViewport,
  showGrid,
  onToggleGrid,
  tone,
  onToggleTone,
  pseudoState = 'none',
  onPseudoState,
  hasVariants,
  matrixMode,
  onToggleMatrix,
}: {
  viewport: ViewportPreset;
  onViewport: (v: ViewportPreset) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  tone: 'dark' | 'light';
  onToggleTone: () => void;
  pseudoState?: PseudoStateMode;
  onPseudoState?: (s: PseudoStateMode) => void;
  hasVariants?: boolean;
  matrixMode?: boolean;
  onToggleMatrix?: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-xl border border-line bg-overlay/90 p-1 shadow-xl backdrop-blur select-none"
    >
      <div role="radiogroup" aria-label="Viewport" className="flex items-center gap-0.5">
        {VIEWPORTS.map((v) => {
          const Icon = VIEWPORT_ICONS[v.id];
          const checked = v.id === viewport;
          return (
            <button
              key={v.id}
              role="radio"
              aria-checked={checked}
              type="button"
              title={v.id === 'responsive' ? 'Fluid width' : `${v.label}px wide`}
              onClick={() => onViewport(v.id)}
              className={`${item} ${checked ? on : idle}`}
            >
              <Icon size={14} aria-hidden="true" />
              <span className="font-mono">{v.label}</span>
            </button>
          );
        })}
      </div>

      {onPseudoState && (
        <>
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-line shrink-0" />
          <div role="radiogroup" aria-label="State" className="flex items-center gap-0.5">
            {STATES.map((s) => {
              const checked = pseudoState === s.id;
              return (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={checked}
                  type="button"
                  title={`Simulate ${s.label} state`}
                  onClick={() => onPseudoState(s.id)}
                  className={`${item} font-mono ${checked ? on : idle}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <span aria-hidden="true" className="mx-1 h-4 w-px bg-line shrink-0" />

      {hasVariants && onToggleMatrix && (
        <button
          aria-label="Variant Matrix"
          aria-pressed={Boolean(matrixMode)}
          type="button"
          title="Compare all variant combinations"
          onClick={onToggleMatrix}
          className={`${item} ${matrixMode ? on : idle}`}
        >
          <Grid2x2 size={14} aria-hidden="true" />
        </button>
      )}
      <button
        aria-label="Grid"
        aria-pressed={showGrid}
        type="button"
        title="Dot grid"
        onClick={onToggleGrid}
        className={`${item} ${showGrid ? on : idle}`}
      >
        <Grid3x3 size={14} aria-hidden="true" />
      </button>
      <button
        aria-label="Canvas tone"
        type="button"
        title={tone === 'light' ? 'Light backdrop' : 'Dark backdrop'}
        onClick={onToggleTone}
        className={`${item} ${idle}`}
      >
        {tone === 'light' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}
