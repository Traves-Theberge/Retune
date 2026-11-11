import { useRef, type PointerEvent, type ReactNode } from 'react';

export function Row({
  label,
  children,
  onScrubStart,
  onScrub,
}: {
  label: string;
  children: ReactNode;
  onScrubStart?: () => void;
  onScrub?: (dxPx: number) => void;
}) {
  const drag = useRef<{ x: number; id: number } | null>(null);
  const scrubbable = onScrub !== undefined;

  const end = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  };

  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-2">
      <span
        className={`text-[11px] text-muted truncate ${scrubbable ? 'cursor-ew-resize select-none touch-none' : ''}`}
        onPointerDown={
          scrubbable
            ? (e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, id: e.pointerId };
                onScrubStart?.();
              }
            : undefined
        }
        onPointerMove={
          scrubbable
            ? (e) => {
                if (!drag.current) return;
                const dx = e.clientX - drag.current.x;
                if (dx !== 0) onScrub?.(dx);
              }
            : undefined
        }
        onPointerUp={scrubbable ? end : undefined}
        onPointerCancel={scrubbable ? end : undefined}
      >
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
