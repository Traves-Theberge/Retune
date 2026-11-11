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

const GRID_STYLE = {
  backgroundImage: 'radial-gradient(color-mix(in srgb, var(--rt-muted) 25%, transparent) 1px, transparent 1px)',
  backgroundSize: '16px 16px',
};

const TOOLBAR_BUTTON_WIDTH = 72;
const TOOLBAR_HEIGHT = 32;

function sameRect(a: Rect | null, b: Rect): boolean {
  return !!a && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

export function Stage({ store, tone, comparing }: { store: StageStore; tone: 'dark' | 'light'; comparing: boolean }) {
  const { stage, meta } = store;
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 800, height: 600 });
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [selected, setSelected] = useState(false);
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // Measure the canvas and the selected element. Setters bail out on unchanged values, so running
  // after every render cannot loop.
  const measure = () => {
    const c = containerRef.current;
    const e = elementRef.current;
    if (!c) return;
    const next = { width: c.clientWidth, height: c.clientHeight };
    setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    if (e) {
      const cr = c.getBoundingClientRect();
      const er = e.getBoundingClientRect();
      const rect = { left: er.left - cr.left, top: er.top - cr.top, width: er.width, height: er.height };
      setAnchor((prev) => (sameRect(prev, rect) ? prev : rect));
    }
  };

  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
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
  const frameWidth = (VIEWPORTS.find((v) => v.id === stage.viewport) ?? VIEWPORTS[0]).widthClass;

  const toolbarPos = anchor
    ? placePopover(anchor, { width: panels.length * TOOLBAR_BUTTON_WIDTH + 12, height: TOOLBAR_HEIGHT }, size, {
        prefer: 'above',
      })
    : null;

  return (
    <div
      ref={containerRef}
      onClick={() => {
        setSelected(false);
        setPanel(null);
        setMenu(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-6 transition-colors ${
        tone === 'light' ? 'bg-stage-light' : 'bg-stage-dark'
      }`}
      style={stage.showGrid ? GRID_STYLE : undefined}
    >
      <div
        className={`flex min-h-[260px] items-center justify-center rounded border border-line bg-panel/60 p-14 transition-all duration-150 ${frameWidth}`}
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
          className={`relative cursor-pointer rounded outline-offset-4 ${
            selected ? 'outline outline-2 outline-accent' : 'hover:outline hover:outline-1 hover:outline-accent/50'
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
      <p className="mt-3 text-[11px] text-subtle">Approximate preview — classes only</p>

      {selected && anchor && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded bg-overlay px-1 font-mono text-[11px] text-accent"
            style={{ left: anchor.left, top: Math.max(0, anchor.top - 22) }}
          >
            {tagChip}
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded bg-overlay px-1 font-mono text-[11px] text-muted"
            style={{ left: anchor.left, top: anchor.top + anchor.height + 6 }}
          >
            {`${Math.round(anchor.width)} × ${Math.round(anchor.height)}`}
          </span>
        </>
      )}

      {selected && anchor && !panel && toolbarPos && (
        <SelectionToolbar
          panels={panels}
          style={{ left: toolbarPos.left, top: toolbarPos.top }}
          onOpen={(kind) => setPanel(kind)}
        />
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
