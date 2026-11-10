import React, { useState, useEffect } from 'react';
import { ViewportPreset, StageTabId } from '@retune/core';

export interface ViewportFrameProps {
  componentName?: string;
  targetElement?: string;
  computedClass: string;
  viewport: ViewportPreset;
  showGrid: boolean;
  propValues: Record<string, string | boolean | number>;
  onSyncAst?: () => void;
  onResetVariants?: () => void;
  onSelectViewport?: (vp: ViewportPreset) => void;
  onSwitchTab?: (tab: StageTabId) => void;
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
  targetElement,
  computedClass,
  viewport,
  showGrid,
  propValues,
  onSyncAst,
  onResetVariants,
  onSelectViewport,
  onSwitchTab,
}: ViewportFrameProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', close);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCopyClasses = async () => {
    try {
      await navigator.clipboard.writeText(computedClass);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 1800);
    } catch {
      // Fallback ignored
    }
    setContextMenu(null);
  };

  const previewLabel =
    typeof propValues.label === 'string' && propValues.label.trim().length > 0
      ? propValues.label
      : typeof propValues.children === 'string' && propValues.children.trim().length > 0
      ? propValues.children
      : componentName
      ? `${componentName} Preview`
      : 'Select a component';

  const isDisabled = Boolean(propValues.disabled);
  const activeTag = targetElement || componentName || 'Component';

  return (
    <div
      onContextMenu={handleContextMenu}
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
            <span className="ml-2 font-mono text-zinc-300">{`<${activeTag} />`}</span>
            {copiedToast && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                Copied classes!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">Right-click component for actions</span>
            <span className="font-mono text-[10px] text-zinc-400">{VIEWPORT_LABELS[viewport]}</span>
          </div>
        </div>

        {/* Interactive Render Surface */}
        <div
          onContextMenu={handleContextMenu}
          className="p-14 flex items-center justify-center min-h-[220px]"
        >
          <button
            disabled={isDisabled}
            onContextMenu={handleContextMenu}
            title="Right-click to open Retune Component Menu"
            className={`transition-all ${computedClass} ${
              isDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {previewLabel}
          </button>
        </div>
      </div>

      {/* Component Right-Click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-60 rounded-lg border border-zinc-700/90 bg-zinc-900/95 backdrop-blur-md shadow-2xl py-1.5 text-xs text-zinc-200 select-none"
        >
          <div className="px-3 py-1 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-indigo-400 flex items-center justify-between">
            <span>{`<${activeTag} />`}</span>
            <span className="text-zinc-500">Retune</span>
          </div>

          <button
            type="button"
            onClick={() => {
              onSyncAst?.();
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between transition"
          >
            <span>Sync Classes to AST</span>
            <span className="text-[10px] font-mono opacity-75">Enter</span>
          </button>

          <button
            type="button"
            onClick={handleCopyClasses}
            className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between transition"
          >
            <span>Copy Tailwind Classes</span>
            <span className="text-[10px] font-mono opacity-75">Clipboard</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onResetVariants?.();
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between transition"
          >
            <span>Reset CVA Variants</span>
            <span className="text-[10px] font-mono opacity-75">Default</span>
          </button>

          <div className="my-1 border-t border-zinc-800" />

          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500">
            Viewport Preset
          </div>
          <div className="grid grid-cols-2 gap-1 px-2 pb-1">
            {(['responsive', 'mobile', 'tablet', 'desktop'] as ViewportPreset[]).map((vp) => (
              <button
                key={vp}
                type="button"
                onClick={() => {
                  onSelectViewport?.(vp);
                  setContextMenu(null);
                }}
                className={`px-2 py-1 rounded text-[11px] capitalize text-left transition ${
                  viewport === vp
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {vp}
              </button>
            ))}
          </div>

          <div className="my-1 border-t border-zinc-800" />

          <button
            type="button"
            onClick={() => {
              onSwitchTab?.('ast');
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between transition"
          >
            <span>Inspect Component AST & Props</span>
            <span className="text-[10px] font-mono opacity-75">Tab</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSwitchTab?.('api');
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between transition"
          >
            <span>Open Scalar API Console</span>
            <span className="text-[10px] font-mono opacity-75">OpenAPI</span>
          </button>
        </div>
      )}
    </div>
  );
}
