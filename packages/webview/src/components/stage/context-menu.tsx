import React, { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StageStore } from '../../state/use-stage';
import { clampMenu } from '../../lib/placement';
import { focusRing } from '../ui/scrub-input';
import type { PANELS, PanelKind } from './edit-panels';

export interface MenuEntry {
  id: string;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  run: () => void;
}

const MENU_LABEL: Record<PanelKind, string> = {
  text: 'Edit text…',
  fill: 'Fill & border…',
  type: 'Typography…',
  spacing: 'Spacing & size…',
  shape: 'Shape & effects…',
  variants: 'Variants…',
  classes: 'Edit classes…',
};

export function buildMenu(a: {
  store: StageStore;
  panels: typeof PANELS;
  disabled: boolean;
  hasVariants: boolean;
  jsx: string;
  openPanel: (k: PanelKind) => void;
}): MenuEntry[] {
  const { store, disabled, jsx } = a;
  const fail = () => store.notify('Copy failed', 'error');
  const copy = (text: string, message: string) => {
    // navigator.clipboard is undefined in some webview contexts, so guard the synchronous access too.
    try {
      navigator.clipboard.writeText(text).then(() => store.notify(message, 'info'), fail);
    } catch {
      fail();
    }
  };

  const entries: MenuEntry[] = a.panels.map((p) => ({
    id: `panel:${p.kind}`,
    label: MENU_LABEL[p.kind],
    hint: p.kind === 'text' ? '2×click' : undefined,
    run: () => a.openPanel(p.kind),
  }));

  entries.push(
    {
      id: 'toggle-disabled',
      label: disabled ? 'Enable' : 'Disable',
      separatorBefore: true,
      run: () => store.setProp('disabled', !disabled),
    },
    { id: 'sync', label: 'Sync to code', hint: 'Ctrl+S', disabled: !store.dirty, run: () => store.sync() },
    { id: 'undo', label: 'Undo', hint: 'Ctrl+Z', disabled: !store.canUndo, run: () => store.undo() },
    { id: 'redo', label: 'Redo', hint: 'Ctrl+Shift+Z', disabled: !store.canRedo, run: () => store.redo() },
    {
      id: 'copy-class',
      label: 'Copy className',
      separatorBefore: true,
      run: () => copy(store.previewClass, 'Copied className'),
    },
    { id: 'copy-jsx', label: 'Copy JSX', run: () => copy(jsx, 'Copied JSX') },
  );

  if (a.hasVariants) {
    entries.push({
      id: 'reset-variants',
      label: 'Reset variants',
      run: () => store.patchStage({ selectedVariants: { ...(store.meta?.cva.defaultVariants ?? {}) } }),
    });
  }

  entries.push(
    { id: 'discard', label: 'Discard changes', danger: true, disabled: !store.dirty, run: () => store.discard() },
    {
      id: 'inspect',
      label: 'Inspect code',
      separatorBefore: true,
      run: () => store.patchStage({ activeTab: 'ast' }),
    },
  );
  return entries;
}

export function ContextMenu({
  entries,
  point,
  title,
  onClose,
}: {
  entries: MenuEntry[];
  point: { x: number; y: number };
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState({ left: point.x, top: point.y });

  // Clamp to the window once the real menu size is known.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(
      clampMenu(
        point,
        { width: el.offsetWidth, height: el.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [point.x, point.y]);

  // Focus the first enabled entry on mount.
  useEffect(() => {
    const first = entries.findIndex((e) => !e.disabled);
    if (first >= 0) items.current[first]?.focus();
  }, []);

  const activate = (index: number) => {
    const entry = entries[index];
    if (!entry || entry.disabled) return;
    entry.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    const enabled = entries.map((entry, i) => (entry.disabled ? -1 : i)).filter((i) => i >= 0);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (enabled.length === 0) return;
      const current = items.current.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const at = enabled.indexOf(current);
      const next = at === -1 ? (step > 0 ? 0 : enabled.length - 1) : (at + step + enabled.length) % enabled.length;
      items.current[enabled[next]]?.focus();
    } else if (e.key === 'Enter') {
      const current = items.current.indexOf(document.activeElement as HTMLButtonElement);
      if (current >= 0) {
        e.preventDefault();
        activate(current);
      }
    }
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={title}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'fixed', left: pos.left, top: pos.top }}
      className="z-50 w-56 select-none rounded border border-line bg-overlay py-1 text-xs text-fg shadow-lg"
    >
      <div className="border-b border-line px-2.5 py-1 font-mono text-[11px] text-accent">{title}</div>
      {entries.map((entry, i) => (
        <Fragment key={entry.id}>
          {entry.separatorBefore && <div role="separator" className="my-1 border-t border-line" />}
          <button
            ref={(el) => {
              items.current[i] = el;
            }}
            role="menuitem"
            aria-disabled={entry.disabled ?? false}
            type="button"
            tabIndex={-1}
            onClick={() => activate(i)}
            className={`flex w-full items-center justify-between gap-3 px-2.5 py-1 text-left transition hover:bg-hover focus:bg-hover aria-disabled:pointer-events-none aria-disabled:opacity-40 ${focusRing} ${
              entry.danger ? 'text-danger' : 'text-fg'
            }`}
          >
            <span>{entry.label}</span>
            {entry.hint && <span className="font-mono text-[11px] text-subtle">{entry.hint}</span>}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
