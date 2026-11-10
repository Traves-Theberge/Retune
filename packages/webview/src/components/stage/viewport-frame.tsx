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
  responsive: 'w-full max-w-3xl',
  mobile: 'w-[375px]',
  tablet: 'w-[768px]',
  desktop: 'w-[1024px]',
};

const VIEWPORT_DIMENSIONS: Record<ViewportPreset, string> = {
  responsive: 'Fluid',
  mobile: '375px',
  tablet: '768px',
  desktop: '1024px',
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
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [surfaceTone, setSurfaceTone] = useState<'dark' | 'light'>('dark');
  const [showBounds, setShowBounds] = useState<boolean>(true);

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

  const triggerToast = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(null), 1600);
  };

  const handleCopyClasses = async () => {
    try {
      await navigator.clipboard.writeText(computedClass);
      triggerToast('Copied className');
    } catch {
      // ignore
    }
    setContextMenu(null);
  };

  const handleCopyJsx = async () => {
    const tag = targetElement || 'button';
    const jsx = `<${tag} className="${computedClass}">${previewLabel}</${tag}>`;
    try {
      await navigator.clipboard.writeText(jsx);
      triggerToast('Copied JSX');
    } catch {
      // ignore
    }
    setContextMenu(null);
  };

  const previewLabel =
    typeof propValues.label === 'string' && propValues.label.trim().length > 0
      ? propValues.label
      : typeof propValues.children === 'string' && propValues.children.trim().length > 0
      ? propValues.children
      : componentName || 'Button';

  const isDisabled = Boolean(propValues.disabled);
  const activeTag = targetElement || componentName || 'Component';

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`flex-1 flex flex-col items-center justify-center p-6 overflow-auto relative transition-colors ${
        surfaceTone === 'light' ? 'bg-zinc-100 text-zinc-900' : 'bg-[#09090b] text-zinc-100'
      }`}
      style={
        showGrid
          ? {
              backgroundImage:
                surfaceTone === 'light'
                  ? 'radial-gradient(rgba(24, 24, 27, 0.12) 1px, transparent 1px)'
                  : 'radial-gradient(rgba(161, 161, 170, 0.12) 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }
          : undefined
      }
    >
      {/* Floating Minimal Canvas HUD */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none text-[10px] font-mono">
        <div className="flex items-center gap-1.5 pointer-events-auto bg-[#111116]/90 border border-zinc-800/80 rounded px-2 py-1 text-zinc-400">
          <span className="text-indigo-400">{`<${activeTag} />`}</span>
          <span className="text-zinc-600">•</span>
          <span>{VIEWPORT_DIMENSIONS[viewport]}</span>
          {copiedToast && (
            <span className="ml-1.5 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
              {copiedToast}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 pointer-events-auto bg-[#111116]/90 border border-zinc-800/80 rounded p-0.5 text-zinc-400">
          <button
            type="button"
            onClick={() => setShowBounds((b) => !b)}
            className={`px-2 py-0.5 rounded transition ${
              showBounds ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Guides
          </button>
          <button
            type="button"
            onClick={() => setSurfaceTone((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 transition"
          >
            {surfaceTone === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </div>

      {/* Editor Frame Surface */}
      <div
        className={`transition-all duration-150 flex items-center justify-center min-h-[240px] p-12 rounded-lg border ${
          surfaceTone === 'light'
            ? 'border-zinc-300/80 bg-white/70'
            : 'border-zinc-800/60 bg-[#0d0d11]/60'
        } ${VIEWPORT_WIDTHS[viewport]}`}
      >
        {/* Inspector Bounding Box Wrapper */}
        <div
          className={`relative group ${
            showBounds ? 'p-1 border border-dashed border-indigo-500/40 rounded' : ''
          }`}
        >
          {showBounds && (
            <span className="absolute -top-4 left-0 text-[9px] font-mono text-indigo-400/80 select-none">
              {activeTag}
            </span>
          )}
          <button
            disabled={isDisabled}
            onContextMenu={handleContextMenu}
            title="Right-click for component actions"
            className={`transition-all ${computedClass} ${
              isDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {previewLabel}
          </button>
        </div>
      </div>

      {/* Minimal Editor Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-52 rounded-md border border-zinc-800 bg-[#111116] shadow-2xl py-1 text-[11px] text-zinc-200 select-none"
        >
          <div className="px-2.5 py-1 border-b border-zinc-800/80 text-[10px] font-mono text-zinc-400 flex items-center justify-between">
            <span className="text-indigo-400">{`<${activeTag} />`}</span>
            <span>Retune</span>
          </div>

          <button
            type="button"
            onClick={() => {
              onSyncAst?.();
              triggerToast('Synced to AST');
              setContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between transition"
          >
            <span>Sync Classes to Code</span>
            <span className="text-[10px] font-mono opacity-70">↵</span>
          </button>

          <button
            type="button"
            onClick={handleCopyClasses}
            className="w-full px-2.5 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between transition"
          >
            <span>Copy className</span>
            <span className="text-[10px] font-mono opacity-70">CSS</span>
          </button>

          <button
            type="button"
            onClick={handleCopyJsx}
            className="w-full px-2.5 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between transition"
          >
            <span>Copy JSX Element</span>
            <span className="text-[10px] font-mono opacity-70">TSX</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onResetVariants?.();
              setContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between transition"
          >
            <span>Reset Variants</span>
          </button>

          <div className="my-1 border-t border-zinc-800/80" />

          <div className="grid grid-cols-4 gap-0.5 px-1.5 py-0.5">
            {(['responsive', 'mobile', 'tablet', 'desktop'] as ViewportPreset[]).map((vp) => (
              <button
                key={vp}
                type="button"
                onClick={() => {
                  onSelectViewport?.(vp);
                  setContextMenu(null);
                }}
                className={`py-1 rounded text-[10px] font-mono text-center transition ${
                  viewport === vp
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {VIEWPORT_DIMENSIONS[vp]}
              </button>
            ))}
          </div>

          <div className="my-1 border-t border-zinc-800/80" />

          <button
            type="button"
            onClick={() => {
              onSwitchTab?.('ast');
              setContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between transition"
          >
            <span>Inspect AST & Code</span>
          </button>
        </div>
      )}
    </div>
  );
}
