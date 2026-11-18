import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CvaMetadata, PreviewNode, PseudoStateMode } from '@retune/core';
import type { StageStore } from '../../state/use-stage';
import { contrastGrade, contrastRatio, isSmallTouchTarget } from '../../lib/a11y';
import { parseArbitraryStyle, resolveSimulatedClasses, setArbitrary } from '../../lib/arbitrary-style';
import { placePopover, type Rect, type Size } from '../../lib/placement';
import { previewTag } from '../../lib/preview';
import { scrubValue } from '../../lib/scrub';
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

const CHIP_CLEARANCE = 32;
const TOOLBAR_PER_BUTTON = 72;
const TOOLBAR_PADDING = 12;
const TOOLBAR_HEIGHT = 32;
const SAFE_HTML_TAGS = new Set([
  'main', 'aside', 'header', 'footer', 'nav', 'section', 'article',
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'button', 'a', 'input', 'select', 'option', 'textarea', 'label',
  'fieldset', 'legend', 'form', 'details', 'summary', 'dialog',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'small', 'strong', 'em', 'b', 'i', 'code', 'pre', 'time', 'figure', 'figcaption', 'hr', 'br', 'img',
  'svg', 'g', 'path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon',
]);
const VOID_TAGS = new Set([
  'input', 'img', 'hr', 'br', 'path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon',
]);
const PAGE_ROOT_TAGS = new Set(['main', 'section', 'article', 'aside', 'form', 'dialog', 'nav']);

function countTreeNodes(node: PreviewNode | null | undefined): number {
  if (!node) return 0;
  return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0);
}

function toSafeDomProps(
  attrs: Record<string, string | number | boolean> | undefined,
  tag: string
): Record<string, unknown> {
  if (!attrs) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'value') out.defaultValue = v;
    else if (k === 'checked') out.defaultChecked = Boolean(v);
    else if (k === 'href' && typeof v === 'string' && /^\s*javascript:/i.test(v)) out.href = '#';
    else if (tag === 'img' && k === 'src') out.src = v;
    else out[k] = v;
  }
  return out;
}

