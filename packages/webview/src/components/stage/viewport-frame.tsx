import React from 'react';
import { ViewportPreset } from '@retune/core';

export interface ViewportFrameProps {
  componentName?: string;
  computedClass: string;
  viewport: ViewportPreset;
  showGrid: boolean;
  propValues: Record<string, string | boolean | number>;
}

const VIEWPORT_WIDTHS: Record<ViewportPreset, string> = {
  responsive: 'w-full max-w-2xl',
  mobile: 'w-[375px]',
  tablet: 'w-[768px]',
  desktop: 'w-[1024px]',
};

const VIEWPORT_LABELS: Record<ViewportPreset, string> = {
  responsive: 'Responsive (Fluid)',
  mobile: 'Mobile • 375px',
  tablet: 'Tablet • 768px',
  desktop: 'Desktop • 1024px',
};

export function ViewportFrame({
  componentName,
  computedClass,
  viewport,
  showGrid,
  propValues,
}: ViewportFrameProps) {
  const previewLabel =
    typeof propValues.label === 'string' && propValues.label.trim().length > 0
      ? propValues.label
      : typeof propValues.children === 'string' && propValues.children.trim().length > 0
      ? propValues.children
      : componentName
      ? `${componentName} Preview`
      : 'Select a component';

  const isDisabled = Boolean(propValues.disabled);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto relative"
      style={
        showGrid
          ? {
              backgroundImage:
                'radial-gradient(rgba(99, 102, 241, 0.16) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }
          : undefined
      }
    >
      <div
        className={`transition-all duration-200 border border-zinc-800/90 rounded-xl bg-zinc-900/50 backdrop-blur-sm shadow-2xl flex flex-col overflow-hidden ${VIEWPORT_WIDTHS[viewport]}`}
      >
        {/* Viewport Chrome Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/80 bg-zinc-900/90 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500/70"></span>
            <span className="w-2 h-2 rounded-full bg-amber-500/70"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500/70"></span>
            <span className="ml-2 font-mono text-zinc-300">
              {componentName ? `<${componentName} />` : 'Stage Canvas'}
            </span>
          </div>
          <span className="font-mono text-[10px] text-zinc-500">{VIEWPORT_LABELS[viewport]}</span>
        </div>

        {/* Interactive Render Surface */}
        <div className="p-14 flex items-center justify-center min-h-[220px]">
          <button
            disabled={isDisabled}
            className={`transition-all ${computedClass} ${
              isDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {previewLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
