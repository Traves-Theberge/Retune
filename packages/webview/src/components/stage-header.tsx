import React, { type KeyboardEvent } from 'react';
import { ArrowDownToLine, Braces, ChevronRight, Code, Eye, Layers, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StageTabId } from '@retune/core';
import type { StageStore } from '../state/use-stage';
import { Button, IconButton } from './ui';

const VIEWS: { id: StageTabId; label: string; icon: LucideIcon }[] = [
  { id: 'stage', label: 'Stage', icon: Layers },
  { id: 'ast', label: 'Code', icon: Code },
  { id: 'api', label: 'API', icon: Braces },
];

const focusRing = 'outline-none focus-visible:ring-1 focus-visible:ring-focus';

function ViewTabs({ active, onPick }: { active: StageTabId; onPick: (id: StageTabId) => void }) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (index + step + VIEWS.length) % VIEWS.length;
    onPick(VIEWS[next].id);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <div role="radiogroup" aria-label="View" className="flex items-center gap-0.5 rounded-lg bg-raised p-0.5">
      {VIEWS.map((view, i) => {
        const checked = view.id === active;
        const Icon = view.icon;
        return (
          <button
            key={view.id}
            role="radio"
            aria-checked={checked}
            type="button"
            tabIndex={checked ? 0 : -1}
            onClick={() => onPick(view.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${focusRing} ${
              checked ? 'bg-canvas text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg'
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            <span>{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function fileBaseName(filePath?: string): string {
  return filePath ? filePath.split(/[\\/]/).pop() ?? '' : '';
}

export function StageHeader({ store, onCompare }: { store: StageStore; onCompare: (on: boolean) => void }) {
  const { stage, dirty, meta } = store;
  const onStage = stage.activeTab === 'stage';
  const fileName = fileBaseName(meta?.filePath);

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 text-xs select-none">
      <ViewTabs active={stage.activeTab} onPick={(id) => store.patchStage({ activeTab: id })} />

      <div className="flex min-w-0 items-center gap-1.5">
        {fileName && (
          <>
            <span className="truncate text-muted">{fileName}</span>
            <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-subtle" />
          </>
        )}
        <span className="truncate rounded-md bg-raised px-1.5 py-0.5 font-mono text-[11px] text-fg">
          {store.targetLabel}
        </span>
        {dirty && (
          <span
            role="status"
            aria-label="Unsynced changes"
            className="flex shrink-0 items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-warn" />
            <span>Edited</span>
          </span>
        )}
      </div>

      <div className="flex-1" />

      {onStage && (
        <div className="flex shrink-0 items-center gap-1">
          <IconButton icon={Undo2} label="Undo" className="p-1.5" disabled={!store.canUndo} onClick={store.undo} />
          <IconButton icon={Redo2} label="Redo" className="p-1.5" disabled={!store.canRedo} onClick={store.redo} />
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
          <Button
            variant="ghost"
            size="md"
            className="rounded-md"
            title="Hold to see the version in the file"
            disabled={!dirty}
            onPointerDown={() => onCompare(true)}
            onPointerUp={() => onCompare(false)}
            onPointerLeave={() => onCompare(false)}
            onPointerCancel={() => onCompare(false)}
          >
            <Eye size={14} aria-hidden="true" />
            <span>Compare</span>
          </Button>
          <Button variant="ghost" size="md" className="rounded-md" disabled={!dirty} onClick={store.discard}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>Discard</span>
          </Button>
          <Button
            variant="primary"
            size="md"
            className="ml-1 rounded-md shadow-sm"
            title="Sync to code (Ctrl+S)"
            disabled={!dirty}
            onClick={store.sync}
          >
            <ArrowDownToLine size={14} aria-hidden="true" />
            <span>Sync</span>
            <kbd className="rounded bg-accent-fg/15 px-1 font-mono text-[11px] font-normal">Ctrl S</kbd>
          </Button>
        </div>
      )}
    </header>
  );
}
