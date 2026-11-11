import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { placePopover, type Rect, type Size } from '../../lib/placement';
import { IconButton } from './button';

export const POPOVER_WIDTH = 280;
const ESTIMATED_HEIGHT = 240;
const HEADER_RESERVE = 40;

export function Popover({
  anchor,
  container,
  title,
  subtitle,
  onClose,
  children,
}: {
  anchor: Rect | null;
  container: Size;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(ESTIMATED_HEIGHT);

  // Measure the real height once mounted; the first (server) render uses the estimate.
  useLayoutEffect(() => {
    if (ref.current) setHeight(ref.current.offsetHeight);
  });

  if (!anchor) return null;
  const placement = placePopover(anchor, { width: POPOVER_WIDTH, height }, container);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-50 flex flex-col rounded border border-line bg-overlay text-fg shadow-lg"
      style={{ left: placement.left, top: placement.top, width: POPOVER_WIDTH }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">{title}</div>
          {subtitle && <div className="truncate font-mono text-[11px] text-accent">{subtitle}</div>}
        </div>
        <IconButton icon={X} label="Close" onClick={onClose} />
      </div>
      <div className="overflow-y-auto p-3" style={{ maxHeight: placement.maxHeight - HEADER_RESERVE }}>
        {children}
      </div>
    </div>
  );
}
