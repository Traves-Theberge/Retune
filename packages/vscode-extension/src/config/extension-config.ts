import * as vscode from 'vscode';
import { RetuneExtensionConfig, StageOpenMode, ViewportPreset } from '@retune/core';

export function getRetuneConfig(): RetuneExtensionConfig {
  const cfg = vscode.workspace.getConfiguration('retune');
  return {
    daemonPort: cfg.get<number>('daemon.port', 49221),
    sandboxPort: cfg.get<number>('sandbox.port', 5173),
    openMode: cfg.get<StageOpenMode>('stage.openMode', 'split'),
    defaultViewport: cfg.get<ViewportPreset>('stage.defaultViewport', 'responsive'),
    showGrid: cfg.get<boolean>('stage.showGrid', true),
    autoSyncActiveEditor: cfg.get<boolean>('autoSyncActiveEditor', true),
    scalarLayout: cfg.get<'modern' | 'classic'>('scalar.layout', 'modern'),
  };
}

export async function updateRetuneConfig(patch: Partial<RetuneExtensionConfig>): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('retune');
  const target = vscode.ConfigurationTarget.Global;

  if (patch.daemonPort !== undefined) {
    await cfg.update('daemon.port', patch.daemonPort, target);
  }
  if (patch.sandboxPort !== undefined) {
    await cfg.update('sandbox.port', patch.sandboxPort, target);
  }
  if (patch.openMode !== undefined) {
    await cfg.update('stage.openMode', patch.openMode, target);
  }
  if (patch.defaultViewport !== undefined) {
    await cfg.update('stage.defaultViewport', patch.defaultViewport, target);
  }
  if (patch.showGrid !== undefined) {
    await cfg.update('stage.showGrid', patch.showGrid, target);
  }
  if (patch.autoSyncActiveEditor !== undefined) {
    await cfg.update('autoSyncActiveEditor', patch.autoSyncActiveEditor, target);
  }
  if (patch.scalarLayout !== undefined) {
    await cfg.update('scalar.layout', patch.scalarLayout, target);
  }
}

