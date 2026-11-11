export interface Rect { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }
export interface Placement { left: number; top: number; side: 'below' | 'above'; maxHeight: number }

const MIN_MAX_HEIGHT = 80;

export function placePopover(
  anchor: Rect,
  popover: Size,
  container: Size,
  opts: { gap?: number; margin?: number; prefer?: 'below' | 'above' } = {},
): Placement {
  const gap = opts.gap ?? 8;
  const margin = opts.margin ?? 8;
  const prefer = opts.prefer ?? 'below';

  const spaceBelow = container.height - (anchor.top + anchor.height) - gap - margin;
  const spaceAbove = anchor.top - gap - margin;
  const other = prefer === 'below' ? 'above' : 'below';
  const fits = (side: 'below' | 'above') => (side === 'below' ? spaceBelow : spaceAbove) >= popover.height;

  let side: 'below' | 'above';
  if (fits(prefer)) side = prefer;
  else if (fits(other)) side = other;
  else side = spaceBelow >= spaceAbove ? 'below' : 'above';

  const space = side === 'below' ? spaceBelow : spaceAbove;
  const maxHeight = Math.max(MIN_MAX_HEIGHT, space);
  const top = side === 'below'
    ? anchor.top + anchor.height + gap
    : Math.max(margin, anchor.top - gap - Math.min(popover.height, maxHeight));

  const left = clamp(
    anchor.left + anchor.width / 2 - popover.width / 2,
    margin,
    Math.max(margin, container.width - popover.width - margin),
  );

  return { left, top, side, maxHeight };
}

export function clampMenu(
  point: { x: number; y: number },
  menu: Size,
  viewport: Size,
  margin = 4,
): { left: number; top: number } {
  return {
    left: Math.max(margin, Math.min(point.x, viewport.width - menu.width - margin)),
    top: Math.max(margin, Math.min(point.y, viewport.height - menu.height - margin)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
