import React from 'react';
import { ArrowDownToLine, ArrowLeft, Check, ChevronRight, Component, Eye, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import type { StageStore } from '../state/use-stage';
import { Button, IconButton } from './ui';

const VIEW_TITLES = { stage: '', ast: 'Code', api: 'API' } as const;

function fileBaseName(filePath?: string): string {
  return filePath ? filePath.split(/[\\/]/).pop() ?? '' : '';
}

export function StageHeader({ store, onCompare }: { store: StageStore; onCompare: (on: boolean) => void }) {
  const { stage, dirty, meta } = store;
  const onStage = stage.activeTab === 'stage';
  const fileName = fileBaseName(meta?.filePath);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel pr-3 pl-4 text-xs select-none">
      {!onStage && (
        <Button
          variant="ghost"
          size="md"
          className="-ml-2 rounded-md"
          onClick={() => store.patchStage({ activeTab: 'stage' })}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to stage</span>
        </Button>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent"
        >
          <Component size={14} />
        </span>
        {fileName && (
          <>
            <span className="truncate text-muted">{fileName}</span>
            <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-subtle" />
          </>
        )}
        <span className="truncate font-mono text-[13px] font-medium text-fg">{store.targetLabel}</span>
        {!onStage && <span className="shrink-0 text-subtle">{`· ${VIEW_TITLES[stage.activeTab]}`}</span>}
        {onStage &&
          (dirty ? (
            <span
              role="status"
              aria-label="Unsynced changes"
              className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn"
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-warn" />
              <span>Edited</span>
            </span>
          ) : (
            meta && (
              <span className="ml-1 flex shrink-0 items-center gap-1 text-[11px] text-subtle">
                <Check size={12} aria-hidden="true" />
                <span>In sync</span>
              </span>
            )
          ))}
      </div>

      <div className="flex-1" />

      {onStage && (
        <div className="flex shrink-0 items-center gap-1">
          {dirty && (
            <>
              <Button
                variant="ghost"
                size="md"
                className="rounded-md"
                title="Hold to see the version in the file"
                onPointerDown={() => onCompare(true)}
                onPointerUp={() => onCompare(false)}
                onPointerLeave={() => onCompare(false)}
                onPointerCancel={() => onCompare(false)}
              >
                <Eye size={14} aria-hidden="true" />
                <span>Compare</span>
              </Button>
              <Button variant="ghost" size="md" className="rounded-md" onClick={store.discard}>
                <RotateCcw size={14} aria-hidden="true" />
                <span>Discard</span>
              </Button>
              <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
            </>
          )}
          <div className="flex items-center rounded-lg bg-raised p-0.5">
            <IconButton
              icon={Undo2}
              label="Undo"
              className="size-7 rounded-md"
              disabled={!store.canUndo}
              onClick={store.undo}
            />
            <IconButton
              icon={Redo2}
              label="Redo"
              className="size-7 rounded-md"
              disabled={!store.canRedo}
              onClick={store.redo}
            />
          </div>
          <Button
            variant="primary"
            size="md"
            className="ml-1.5 h-8 rounded-lg px-3 shadow-sm"
            title="Sync to code (Ctrl+S)"
            disabled={!dirty}
            onClick={store.sync}
          >
            <ArrowDownToLine size={14} aria-hidden="true" />
            <span>Sync</span>
            <kbd className="ml-0.5 rounded bg-accent-fg/15 px-1 py-px font-mono text-[11px] font-normal">Ctrl S</kbd>
          </Button>
        </div>
      )}
    </header>
  );
}
