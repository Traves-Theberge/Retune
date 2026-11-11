import React from 'react';
import { Grid3x3, Moon, Redo2, Sun, Undo2 } from 'lucide-react';
import type { StageTabId } from '@retune/core';
import type { StageStore } from '../state/use-stage';
import { Button, IconButton, Segmented } from './ui';
import { ViewportSwitch } from './shared/viewport-switch';

const VIEW_OPTIONS: { id: StageTabId; label: string }[] = [
  { id: 'stage', label: 'Stage' },
  { id: 'ast', label: 'Code' },
  { id: 'api', label: 'API' },
];

export function StageHeader({
  store,
  tone,
  onToggleTone,
  onCompare,
}: {
  store: StageStore;
  tone: 'dark' | 'light';
  onToggleTone: () => void;
  onCompare: (on: boolean) => void;
}) {
  const { stage, dirty } = store;
  const onStage = stage.activeTab === 'stage';

  return (
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-panel px-2 text-[11px] select-none">
      <Segmented
        label="View"
        active={stage.activeTab}
        onPick={(id) => store.patchStage({ activeTab: id as StageTabId })}
        options={VIEW_OPTIONS}
      />

      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-mono text-fg">{store.targetLabel}</span>
        {dirty && <span role="img" aria-label="Unsynced changes" className="size-1.5 shrink-0 rounded-full bg-warn" />}
      </div>

      <div className="flex-1" />

      {onStage && (
        <>
          <IconButton
            icon={Undo2}
            label="Undo"
            disabled={!store.canUndo}
            onClick={store.undo}
          />
          <IconButton
            icon={Redo2}
            label="Redo"
            disabled={!store.canRedo}
            onClick={store.redo}
          />
          <Button
            variant="ghost"
            disabled={!dirty}
            onPointerDown={() => onCompare(true)}
            onPointerUp={() => onCompare(false)}
            onPointerLeave={() => onCompare(false)}
          >
            Compare
          </Button>
          <Button variant="ghost" disabled={!dirty} onClick={store.discard}>
            Discard
          </Button>
          <Button variant="primary" title="Sync to code (Ctrl+S)" disabled={!dirty} onClick={store.sync}>
            Sync
          </Button>
          <ViewportSwitch value={stage.viewport} onChange={(viewport) => store.patchStage({ viewport })} />
          <IconButton
            icon={Grid3x3}
            label="Grid"
            active={stage.showGrid}
            onClick={() => store.patchStage({ showGrid: !stage.showGrid })}
          />
          <IconButton
            icon={tone === 'light' ? Sun : Moon}
            label="Canvas tone"
            onClick={onToggleTone}
          />
        </>
      )}
    </header>
  );
}
