import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CvaMetadata, ViewportPreset, StageTabId } from '@retune/core';
import { addClasses, parseArbitraryStyle, removeClass, splitClasses } from '../../lib/arbitrary-style';
import {
  BG_TOKENS,
  GAP,
  HEIGHT,
  PX,
  PY,
  RADIUS,
  TEXT_SIZE,
  Row,
  createClassEditor,
  field,
} from '../controls';

export interface ViewportFrameProps {
  componentName?: string;
  targetElement?: string;
  computedClass: string;
  /** Editable class string (source of truth, written to the file on sync) */
  classes: string;
  onChangeClasses: (next: string) => void;
  label: string;
  onChangeLabel: (next: string) => void;
  cva?: CvaMetadata;
  selectedVariants: Record<string, string>;
  onSelectVariant: (group: string, value: string) => void;
  onCommitVariant: (group: string, value: string) => void;
  viewport: ViewportPreset;
  showGrid: boolean;
  disabled: boolean;
  onToggleDisabled: () => void;
  onSyncAst?: () => void;
  onResetVariants?: () => void;
  onSelectViewport?: (vp: ViewportPreset) => void;
  onSwitchTab?: (tab: StageTabId) => void;
  onOpenInspector?: () => void;
}

type ModalKind = 'text' | 'fill' | 'type' | 'spacing' | 'shape' | 'variants' | 'classes';

const MODAL_TITLES: Record<ModalKind, string> = {
  text: 'Text',
  fill: 'Fill & Border',
  type: 'Typography',
  spacing: 'Spacing & Size',
  shape: 'Shape & Effects',
  variants: 'Variants',
  classes: 'Classes',
};

const VIEWPORT_WIDTHS: Record<ViewportPreset, string> = {
  responsive: 'w-full max-w-3xl',
  mobile: 'w-[375px]',
  tablet: 'w-[768px]',
  desktop: 'w-[1024px]',
};

const VIEWPORT_DIMENSIONS: Record<ViewportPreset, string> = {
  responsive: 'Fluid',
  mobile: '375',
  tablet: '768',
  desktop: '1024',
};

