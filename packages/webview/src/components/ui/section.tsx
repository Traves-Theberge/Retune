import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function Section({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-subtle hover:text-fg transition outline-none focus-visible:ring-1 focus-visible:ring-focus"
      >
        <span className="flex items-center gap-1.5">
          <span>{title}</span>
          {count !== undefined && <span className="font-mono text-subtle">{count}</span>}
        </span>
        {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2.5">{children}</div>}
    </section>
  );
}
