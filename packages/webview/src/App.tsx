import React, { useState, useEffect, useMemo } from 'react';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import {
  ComponentMetadata,
  WebviewMessage,
  HostMessage,
  RetuneExtensionConfig,
  StageState,
  ViewportPreset,
  StageOpenMode,
  StageTabId,
} from '@retune/core';
import { ToneSelector } from './components/stage/tone-selector';
import { ViewportFrame } from './components/stage/viewport-frame';
import { HarmonicsBar } from './components/stage/harmonics-bar';
import { SidebarView } from './components/sidebar/sidebar-view';

declare global {
  interface Window {
    RETUNE_VIEW_MODE?: 'editor-tab' | 'sidebar';
  }
}

declare const vscode:
  | {
      postMessage: (message: WebviewMessage) => void;
    }
  | undefined;

const DEFAULT_CONFIG: RetuneExtensionConfig = {
  daemonPort: 49221,
  sandboxPort: 5173,
  openMode: 'split',
  defaultViewport: 'responsive',
  showGrid: true,
  autoSyncActiveEditor: true,
  scalarLayout: 'modern',
};

const DEFAULT_STAGE_STATE: StageState = {
  selectedVariants: {
    variant: 'default',
    size: 'default',
  },
  propValues: {
    label: 'Launch Retune Stage',
    disabled: false,
  },
  harmonicsClass:
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
  viewport: 'responsive',
  showGrid: true,
  activeTab: 'stage',
};

const DEMO_SOURCE = `import * as React from 'react';
import { cva } from 'class-variance-authority';

// Non-lossy AST comments are preserved on mutation!
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-indigo-600 text-white shadow hover:bg-indigo-500',
        destructive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-500',
        outline: 'border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800',
        secondary: 'bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700',
        ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-white',
      },
      size: {
        default: 'h-9 px-4 py-2 text-sm',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps {
  label: string;
  disabled?: boolean;
}

export function Button({ label = 'Launch Retune Stage', disabled = false }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors"
    >
      {label}
    </button>
  );
}
`;

