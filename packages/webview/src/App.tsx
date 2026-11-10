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
import { ViewportFrame } from './components/stage/viewport-frame';
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
  const [meta, setMeta] = useState<ComponentMetadata | null>(DEMO_META);
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
      const targetComp = stageState.targetElement || meta.componentName;
      postToHost({
        type: 'MUTATE_CLASSES',
        payload: { componentName: targetComp, className: newClasses },
      });

      // In standalone browser mode, also call the live local Retune Daemon AST mutation endpoint!
      if (isStandaloneBrowser) {
        try {
          const res = await fetch(`http://127.0.0.1:${config.daemonPort}/v1/components/mutate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileContent: meta.rawSource,
              componentName: targetComp,
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
        isDark ? 'dark bg-[#09090b] text-zinc-100' : 'bg-white text-zinc-900'
      }`}
    >
      {/* Dockable Inspector Sidebar (default on in standalone browser, toggleable in Editor Tab) */}
      {showSidebarSplit && (
        <aside className="w-72 shrink-0 h-full overflow-hidden">
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
        {/* Minimal 36px Editor Header Bar */}
        <header className="h-9 flex items-center justify-between px-3 border-b border-zinc-800/80 bg-[#0e0e12] text-[11px] select-none shrink-0">
          {/* Left: Inspector Toggle + File Breadcrumb + Editor Tabs */}
          <div className="flex items-center gap-3 h-full">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSidebarSplit((s) => !s)}
                title="Toggle Docked Inspector Panel"
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                  showSidebarSplit
                    ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300'
                    : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Inspector
              </button>
              <span className="font-mono text-zinc-300 font-medium">
                {meta?.componentName ? `${meta.componentName}.tsx` : 'Stage'}
              </span>
            </div>

            {stageState.activeTab !== 'stage' && (
              <button
                type="button"
                onClick={() => updateStageState({ activeTab: 'stage' })}
                className="px-2 py-0.5 rounded text-[10px] font-mono border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              >
                ← Stage
              </button>
            )}
          </div>

          {/* Right: Compact Viewport Controls & Sync */}
          <div className="flex items-center gap-1.5">
            {stageState.activeTab === 'stage' && (
              <>
                <div className="flex items-center bg-[#141419] border border-zinc-800/90 p-0.5 rounded text-[10px] font-mono">
                  {(
                    [
                      { id: 'responsive', label: 'Fluid' },
                      { id: 'mobile', label: '375' },
                      { id: 'tablet', label: '768' },
                      { id: 'desktop', label: '1024' },
                    ] as const
                  ).map((vp) => (
                    <button
                      key={vp.id}
                      type="button"
                      onClick={() => updateStageState({ viewport: vp.id })}
                      className={`px-1.5 py-0.5 rounded-[3px] transition ${
                        stageState.viewport === vp.id
                          ? 'bg-zinc-800 text-zinc-100 font-medium'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {vp.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => updateStageState({ showGrid: !stageState.showGrid })}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                    stageState.showGrid
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                      : 'bg-[#141419] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Grid
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => handleUpdateHarmonics(stageState.harmonicsClass, true)}
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition"
            >
              Sync Code
            </button>
          </div>
        </header>

        {/* Main Editor Tab Content */}
        <main className="flex-1 overflow-hidden relative">
          {stageState.activeTab === 'stage' && (
            <div className="flex flex-col h-full">
              <ViewportFrame
                componentName={meta?.componentName}
                targetElement={stageState.targetElement}
                computedClass={computedPreviewClass}
                viewport={stageState.viewport}
                showGrid={stageState.showGrid}
                propValues={stageState.propValues}
                onSyncAst={() => handleUpdateHarmonics(stageState.harmonicsClass, true)}
                onResetVariants={() =>
                  updateStageState({
                    selectedVariants: { ...(meta?.cva.defaultVariants || {}) },
                  })
                }
                onSelectViewport={(vp) => updateStageState({ viewport: vp })}
                onSwitchTab={(tab) => updateStageState({ activeTab: tab })}
              />
            </div>
          )}

          {stageState.activeTab === 'ast' && (
            <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-zinc-800/80 overflow-hidden bg-[#09090b]">
              {/* Extracted AST Metadata */}
              <div className="p-4 overflow-y-auto space-y-4">
                <div>
                  <h3 className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                    CVA Variant AST
                  </h3>
                  <pre className="p-3 rounded bg-[#111116] border border-zinc-800/80 text-[11px] font-mono text-zinc-200 overflow-x-auto">
                    {JSON.stringify(meta?.cva || { hasCva: false }, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                    TypeScript Props Interface
                  </h3>
                  <pre className="p-3 rounded bg-[#111116] border border-zinc-800/80 text-[11px] font-mono text-zinc-200 overflow-x-auto">
                    {JSON.stringify(meta?.props || [], null, 2)}
                  </pre>
                </div>
              </div>

              {/* Live TSX Source */}
              <div className="p-4 overflow-y-auto flex flex-col">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                  Source • {meta?.filePath || 'Active Component'}
                </h3>
                <pre className="flex-1 p-3 rounded bg-[#111116] border border-zinc-800/80 text-[11px] font-mono text-zinc-300 overflow-auto leading-relaxed">
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