function sameRect(a: Rect | null, b: Rect): boolean {
  return !!a && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

function sameSize(a: Size | null, b: Size): boolean {
  return !!a && a.width === b.width && a.height === b.height;
}

function renderTagForNode(tag: string, fallbackComponentName?: string): keyof React.JSX.IntrinsicElements {
  if (SAFE_HTML_TAGS.has(tag)) return tag as keyof React.JSX.IntrinsicElements;
  return previewTag(tag, fallbackComponentName) as keyof React.JSX.IntrinsicElements;
}

function mergeTargetClasses(
  nodeClass: string,
  baselineClass: string,
  currentClass: string,
  isDefaultRoot: boolean
): string {
  if (isDefaultRoot && !currentClass && nodeClass) {
    return nodeClass;
  }
  if (!nodeClass || nodeClass === baselineClass) {
    return currentClass;
  }
  const baselineSet = new Set(baselineClass.split(/\s+/).filter(Boolean));
  const dynamicTokens = nodeClass
    .split(/\s+/)
    .filter((tok) => Boolean(tok) && !baselineSet.has(tok));
  return Array.from(new Set([...dynamicTokens, ...currentClass.split(/\s+/).filter(Boolean)])).join(' ');
}

function buildVariantMatrix(cva: CvaMetadata, limit = 24): Record<string, string>[] {
  const groups = Object.entries(cva.variants).filter(([, opts]) => opts.length > 0);
  if (groups.length === 0) return [];
  let combos: Record<string, string>[] = [{}];
  for (const [group, options] of groups) {
    const next: Record<string, string>[] = [];
    for (const c of combos) {
      for (const opt of options) {
        next.push({ ...c, [group]: opt });
        if (next.length >= limit) break;
      }
      if (next.length >= limit) break;
    }
    combos = next;
  }
  return combos;
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
  const [cssSize, setCssSize] = useState<Size | null>(null);
  const [toolbarMeasured, setToolbarMeasured] = useState<Size | null>(null);
  const [contrast, setContrast] = useState<number | null>(null);
  const [selected, setSelected] = useState(true);
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const selectedDomRef = useRef<HTMLElement | null>(null);
  const lastClickRef = useRef<{ name: string; index: number } | null>(null);
  const prevFileRef = useRef<string | undefined>(meta?.filePath);
  const activeScaleRef = useRef(1);
  const dragRef = useRef<{ axis: 'width' | 'height'; startPos: number; baseVal: number; scale: number } | null>(null);

  useEffect(() => {
    setSelected(true);
    if (prevFileRef.current !== meta?.filePath) {
      prevFileRef.current = meta?.filePath;
      selectedDomRef.current = null;
      lastClickRef.current = null;
      return;
    }
    const clicked = lastClickRef.current;
    if (clicked && clicked.name === stage.targetElement && clicked.index === (stage.targetIndex ?? 0)) {
      return;
    }
    selectedDomRef.current = null;
    lastClickRef.current = null;
  }, [stage.targetElement, stage.targetIndex, meta?.filePath]);

  const measure = () => {
    const c = containerRef.current;
    const e = elementRef.current;
    const t = toolbarRef.current;
    if (!c) return;
    const next = { width: c.clientWidth, height: c.clientHeight };
    setSize((prev) => (sameSize(prev, next) ? prev : next));
    if (e) {
      const targetDom =
        (selectedDomRef.current && e.contains(selectedDomRef.current) ? selectedDomRef.current : null) ??
        (e.querySelector('[data-retune-target="true"]') as HTMLElement | null) ??
        (e.querySelector('.retune-preview-scope')?.firstElementChild as HTMLElement | null) ??
        e;
      const cr = c.getBoundingClientRect();
      const er = targetDom.getBoundingClientRect();
      const rect = { left: er.left - cr.left, top: er.top - cr.top, width: er.width, height: er.height };
      setAnchor((prev) => (sameRect(prev, rect) ? prev : rect));
      const scale = e.querySelector('.retune-preview-scope')?.contains(targetDom) ? activeScaleRef.current || 1 : 1;
      const measuredCss = {
        width: Math.max(1, Math.round(er.width / scale)),
        height: Math.max(1, Math.round(er.height / scale)),
      };
      setCssSize((prev) => (sameSize(prev, measuredCss) ? prev : measuredCss));

      if (typeof window.getComputedStyle === 'function') {
        const cs = window.getComputedStyle(targetDom);
        const backdrop: [number, number, number] = tone === 'light' ? [255, 255, 255] : [18, 18, 22];
        const ratio = contrastRatio(cs.color, cs.backgroundColor, backdrop);
        setContrast((prev) => (prev === ratio ? prev : ratio));
      }
    }
    if (t) {
      const toolbar = { width: t.offsetWidth, height: t.offsetHeight };
      setToolbarMeasured((prev) => (sameSize(prev, toolbar) ? prev : toolbar));
    }
  };

  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    for (const node of [containerRef.current, frameRef.current, elementRef.current]) {
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [tone]);

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

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  // Direct box-model width/height resize drag handlers
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = (drag.axis === 'width' ? e.clientX - drag.startPos : e.clientY - drag.startPos) / (drag.scale || 1);
      const prefix = drag.axis === 'width' ? 'w' : 'h';
      const max = drag.axis === 'width' ? 1400 : 1200;
      const val = scrubValue(drag.baseVal, delta, 2, 16, max);
      store.setClasses(
        setArbitrary(store.stage.harmonicsClass, prefix, `${val}px`, {
          kind: 'length',
          state: store.stage.pseudoState ?? 'none',
        })
      );
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [store]);

  const pseudoState: PseudoStateMode = stage.pseudoState ?? 'none';
  const disabled = Boolean(stage.propValues.disabled);
  const label = String(stage.propValues.label ?? '') || meta?.componentName || '';
  const tagName = previewTag(stage.targetElement, meta?.componentName);
  const displayTag = stage.targetElement || meta?.previewTree?.sourceTag || meta?.previewTree?.tag || tagName;
  const Tag = tagName as keyof React.JSX.IntrinsicElements;
  const rawClasses = comparing ? store.baselinePreviewClass : store.previewClass;
  const classes = resolveSimulatedClasses(rawClasses, pseudoState);
  const hasVariants = Boolean(meta?.cva?.hasCva && Object.keys(meta.cva.variants).length > 0);
  const matrixMode = Boolean(stage.matrixMode && hasVariants);
  const panels = availablePanels(hasVariants);
  const panelTitle = PANELS.find((p) => p.kind === panel)?.title ?? '';
  const tagChip = `<${displayTag}>`;
  const viewportPreset = VIEWPORTS.find((v) => v.id === stage.viewport) ?? VIEWPORTS[0];
  const widthLabel = viewportPreset.id === 'responsive' ? 'Fluid' : `${viewportPreset.label}px`;

  const toolbarSize = toolbarMeasured ?? {
    width: panels.length * TOOLBAR_PER_BUTTON + TOOLBAR_PADDING,
    height: TOOLBAR_HEIGHT,
  };
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

  const startHandleDrag = (axis: 'width' | 'height', e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const scale = activeScaleRef.current || 1;
    const baseVal =
      axis === 'width'
        ? cssSize?.width ?? Math.round((anchor?.width ?? 120) / scale)
        : cssSize?.height ?? Math.round((anchor?.height ?? 36) / scale);
    dragRef.current = { axis, startPos: axis === 'width' ? e.clientX : e.clientY, baseVal, scale };
  };

  let claimedTarget = false;
  const renderTree = (
    node: PreviewNode,
    isRoot = false,
    siblingIdx = 0,
    ancestorMatchedTarget = false,
    inheritedSubcomp?: string
  ): React.ReactNode => {
    if (node.tag === '#text') {
      return <React.Fragment key={`text-${siblingIdx}`}>{node.text}</React.Fragment>;
    }
    const effectiveTag = node.sourceTag ?? node.tag;
    const subcompKey =
      node.sourceTag && node.elementIndex >= 0 ? `${node.sourceTag}:${node.elementIndex}` : undefined;
    const isSubcompRoot = Boolean(subcompKey && subcompKey !== inheritedSubcomp);
    const hasExplicitTarget = Boolean(stage.targetElement);
    const rawMatchesTarget =
      node.elementIndex >= 0 &&
      (hasExplicitTarget
        ? stage.targetElement === effectiveTag && (stage.targetIndex ?? 0) === node.elementIndex
        : isRoot);
    const isTarget = rawMatchesTarget && !ancestorMatchedTarget;
    const claimTargetAttr = isTarget && !claimedTarget;
    if (claimTargetAttr) claimedTarget = true;

    const El = renderTagForNode(node.tag, meta?.componentName);
    const elTag = String(El);
    const isDefaultRoot = !hasExplicitTarget && isRoot;
    const nodeRawClasses = isTarget
      ? mergeTargetClasses(node.className, store.stage.baselineClass, rawClasses, isDefaultRoot)
      : node.className;
    const nodeClasses = resolveSimulatedClasses(nodeRawClasses, pseudoState);
    const nodeStyle = {
      ...(node.style ?? {}),
      ...parseArbitraryStyle(nodeRawClasses, pseudoState),
    };
    const domProps = toSafeDomProps(node.attrs, elTag);
    const isVoid = VOID_TAGS.has(elTag);
    const key = `${node.tag}-${node.elementIndex}-${siblingIdx}`;

    const commonProps: Record<string, unknown> = {
      ...domProps,
      ...(claimTargetAttr ? { 'data-retune-target': 'true' } : {}),
      ...(isSubcompRoot ? { 'data-retune-subcomp': subcompKey } : {}),
      className: `${nodeClasses} ${
        isTarget && !isRoot ? 'outline outline-1 outline-accent/80 outline-offset-2' : ''
      } ${disabled && isRoot ? 'opacity-50' : ''}`.trim(),
      style: Object.keys(nodeStyle).length > 0 ? nodeStyle : undefined,
    };

    if (node.elementIndex >= 0) {
      const selectClickedNode = (targetEl: EventTarget | null) => {
        const elDom = targetEl as HTMLElement | null;
        const subRoot =
          subcompKey && elDom && typeof elDom.closest === 'function'
            ? (elDom.closest(`[data-retune-subcomp="${subcompKey}"]`) as HTMLElement | null)
            : null;
        selectedDomRef.current = subRoot ?? elDom;
        lastClickRef.current = { name: effectiveTag, index: node.elementIndex };
        store.selectElement({ name: effectiveTag, index: node.elementIndex });
        setSelected(true);
        setMenu(null);
      };
      commonProps.onClick = (e: React.MouseEvent) => {
        if (elTag === 'a') e.preventDefault();
        e.stopPropagation();
        selectClickedNode(e.currentTarget);
      };
      commonProps.onDoubleClick = (e: React.MouseEvent) => {
        if (elTag === 'a') e.preventDefault();
        e.stopPropagation();
        selectClickedNode(e.currentTarget);
        setPanel('text');
      };
      commonProps.onContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        selectClickedNode(e.currentTarget);
        setMenu({ x: e.clientX, y: e.clientY });
      };
    }
    if (elTag === 'form') {
      commonProps.onSubmit = (e: React.FormEvent) => e.preventDefault();
    }

    if (isVoid) {
      return <El key={key} {...(commonProps as any)} />;
    }

    const leafFallback =
      node.text !== undefined
        ? isRoot && stage.propValues.label
          ? String(stage.propValues.label)
          : node.text
        : isRoot && (elTag === 'button' || elTag === 'a')
          ? label
          : null;

    return (
      <El key={key} {...(commonProps as any)}>
        {node.children.length > 0
          ? node.children.map((child, idx) =>
              renderTree(child, false, idx, ancestorMatchedTarget || isTarget, subcompKey ?? inheritedSubcomp)
            )
          : leafFallback}
      </El>
    );
  };

  const useTreePreview = Boolean(meta?.previewTree);
  const treeNodeCount = countTreeNodes(meta?.previewTree);
  const isRichLayout =
    useTreePreview &&
    Boolean(
      treeNodeCount > 4 ||
        (meta?.previewTree &&
          (PAGE_ROOT_TAGS.has(meta.previewTree.tag) ||
            (meta.previewTree.tag === 'div' && meta.previewTree.children.length > 0)))
    );
  const matrixCombos = matrixMode && meta?.cva ? buildVariantMatrix(meta.cva) : [];
  const frameWidth =
    viewportPreset.id === 'responsive'
      ? isRichLayout && !matrixMode
        ? 'w-full max-w-6xl'
        : viewportPreset.widthClass
      : `${viewportPreset.widthClass} max-w-full`;
  const availInnerWidth = Math.max(320, (size.width || 800) - 88);
  const richZoom =
    isRichLayout && !matrixMode && viewportPreset.id === 'responsive'
      ? Math.min(1, Math.max(0.45, availInnerWidth / 1080))
      : 1;
  activeScaleRef.current = viewportPreset.id === 'responsive' && richZoom < 0.99 ? richZoom : 1;
  const a11ySmall = cssSize
    ? isSmallTouchTarget(cssSize.width, cssSize.height)
    : anchor
      ? isSmallTouchTarget(anchor.width, anchor.height)
      : false;
  const dimWidth = cssSize?.width ?? (anchor ? Math.round(anchor.width / (activeScaleRef.current || 1)) : null);
  const dimHeight = cssSize?.height ?? (anchor ? Math.round(anchor.height / (activeScaleRef.current || 1)) : null);
  const dimText = dimWidth !== null && dimHeight !== null ? `${dimWidth} × ${dimHeight}` : 'auto × auto';
  const dimBadgeText = [
    dimText,
    contrast !== null ? `${contrastGrade(contrast)} ${contrast}:1` : null,
    a11ySmall ? 'tap <44' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const previewScopeStyle: React.CSSProperties = {
    containerType: 'inline-size',
    containerName: 'retune-stage',
    ...(isRichLayout && !matrixMode
      ? {
          transform: 'translateZ(0)',
          ...(viewportPreset.id === 'responsive' && richZoom < 0.99
            ? { width: '1080px', zoom: richZoom }
            : {}),
        }
      : {}),
  };

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
        <span>
          {matrixMode
            ? `Variant Matrix (${matrixCombos.length})`
            : dimWidth !== null && dimHeight !== null
              ? `${widthLabel} · ${dimWidth} × ${dimHeight}px`
              : widthLabel}
        </span>
        {pseudoState !== 'none' && <span>{`· :${pseudoState}`}</span>}
        <span className="h-px flex-1 bg-current opacity-25" />
      </div>

      <div
        ref={frameRef}
        onScroll={measure}
        className={`relative flex rounded-2xl border shadow-2xl transition-all duration-150 ${frameWidth} ${
          isRichLayout && !matrixMode
            ? 'max-h-[calc(100vh-160px)] min-h-[320px] items-start justify-start overflow-auto p-5'
            : 'min-h-[280px] items-center justify-center p-10'
        } ${
          tone === 'light' ? 'border-frame-dark/10 bg-frame-light' : 'border-line bg-frame-dark'
        }`}
      >
        {matrixMode && meta?.cva ? (
          <div className="grid max-h-[380px] w-full grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
            {matrixCombos.map((combo, idx) => {
              const parts = [stage.harmonicsClass];
              for (const [g, v] of Object.entries(combo)) {
                const c = meta.cva.variantClasses?.[g]?.[v];
                if (c) parts.push(c);
              }
              const comboRaw = parts.filter(Boolean).join(' ');
              const comboClasses = resolveSimulatedClasses(comboRaw, pseudoState);
              const comboLabel = Object.entries(combo).map(([, v]) => v).join(' / ');
              const isActive = Object.entries(combo).every(([g, v]) => stage.selectedVariants[g] === v);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    store.patchStage({ selectedVariants: combo, matrixMode: false });
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition ${
                    isActive ? 'border-accent bg-accent/10' : 'border-line hover:bg-hover'
                  }`}
                >
                  <span
                    className={`pointer-events-none transition-all ${comboClasses}`}
                    style={parseArbitraryStyle(comboRaw, pseudoState)}
                  >
                    {label || comboLabel}
                  </span>
                  <span className="font-mono text-[11px] text-subtle">{comboLabel}</span>
                </button>
              );
            })}
          </div>
        ) : (
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
            className={`relative cursor-pointer rounded-md outline-offset-4 ${isRichLayout ? 'w-full' : ''} ${
              selected ? 'outline outline-2 outline-accent' : 'hover:outline hover:outline-1 hover:outline-accent/60'
            }`}
          >
            <div
              className={`retune-preview-scope ${isRichLayout ? 'w-full min-h-[260px]' : ''}`}
              style={previewScopeStyle}
            >
              {meta?.workspaceCss && <style>{meta.workspaceCss}</style>}
              {useTreePreview && meta?.previewTree ? (
                renderTree(meta.previewTree, true)
              ) : (
                <Tag
                  className={`transition-all ${classes} ${disabled ? 'opacity-50' : ''}`}
                  style={{ ...parseArbitraryStyle(rawClasses, pseudoState), pointerEvents: 'none' }}
                >
                  {label}
                </Tag>
              )}
            </div>

            {/* SSR / pre-layout fallback handles & badges until ResizeObserver measures anchor */}
            {selected && !anchor && !matrixMode && (
              <>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-7 left-0 z-10 rounded-md bg-accent px-1.5 py-1 font-mono text-[11px] leading-none text-accent-fg shadow-sm"
                >
                  {tagChip}
                </span>
                <span
                  data-testid="dimension-badge"
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-7 left-1/2 z-10 -translate-x-1/2 rounded-md bg-accent px-1.5 py-1 font-mono text-[11px] leading-none text-accent-fg shadow-sm whitespace-nowrap"
                >
                  {dimBadgeText}
                </span>
                <div
                  role="separator"
                  aria-label="Resize width"
                  data-handle="width"
                  title="Drag horizontally to resize width"
                  onPointerDown={(e) => startHandleDrag('width', e)}
                  className="absolute top-1/2 -right-3 h-5 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full bg-accent shadow-sm"
                />
                <div
                  role="separator"
                  aria-label="Resize height"
                  data-handle="height"
                  title="Drag vertically to resize height"
                  onPointerDown={(e) => startHandleDrag('height', e)}
                  className="absolute -bottom-3 left-1/2 h-1.5 w-5 -translate-x-1/2 cursor-ns-resize rounded-full bg-accent shadow-sm"
                />
              </>
            )}
          </div>
        )}
      </div>

      <p className={`relative mt-3 text-[11px] ${tone === 'light' ? 'text-frame-dark/50' : 'text-subtle'}`}>
        Approximate preview — classes only
      </p>

      {selected && anchor && !matrixMode && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded-md bg-accent px-1.5 py-1 font-mono text-[11px] leading-none text-accent-fg shadow-sm"
            style={{
              left: Math.max(8, Math.min(Math.max(8, size.width - 140), anchor.left - 4)),
              top: Math.max(8, Math.min(Math.max(8, size.height - 88), anchor.top - 26)),
            }}
          >
            {tagChip}
          </span>
          <span
            data-testid="dimension-badge"
            aria-hidden="true"
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md bg-accent px-1.5 py-1 font-mono text-[11px] leading-none text-accent-fg shadow-sm whitespace-nowrap"
            style={{
              left: Math.max(64, Math.min(Math.max(64, size.width - 64), anchor.left + anchor.width / 2)),
              top: Math.max(32, Math.min(Math.max(32, size.height - 64), anchor.top + anchor.height + 8)),
            }}
          >
            {dimBadgeText}
          </span>
          <div
            role="separator"
            aria-label="Resize width"
            data-handle="width"
            title="Drag horizontally to resize width"
            onPointerDown={(e) => startHandleDrag('width', e)}
            className="absolute z-10 h-5 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full bg-accent shadow-sm"
            style={{
              left: Math.max(16, Math.min(Math.max(16, size.width - 14), anchor.left + anchor.width + 6)),
              top: Math.max(24, Math.min(Math.max(24, size.height - 80), anchor.top + anchor.height / 2)),
            }}
          />
          <div
            role="separator"
            aria-label="Resize height"
            data-handle="height"
            title="Drag vertically to resize height"
            onPointerDown={(e) => startHandleDrag('height', e)}
            className="absolute z-10 h-1.5 w-5 -translate-x-1/2 cursor-ns-resize rounded-full bg-accent shadow-sm"
            style={{
              left: Math.max(24, Math.min(Math.max(24, size.width - 24), anchor.left + anchor.width / 2)),
              top: Math.max(24, Math.min(Math.max(24, size.height - 72), anchor.top + anchor.height + 6)),
            }}
          />
        </>
      )}

      {selected && anchor && !panel && !matrixMode && toolbarPos && (
        <div
          ref={toolbarRef}
          className="absolute z-20 w-max"
          style={{ left: toolbarPos.left, top: toolbarPos.top }}
        >
          <SelectionToolbar panels={panels} style={{ position: 'relative' }} onOpen={(kind) => setPanel(kind)} />
        </div>
      )}

      {selected && panel && !matrixMode && (
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
        pseudoState={pseudoState}
        onPseudoState={(s) => store.patchStage({ pseudoState: s })}
        hasVariants={hasVariants}
        matrixMode={matrixMode}
        onToggleMatrix={() => store.patchStage({ matrixMode: !matrixMode })}
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
            jsx: `<${displayTag} className="${store.previewClass}">${label}</${displayTag}>`,
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
