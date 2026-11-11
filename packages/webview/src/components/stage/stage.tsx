import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StageStore } from '../../state/use-stage';
import { parseArbitraryStyle } from '../../lib/arbitrary-style';
import { placePopover, type Rect, type Size } from '../../lib/placement';
import { previewTag } from '../../lib/preview';
import { Popover } from '../ui';
import { VIEWPORTS } from '../shared/viewports';
import { EditPanel, PANELS, availablePanels, type PanelKind } from './edit-panels';
import { SelectionToolbar } from './selection-toolbar';
import { ContextMenu, buildMenu } from './context-menu';
import { CanvasDock } from './canvas-dock';

/** Dot grid that fades out towards the edges so the frame, not the grid, holds the eye. */
const GRID_STYLE = {
  backgroundImage: 'radial-gradient(color-mix(in srgb, var(--rt-muted) 32%, transparent) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
  maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
  WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
};

/** Space kept above and below the element for the tag chip and the W x H badge. */
const CHIP_CLEARANCE = 32;
const TOOLBAR_PER_BUTTON = 72;
const TOOLBAR_PADDING = 12;
const TOOLBAR_HEIGHT = 32;

function sameRect(a: Rect | null, b: Rect): boolean {
  return !!a && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

function sameSize(a: Size | null, b: Size): boolean {
  return !!a && a.width === b.width && a.height === b.height;
}

export function Stage({
  store,
  tone,
  comparing,
  onToggleTone,
}: {
  store: StageStore;
  tone: 'dark' | 'light';
  comparing: boolean;
  onToggleTone: () => void;
}) {
  const { stage, meta } = store;
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 800, height: 600 });
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [toolbarMeasured, setToolbarMeasured] = useState<Size | null>(null);
  const [selected, setSelected] = useState(false);
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // Measure the canvas, the selected element and the toolbar. Setters bail out on unchanged
  // values, so running this after every render cannot loop.
  const measure = () => {
    const c = containerRef.current;
    const e = elementRef.current;
    const t = toolbarRef.current;
    if (!c) return;
    const next = { width: c.clientWidth, height: c.clientHeight };
    setSize((prev) => (sameSize(prev, next) ? prev : next));
    if (e) {
      const cr = c.getBoundingClientRect();
      const er = e.getBoundingClientRect();
      const rect = { left: er.left - cr.left, top: er.top - cr.top, width: er.width, height: er.height };
      setAnchor((prev) => (sameRect(prev, rect) ? prev : rect));
    }
    if (t) {
      const toolbar = { width: t.offsetWidth, height: t.offsetHeight };
      setToolbarMeasured((prev) => (sameSize(prev, toolbar) ? prev : toolbar));
    }
  };

  useLayoutEffect(() => {
    measure();
  });

  // Transitions (viewport switch, class edits) and container-only resizes change geometry
  // without a Stage re-render, so observe the layout boxes directly.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    for (const node of [containerRef.current, frameRef.current, elementRef.current]) {
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
    // measure only touches refs and setters, so the first closure stays valid.
  }, []);

  // Escape closes the innermost layer: context menu, then popover, then selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menu) setMenu(null);
      else if (panel) setPanel(null);
      else if (selected) setSelected(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, panel, selected]);

  // Clicking anywhere outside the menu dismisses it.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  const disabled = Boolean(stage.propValues.disabled);
  const label = String(stage.propValues.label ?? '') || meta?.componentName || '';
  const tagName = previewTag(stage.targetElement, meta?.componentName);
  const Tag = tagName as keyof React.JSX.IntrinsicElements;
  const classes = comparing ? store.baselinePreviewClass : store.previewClass;
  const hasVariants = Boolean(meta?.cva?.hasCva && Object.keys(meta.cva.variants).length > 0);
  const panels = availablePanels(hasVariants);
  const panelTitle = PANELS.find((p) => p.kind === panel)?.title ?? '';
  const tagChip = `<${tagName}>`;
  const viewportPreset = VIEWPORTS.find((v) => v.id === stage.viewport) ?? VIEWPORTS[0];
  const frameWidth = viewportPreset.id === 'responsive' ? viewportPreset.widthClass : `${viewportPreset.widthClass} max-w-full`;
  const widthLabel = viewportPreset.id === 'responsive' ? 'Fluid' : `${viewportPreset.label}px`;

  // Until the toolbar has been measured, fall back to a width estimate from the panel count.
  const toolbarSize = toolbarMeasured ?? {
    width: panels.length * TOOLBAR_PER_BUTTON + TOOLBAR_PADDING,
    height: TOOLBAR_HEIGHT,
  };
  // The rect is extended so the toolbar clears the tag chip above and the size badge below.
  const toolbarPos = anchor
    ? placePopover(
        {
          left: anchor.left,
          top: anchor.top - CHIP_CLEARANCE,
          width: anchor.width,
          height: anchor.height + 2 * CHIP_CLEARANCE,
        },
        toolbarSize,
        size,
        { prefer: 'above' },
      )
    : null;

  return (
    <div
      ref={containerRef}
      onClick={() => {
        setSelected(false);
        setPanel(null);
        setMenu(null);
      }}
      onContextMenu={(e) => {
        const target = e.target as HTMLElement;
        // Keep native cut/copy/paste menus inside text fields in the popover.
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
      }}
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 pt-6 pb-16 transition-colors ${
        tone === 'light' ? 'bg-stage-light' : 'bg-stage-dark'
      }`}
    >
      {stage.showGrid && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={GRID_STYLE} />}

      <div
        aria-hidden="true"
        className={`relative mb-2 flex items-center gap-2 font-mono text-[11px] transition-all duration-150 ${frameWidth} ${
          tone === 'light' ? 'text-frame-dark/50' : 'text-muted'
        }`}
      >
        <span className="h-px flex-1 bg-current opacity-25" />
        <span>{widthLabel}</span>
        <span className="h-px flex-1 bg-current opacity-25" />
      </div>

      <div
        ref={frameRef}
        className={`relative flex min-h-[280px] items-center justify-center rounded-2xl border p-14 shadow-2xl transition-all duration-150 ${frameWidth} ${
          tone === 'light' ? 'border-frame-dark/10 bg-frame-light' : 'border-line bg-frame-dark'
        }`}
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
            setSelected(true);
            setMenu(null);
            setPanel('text');
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelected(true);
            setMenu({ x: e.clientX, y: e.clientY });
          }}
          className={`relative cursor-pointer rounded-md outline-offset-4 ${
            selected ? 'outline outline-2 outline-accent' : 'hover:outline hover:outline-1 hover:outline-accent/60'
          }`}
        >
          <Tag
            className={`transition-all ${classes} ${disabled ? 'opacity-50' : ''}`}
            style={{ ...parseArbitraryStyle(classes), pointerEvents: 'none' }}
          >
            {label}
          </Tag>
        </div>
      </div>
      <p className={`relative mt-3 text-[11px] ${tone === 'light' ? 'text-frame-dark/50' : 'text-subtle'}`}>
        Approximate preview — classes only
      </p>

      {selected && anchor && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded-md bg-accent px-1.5 py-1 font-mono text-[11px] leading-none text-accent-fg shadow-sm"
            style={{ left: anchor.left - 4, top: Math.max(0, anchor.top - 28) }}
          >
            {tagChip}
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md bg-accent px-1.5 py-1 font-mono text-[11px] leading-none text-accent-fg shadow-sm"
            style={{ left: anchor.left + anchor.width / 2, top: anchor.top + anchor.height + 10 }}
          >
            {`${Math.round(anchor.width)} × ${Math.round(anchor.height)}`}
          </span>
        </>
      )}

      {selected && anchor && !panel && toolbarPos && (
        <div
          ref={toolbarRef}
          className="absolute z-20 w-max"
          style={{ left: toolbarPos.left, top: toolbarPos.top }}
        >
          <SelectionToolbar panels={panels} style={{ position: 'relative' }} onOpen={(kind) => setPanel(kind)} />
        </div>
      )}

      {selected && panel && (
        <Popover
          anchor={anchor}
          container={size}
          title={panelTitle}
          subtitle={store.targetLabel}
          onClose={() => setPanel(null)}
        >
          <EditPanel kind={panel} store={store} onDone={() => setPanel(null)} />
        </Popover>
      )}

      <CanvasDock
        viewport={stage.viewport}
        onViewport={(viewport) => store.patchStage({ viewport })}
        showGrid={stage.showGrid}
        onToggleGrid={() => store.patchStage({ showGrid: !stage.showGrid })}
        tone={tone}
        onToggleTone={onToggleTone}
      />

      {menu && (
        <ContextMenu
          point={menu}
          title={tagChip}
          entries={buildMenu({
            store,
            panels,
            disabled,
            hasVariants,
            jsx: `<${tagName} className="${store.previewClass}">${label}</${tagName}>`,
            openPanel: (kind) => {
              setSelected(true);
              setPanel(kind);
            },
          })}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