const DEMO_META: ComponentMetadata = {
  componentName: 'Button',
  filePath: 'examples/Button.tsx',
  cva: {
    hasCva: true,
    cvaIdentifier: 'buttonVariants',
    baseClasses:
      'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
    variants: {
      variant: ['default', 'destructive', 'outline', 'secondary', 'ghost'],
      size: ['default', 'sm', 'lg'],
    },
    variantClasses: {
      variant: {
        default: 'bg-indigo-600 text-white shadow hover:bg-indigo-500',
        destructive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-500',
        outline: 'border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800',
        secondary: 'bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700',
        ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-white',
      },
      size: {
        default: 'h-9 px-4 py-2 text-sm',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
  props: [
    { name: 'label', type: 'string', optional: false },
    { name: 'disabled', type: 'boolean', optional: true },
  ],
  rawSource: DEMO_SOURCE,
};

export function App() {
  const isStandaloneBrowser = typeof vscode === 'undefined';

  const initialMode = useMemo(() => {
    if (typeof window !== 'undefined') {
      if (window.RETUNE_VIEW_MODE) return window.RETUNE_VIEW_MODE;
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'sidebar') return 'sidebar';
    }
    return 'editor-tab';
  }, []);

  const [showSidebarSplit, setShowSidebarSplit] = useState<boolean>(isStandaloneBrowser);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [meta, setMeta] = useState<ComponentMetadata | null>(
    isStandaloneBrowser ? DEMO_META : null
  );
  const [config, setConfig] = useState<RetuneExtensionConfig>(DEFAULT_CONFIG);
  const [stageState, setStageState] = useState<StageState>(DEFAULT_STAGE_STATE);

  const postToHost = (message: WebviewMessage) => {
    if (typeof vscode !== 'undefined' && vscode?.postMessage) {
      vscode.postMessage(message);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent<HostMessage>) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'SYNC_COMPONENT') {
        setMeta(msg.payload);
        setStageState((prev) => ({
          ...prev,
          selectedVariants: msg.payload.cva.defaultVariants || {},
          harmonicsClass: msg.payload.cva.baseClasses || prev.harmonicsClass,
        }));
      } else if (msg.type === 'SYNC_STAGE_STATE') {
        setStageState(msg.payload);
      } else if (msg.type === 'SYNC_CONFIG') {
        setConfig(msg.payload);
      } else if (msg.type === 'THEME_CHANGED') {
        setIsDark(msg.payload.isDark);
      }
    };

    window.addEventListener('message', handleMessage);
    postToHost({ type: 'READY' });
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const updateStageState = (patch: Partial<StageState>) => {
    setStageState((prev) => {
      const next = { ...prev, ...patch };
      postToHost({ type: 'UPDATE_STAGE_STATE', payload: patch });
      return next;
    });
  };

  const handleSelectVariant = (group: string, value: string) => {
    updateStageState({
      selectedVariants: {
        ...stageState.selectedVariants,
        [group]: value,
      },
    });
  };

  const handleCommitVariant = (group: string, value: string) => {
    handleSelectVariant(group, value);
    postToHost({
      type: 'MUTATE_VARIANT',
      payload: { variantGroup: group, variantValue: value },
    });
  };

  const handleUpdateProp = (propName: string, value: string | boolean | number) => {
    updateStageState({
      propValues: {
        ...stageState.propValues,
        [propName]: value,
      },
    });
    postToHost({
      type: 'UPDATE_PROP_VALUE',
      payload: { propName, value },
    });
  };

  const handleUpdateHarmonics = async (newClasses: string, commit: boolean) => {
    updateStageState({ harmonicsClass: newClasses });
    if (commit && meta) {
      postToHost({
        type: 'MUTATE_CLASSES',
        payload: { componentName: meta.componentName, className: newClasses },
      });

      // In standalone browser mode, also call the live local Retune Daemon AST mutation endpoint!
      if (isStandaloneBrowser) {
        try {
          const res = await fetch(`http://127.0.0.1:${config.daemonPort}/v1/components/mutate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileContent: meta.rawSource,
              componentName: meta.componentName,
              className: newClasses,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.updatedContent) {
              setMeta((prev) => (prev ? { ...prev, rawSource: data.updatedContent } : prev));
            }
          }
        } catch {
          // Daemon may not be running in pure frontend preview
        }
      }
    }
  };

  const handleUpdateConfig = (patch: Partial<RetuneExtensionConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    postToHost({ type: 'UPDATE_CONFIG', payload: patch });
  };

  const handleOpenStageTab = (openMode?: StageOpenMode, tab?: StageTabId) => {
    if (tab) {
      updateStageState({ activeTab: tab });
    }
    postToHost({ type: 'OPEN_STAGE_TAB', payload: { openMode, tab } });
  };

  const computedPreviewClass = useMemo(() => {
    const parts = [stageState.harmonicsClass];
    if (meta?.cva.hasCva && meta.cva.variantClasses) {
      for (const [group, selectedOpt] of Object.entries(stageState.selectedVariants)) {
        const optClass = meta.cva.variantClasses[group]?.[selectedOpt];
        if (optClass) parts.push(optClass);
      }
    }
    return parts.filter(Boolean).join(' ').trim();
  }, [stageState.harmonicsClass, stageState.selectedVariants, meta]);

  if (initialMode === 'sidebar') {
    return (
      <SidebarView
        meta={meta}
        stageState={stageState}
        config={config}
        onSelectVariant={handleSelectVariant}
        onCommitVariant={handleCommitVariant}
        onUpdateProp={handleUpdateProp}
        onUpdateHarmonics={handleUpdateHarmonics}
        onUpdateStageState={updateStageState}
        onUpdateConfig={handleUpdateConfig}
        onOpenStageTab={handleOpenStageTab}
      />
    );
  }

  return (
    <div
      className={`flex h-screen overflow-hidden ${
        isDark ? 'dark bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'
      }`}
    >
      {/* In standalone preview mode, optionally dock the VS Code Activity Bar Sidebar on the left */}
      {showSidebarSplit && (
        <aside className="w-80 border-r border-zinc-800 shrink-0 h-full overflow-hidden">
          <SidebarView
            meta={meta}
            stageState={stageState}
            config={config}
            onSelectVariant={handleSelectVariant}
            onCommitVariant={handleCommitVariant}
            onUpdateProp={handleUpdateProp}
            onUpdateHarmonics={handleUpdateHarmonics}
            onUpdateStageState={updateStageState}
            onUpdateConfig={handleUpdateConfig}
            onOpenStageTab={handleOpenStageTab}
          />
        </aside>
      )}

      {/* Main Editor Tab Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* VS Code Editor Tab Strip & Stage Controls */}
        <header className="flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900/80 select-none">
          {/* Left: Brand + Editor Tabs */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 py-2.5">
              {isStandaloneBrowser && (
                <button
                  type="button"
                  onClick={() => setShowSidebarSplit((s) => !s)}
                  title="Toggle VS Code Sidebar Drawer"
                  className={`px-2 py-0.5 rounded text-[11px] border mr-1 transition ${
                    showSidebarSplit
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  Sidebar
                </button>
              )}
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="font-bold tracking-tight text-indigo-400 text-xs">RETUNE</span>
              <span className="text-xs text-zinc-700">/</span>
              <span className="text-xs font-mono text-zinc-300">
                {meta?.componentName ? `${meta.componentName}.tsx` : 'No Component Active'}
              </span>
            </div>

            {/* Editor Tab System */}
            <nav className="flex items-center gap-1 pt-1">
              {(
                [
                  { id: 'stage', label: 'The Stage' },
                  { id: 'ast', label: 'AST & Props' },
                  { id: 'api', label: 'Scalar API' },
                ] as const
              ).map((tab) => {
                const isActive = stageState.activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => updateStageState({ activeTab: tab.id })}
                    className={`px-3.5 py-2 text-xs font-medium border-b-2 transition ${
                      isActive
                        ? 'border-indigo-500 text-white bg-zinc-950/60 rounded-t-md'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 rounded-t-md'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right: Viewport Presets & Grid Toggle */}
          <div className="flex items-center gap-2 py-1.5">
            {stageState.activeTab === 'stage' && (
              <>
                <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-md text-[11px]">
                  {(['responsive', 'mobile', 'tablet', 'desktop'] as ViewportPreset[]).map((vp) => (
                    <button
                      key={vp}
                      type="button"
                      onClick={() => updateStageState({ viewport: vp })}
                      className={`px-2 py-0.5 rounded capitalize transition ${
                        stageState.viewport === vp
                          ? 'bg-indigo-600 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {vp}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => updateStageState({ showGrid: !stageState.showGrid })}
                  className={`px-2.5 py-1 rounded text-[11px] border transition ${
                    stageState.showGrid
                      ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  Grid
                </button>
              </>
            )}
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              :{config.daemonPort}
            </span>
          </div>
        </header>

        {/* Main Editor Tab Content */}
        <main className="flex-1 overflow-hidden relative">
          {stageState.activeTab === 'stage' && (
            <div className="flex flex-col h-full">
              <ToneSelector
                cva={meta?.cva}
                selectedVariants={stageState.selectedVariants}
                onSelectVariant={handleSelectVariant}
                onCommitVariant={handleCommitVariant}
              />

              <ViewportFrame
                componentName={meta?.componentName}
                computedClass={computedPreviewClass}
                viewport={stageState.viewport}
                showGrid={stageState.showGrid}
                propValues={stageState.propValues}
              />

              <HarmonicsBar
                value={stageState.harmonicsClass}
                onChange={(val) => handleUpdateHarmonics(val, false)}
                onCommit={(val) => handleUpdateHarmonics(val, true)}
              />
            </div>
          )}

          {stageState.activeTab === 'ast' && (
            <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-zinc-800 overflow-hidden">
              {/* Extracted AST Metadata */}
              <div className="p-4 overflow-y-auto space-y-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                    Extracted CVA Metadata
                  </h3>
                  <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 overflow-x-auto">
                    {JSON.stringify(meta?.cva || { hasCva: false }, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                    Extracted TypeScript Props
                  </h3>
                  <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 overflow-x-auto">
                    {JSON.stringify(meta?.props || [], null, 2)}
                  </pre>
                </div>
              </div>

              {/* Live TSX Source */}
              <div className="p-4 overflow-y-auto flex flex-col">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Live TSX Source ({meta?.filePath || 'No File'})
                </h3>
                <pre className="flex-1 p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-300 overflow-auto">
                  {meta?.rawSource || '// Focus a .tsx file in VS Code to inspect its AST'}
                </pre>
              </div>
            </div>
          )}

          {stageState.activeTab === 'api' && (
            <div className="h-full w-full overflow-y-auto">
              <ApiReferenceReact
                configuration={
                  {
                    url: `http://127.0.0.1:${config.daemonPort}/v1/openapi.json`,
                    spec: { url: `http://127.0.0.1:${config.daemonPort}/v1/openapi.json` },
                    darkMode: isDark,
                    layout: config.scalarLayout,
                  } as any
                }
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