function MenuItem({
  label,
  hint,
  onClick,
  danger,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between transition hover:text-white ${
        danger ? 'hover:bg-rose-600' : 'hover:bg-indigo-600'
      }`}
    >
      <span>{label}</span>
      {hint && <span className="text-[10px] font-mono opacity-60">{hint}</span>}
    </button>
  );
}

export function ViewportFrame(props: ViewportFrameProps) {
  const {
    componentName,
    targetElement,
    computedClass,
    classes,
    onChangeClasses,
    label,
    onChangeLabel,
    cva,
    selectedVariants,
    onSelectVariant,
    onCommitVariant,
    viewport,
    showGrid,
    disabled,
    onToggleDisabled,
    onSyncAst,
    onResetVariants,
    onSelectViewport,
    onSwitchTab,
    onOpenInspector,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<'dark' | 'light'>('dark');
  const [guides, setGuides] = useState(true);
  const [classDraft, setClassDraft] = useState('');

  const activeTag = targetElement || componentName || 'Component';
  const hasVariants = Boolean(cva?.hasCva && Object.keys(cva.variants).length > 0);
  const ed = createClassEditor(classes, onChangeClasses);

  const measure = () => {
    const c = containerRef.current;
    const e = elementRef.current;
    if (!c || !e) return;
    const cr = c.getBoundingClientRect();
    const er = e.getBoundingClientRect();
    setAnchor({
      left: er.left - cr.left + c.scrollLeft,
      top: er.top - cr.top + c.scrollTop,
      bottom: er.bottom - cr.top + c.scrollTop,
      width: er.width,
    });
  };

  // Keep the toolbar/modal glued to the element as styles or viewport change
  useLayoutEffect(() => {
    if (selected || modal) measure();
  });

  useEffect(() => {
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null);
        if (modal) setModal(null);
        else setSelected(false);
      }
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', measure);
    };
  }, [modal]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  const openModal = (kind: ModalKind) => {
    setSelected(true);
    setMenu(null);
    setModal(kind);
  };

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      /* clipboard unavailable */
    }
    setMenu(null);
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(true);
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const tag = targetElement || 'button';
  const jsx = `<${tag} className="${computedClass}">${label}</${tag}>`;
  const style = parseArbitraryStyle(computedClass);

  /* ---------- Modal bodies (same controls as the sidebar) ---------- */
  const renderModal = () => {
    switch (modal) {
      case 'text':
        return (
          <div className="space-y-2.5">
            <Row label="label">
              <input
                autoFocus
                value={label}
                onChange={(e) => onChangeLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setModal(null)}
                className={`${field} w-full px-2 py-1 text-[11px]`}
              />
            </Row>
            <Row label="disabled">
              <button
                type="button"
                onClick={onToggleDisabled}
                className={`px-2.5 py-0.5 rounded border font-mono text-[10px] transition ${
                  disabled
                    ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                    : 'bg-[#16161b] border-zinc-800 text-zinc-400'
                }`}
              >
                {String(disabled)}
              </button>
            </Row>
          </div>
        );
      case 'fill':
        return (
          <div className="space-y-2.5">
            <Row label="fill">{ed.col('bg', BG_TOKENS)}</Row>
            <div className="pl-[72px]">{ed.swatches}</div>
            <Row label="border">{ed.len('border', [], 0, 12)}</Row>
            <Row label="stroke">{ed.col('border')}</Row>
            <Row label="opacity">{ed.opacity}</Row>
          </div>
        );
      case 'type':
        return (
          <div className="space-y-2.5">
            <Row label="size">{ed.len('text', TEXT_SIZE, 8, 64)}</Row>
            <Row label="weight">{ed.weight}</Row>
            <Row label="spacing">{ed.len('tracking', [], -4, 16, 0.5)}</Row>
            <Row label="color">{ed.col('text')}</Row>
          </div>
        );
      case 'spacing':
        return (
          <div className="space-y-2.5">
            <Row label="pad X">{ed.len('px', PX, 0, 64)}</Row>
            <Row label="pad Y">{ed.len('py', PY, 0, 48)}</Row>
            <Row label="gap">{ed.len('gap', GAP, 0, 32)}</Row>
            <Row label="width">{ed.len('w', [], 0, 600, 4)}</Row>
            <Row label="height">{ed.len('h', HEIGHT, 0, 200)}</Row>
          </div>
        );
      case 'shape':
        return (
          <div className="space-y-2.5">
            <Row label="radius">{ed.len('rounded', RADIUS, 0, 48)}</Row>
            <Row label="">{ed.radiusPresets}</Row>
            <Row label="shadow">{ed.shadowPresets}</Row>
          </div>
        );
      case 'variants':
        return hasVariants && cva ? (
          <div className="space-y-3">
            {Object.entries(cva.variants).map(([group, options]) => {
              const current = selectedVariants[group] || cva.defaultVariants[group] || options[0];
              return (
                <div key={group} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-zinc-300">{group}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onCommitVariant(group, current);
                        flash('Default set');
                      }}
                      className="text-[10px] text-zinc-500 hover:text-indigo-400 transition"
                    >
                      set default
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onSelectVariant(group, opt)}
                        className={`px-2 py-0.5 rounded border text-[10px] font-mono transition ${
                          current === opt
                            ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                            : 'bg-[#16161b] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-zinc-500">No cva() variants in this component.</p>
        );
      case 'classes':
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {splitClasses(classes).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded bg-[#16161b] border border-zinc-800 font-mono text-[10px] text-zinc-300"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => onChangeClasses(removeClass(classes, t))}
                    className="text-zinc-600 hover:text-rose-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              autoFocus
              value={classDraft}
              onChange={(e) => setClassDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && classDraft.trim()) {
                  onChangeClasses(addClasses(classes, classDraft));
                  setClassDraft('');
                }
              }}
              placeholder="Add classes · Enter"
              className={`${field} w-full px-2 py-1 text-[11px] font-mono`}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const TOOLBAR: { kind: ModalKind; label: string }[] = [
    { kind: 'text', label: 'Text' },
    { kind: 'fill', label: 'Fill' },
    { kind: 'type', label: 'Type' },
    { kind: 'spacing', label: 'Space' },
    { kind: 'shape', label: 'Shape' },
    ...(hasVariants ? [{ kind: 'variants' as ModalKind, label: 'Variants' }] : []),
    { kind: 'classes', label: 'Classes' },
  ];

  const containerW = containerRef.current?.clientWidth ?? 800;
  const modalLeft = anchor ? Math.max(8, Math.min(anchor.left + anchor.width / 2 - 140, containerW - 296)) : 8;

  return (
    <div
      ref={containerRef}
      onClick={() => {
        setSelected(false);
        setModal(null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      className={`flex-1 flex flex-col items-center justify-center p-6 overflow-auto relative transition-colors ${
        tone === 'light' ? 'bg-zinc-100 text-zinc-900' : 'bg-[#09090b] text-zinc-100'
      }`}
      style={
        showGrid
          ? {
              backgroundImage:
                tone === 'light'
                  ? 'radial-gradient(rgba(24, 24, 27, 0.12) 1px, transparent 1px)'
                  : 'radial-gradient(rgba(161, 161, 170, 0.12) 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }
          : undefined
      }
    >
      {/* HUD */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none text-[10px] font-mono z-10">
        <div className="pointer-events-auto flex items-center gap-1.5 bg-[#111116]/90 border border-zinc-800/80 rounded px-2 py-1 text-zinc-400">
          <span className="text-indigo-400">{`<${activeTag} />`}</span>
          <span className="text-zinc-600">·</span>
          <span>{VIEWPORT_DIMENSIONS[viewport]}</span>
          {toast && <span className="ml-1 px-1.5 rounded bg-emerald-500/20 text-emerald-300">{toast}</span>}
        </div>
        <div className="pointer-events-auto flex items-center gap-0.5 bg-[#111116]/90 border border-zinc-800/80 rounded p-0.5 text-zinc-400">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setGuides((g) => !g);
            }}
            className={`px-2 py-0.5 rounded transition ${guides ? 'bg-zinc-800 text-zinc-200' : 'hover:text-zinc-300'}`}
          >
            Guides
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTone((t) => (t === 'dark' ? 'light' : 'dark'));
            }}
            className="px-2 py-0.5 rounded hover:text-zinc-200 transition"
          >
            {tone === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        className={`transition-all duration-150 flex items-center justify-center min-h-[260px] p-14 rounded-lg border ${
          tone === 'light' ? 'border-zinc-300/80 bg-white/70' : 'border-zinc-800/60 bg-[#0d0d11]/60'
        } ${VIEWPORT_WIDTHS[viewport]}`}
      >
        <div
          ref={elementRef}
          onClick={(e) => {
            e.stopPropagation();
            setSelected(true);
            setMenu(null);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            openModal('text');
          }}
          onContextMenu={onContextMenu}
          className={`relative cursor-pointer ${
            selected
              ? 'outline outline-2 outline-indigo-500 outline-offset-4 rounded'
              : guides
              ? 'outline outline-1 outline-dashed outline-indigo-500/30 outline-offset-4 rounded hover:outline-indigo-500/70'
              : ''
          }`}
        >
          <button
            type="button"
            disabled={disabled}
            style={{ ...style, pointerEvents: 'none' }}
            className={`transition-all ${computedClass} ${disabled ? 'opacity-50' : ''}`}
          >
            {label || componentName || 'Button'}
          </button>
        </div>
      </div>

      {/* Floating selection toolbar */}
      {selected && anchor && !modal && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            left: Math.max(8, Math.min(anchor.left + anchor.width / 2, containerW - 8)),
            top: Math.max(8, anchor.top - 44),
            transform: 'translateX(-50%)',
          }}
          className="absolute z-20 flex items-center gap-0.5 bg-[#111116] border border-zinc-700/80 rounded-md p-0.5 shadow-2xl text-[10px] font-mono text-zinc-300"
        >
          {TOOLBAR.map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => openModal(t.kind)}
              className="px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition"
            >
              {t.label}
            </button>
          ))}
          <span className="w-px h-4 bg-zinc-700 mx-0.5" />
          <button
            type="button"
            onClick={() => onSyncAst?.()}
            className="px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 transition"
          >
            Sync
          </button>
        </div>
      )}

      {/* Edit modal anchored to the element */}
      {modal && anchor && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ left: modalLeft, top: anchor.bottom + 14 }}
          className="absolute z-30 w-[280px] rounded-lg border border-zinc-700/80 bg-[#0e0e12] shadow-2xl text-[11px] text-zinc-200"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-100">{MODAL_TITLES[modal]}</span>
              <span className="font-mono text-[10px] text-indigo-400">{`<${activeTag} />`}</span>
            </div>
            <button
              type="button"
              onClick={() => setModal(null)}
              className="text-zinc-500 hover:text-zinc-200 transition"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
          <div className="p-3 max-h-[320px] overflow-y-auto">{renderModal()}</div>
          <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-800/80">
            <span className="text-[10px] text-zinc-600">Live preview</span>
            <button
              type="button"
              onClick={() => {
                onSyncAst?.();
                flash('Synced to code');
              }}
              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium transition"
            >
              Sync to code
            </button>
          </div>
        </div>
      )}

      {/* Right-click context menu */}
      {menu && (
        <div
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-56 rounded-md border border-zinc-800 bg-[#111116] shadow-2xl py-1 text-[11px] text-zinc-200 select-none"
        >
          <div className="px-2.5 py-1 text-[10px] font-mono text-indigo-400 border-b border-zinc-800/80">
            {`<${activeTag} />`}
          </div>
          <MenuItem label="Edit text…" hint="2×click" onClick={() => openModal('text')} />
          <MenuItem label="Fill & border…" onClick={() => openModal('fill')} />
          <MenuItem label="Typography…" onClick={() => openModal('type')} />
          <MenuItem label="Spacing & size…" onClick={() => openModal('spacing')} />
          <MenuItem label="Shape & effects…" onClick={() => openModal('shape')} />
          {hasVariants && <MenuItem label="Variants…" onClick={() => openModal('variants')} />}
          <MenuItem label="Edit classes…" onClick={() => openModal('classes')} />
          <div className="my-1 border-t border-zinc-800/80" />
          <MenuItem
            label={disabled ? 'Enable' : 'Disable'}
            onClick={() => {
              onToggleDisabled();
              setMenu(null);
            }}
          />
          <MenuItem
            label="Sync to code"
            hint="↵"
            onClick={() => {
              onSyncAst?.();
              flash('Synced to code');
              setMenu(null);
            }}
          />
          <MenuItem label="Copy className" onClick={() => copy(computedClass, 'Copied className')} />
          <MenuItem label="Copy JSX" onClick={() => copy(jsx, 'Copied JSX')} />
          {hasVariants && (
            <MenuItem
              label="Reset variants"
              onClick={() => {
                onResetVariants?.();
                setMenu(null);
              }}
            />
          )}
          <MenuItem
            label="Reset classes"
            danger
            onClick={() => {
              onChangeClasses(cva?.baseClasses || '');
              setMenu(null);
            }}
          />
          <div className="my-1 border-t border-zinc-800/80" />
          <div className="grid grid-cols-4 gap-0.5 px-1.5 py-0.5">
            {(['responsive', 'mobile', 'tablet', 'desktop'] as ViewportPreset[]).map((vp) => (
              <button
                key={vp}
                type="button"
                onClick={() => {
                  onSelectViewport?.(vp);
                  setMenu(null);
                }}
                className={`py-1 rounded text-[10px] font-mono transition ${
                  viewport === vp ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {VIEWPORT_DIMENSIONS[vp]}
              </button>
            ))}
          </div>
          <div className="my-1 border-t border-zinc-800/80" />
          <MenuItem
            label="Open inspector"
            onClick={() => {
              onOpenInspector?.();
              setMenu(null);
            }}
          />
          <MenuItem
            label="Inspect code & AST"
            onClick={() => {
              onSwitchTab?.('ast');
              setMenu(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
