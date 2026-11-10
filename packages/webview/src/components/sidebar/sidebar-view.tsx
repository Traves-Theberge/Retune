import React, { useState } from 'react';
import {
  ComponentMetadata,
  RetuneExtensionConfig,
  StageState,
  ViewportPreset,
  StageOpenMode,
} from '@retune/core';

export interface SidebarViewProps {
  meta: ComponentMetadata | null;
  stageState: StageState;
  config: RetuneExtensionConfig;
  onSelectVariant: (group: string, value: string) => void;
  onCommitVariant: (group: string, value: string) => void;
  onUpdateProp: (propName: string, value: string | boolean | number) => void;
  onUpdateHarmonics: (classes: string, commit: boolean) => void;
  onUpdateStageState: (patch: Partial<StageState>) => void;
  onUpdateConfig: (patch: Partial<RetuneExtensionConfig>) => void;
  onOpenStageTab: (openMode?: StageOpenMode, tab?: 'stage' | 'ast' | 'api') => void;
}

export function SidebarView({
  meta,
  stageState,
  config,
  onSelectVariant,
  onCommitVariant,
  onUpdateProp,
  onUpdateHarmonics,
  onUpdateStageState,
  onUpdateConfig,
  onOpenStageTab,
}: SidebarViewProps) {
  const [sidebarTab, setSidebarTab] = useState<'params' | 'config'>('params');

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 text-xs select-none overflow-hidden">
      {/* Sidebar Top Navigation */}
      <div className="p-2.5 border-b border-zinc-800 bg-zinc-900/60 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="font-bold tracking-tight text-indigo-400">RETUNE</span>
            <span className="text-[10px] text-zinc-500 uppercase font-mono">Inspector</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenStageTab(config.openMode, 'stage')}
            className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition"
          >
            Open Stage Tab
          </button>
        </div>

        {/* Sidebar Section Switcher */}
        <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-md border border-zinc-800">
          <button
            type="button"
            onClick={() => setSidebarTab('params')}
            className={`py-1 rounded text-[11px] font-medium transition ${
              sidebarTab === 'params'
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Params & Tone
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('config')}
            className={`py-1 rounded text-[11px] font-medium transition ${
              sidebarTab === 'config'
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Configuration
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {sidebarTab === 'params' ? (
          <>
            {/* Active Component Summary Card */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Active Component
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    meta?.cva.hasCva
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {meta?.cva.hasCva ? 'CVA Ready' : 'Standard JSX'}
                </span>
              </div>
              <div className="font-mono text-sm font-semibold text-zinc-100 truncate">
                {meta?.componentName || 'No .tsx Component Active'}
              </div>
              {meta?.filePath && (
                <div className="font-mono text-[10px] text-zinc-500 truncate" title={meta.filePath}>
                  {meta.filePath}
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenStageTab('tab', 'stage')}
                  className="px-2 py-1 rounded border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 text-[11px] transition"
                >
                  Editor Tab
                </button>
                <button
                  type="button"
                  onClick={() => onOpenStageTab('split', 'stage')}
                  className="px-2 py-1 rounded border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 text-[11px] transition"
                >
                  Split Editor
                </button>
              </div>
            </section>

            {/* CVA Variants Parameter Section */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                  CVA Variants (Tone)
                </span>
                {meta?.cva.hasCva && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStageState({
                        selectedVariants: { ...meta.cva.defaultVariants },
                      })
                    }
                    className="text-[10px] text-indigo-400 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              {meta?.cva.hasCva ? (
                <div className="space-y-2.5">
                  {Object.entries(meta.cva.variants).map(([group, options]) => (
                    <div key={group} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-zinc-300 capitalize">
                          {group}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            onCommitVariant(group, stageState.selectedVariants[group] || options[0])
                          }
                          className="text-[10px] text-zinc-500 hover:text-indigo-400"
                          title="Write selected value to defaultVariants in TSX file"
                        >
                          Set Default
                        </button>
                      </div>
                      <select
                        value={stageState.selectedVariants[group] || ''}
                        onChange={(e) => onSelectVariant(group, e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 outline-none focus:border-indigo-500"
                      >
                        {options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 italic">
                  Open a component using <code className="text-zinc-400">cva(...)</code> to tune
                  variant parameters.
                </p>
              )}
            </section>

            {/* Component Props Inspector */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">
                Component Props
              </span>
              {meta?.props && meta.props.length > 0 ? (
                <div className="space-y-2">
                  {meta.props.map((prop) => (
                    <div key={prop.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-zinc-300">
                          {prop.name}
                          {prop.optional ? '?' : ''}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">{prop.type}</span>
                      </div>
                      {prop.type === 'boolean' ? (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(stageState.propValues[prop.name])}
                            onChange={(e) => onUpdateProp(prop.name, e.target.checked)}
                            className="rounded border-zinc-700 bg-zinc-900 text-indigo-600"
                          />
                          <span className="text-[11px] text-zinc-400">
                            {stageState.propValues[prop.name] ? 'true' : 'false'}
                          </span>
                        </label>
                      ) : (
                        <input
                          type={prop.type === 'number' ? 'number' : 'text'}
                          value={String(stageState.propValues[prop.name] ?? '')}
                          onChange={(e) =>
                            onUpdateProp(
                              prop.name,
                              prop.type === 'number' ? Number(e.target.value) : e.target.value
                            )
                          }
                          placeholder={`Enter ${prop.name}...`}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 font-mono text-[11px] outline-none focus:border-indigo-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-400 block">Preview Text / Children</label>
                  <input
                    type="text"
                    value={String(stageState.propValues.label ?? '')}
                    onChange={(e) => onUpdateProp('label', e.target.value)}
                    placeholder="Override preview text..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-[11px] outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </section>

            {/* Harmonics Tailwind Classes */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                  Harmonics Classes
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateHarmonics(stageState.harmonicsClass, true)}
                  className="text-[10px] px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  Apply to Code
                </button>
              </div>
              <textarea
                rows={3}
                value={stageState.harmonicsClass}
                onChange={(e) => onUpdateHarmonics(e.target.value, false)}
                placeholder="Tailwind utility classes..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-zinc-100 font-mono text-[11px] outline-none focus:border-indigo-500 resize-none"
              />
            </section>
          </>
        ) : (
          /* Configuration Tab */
          <section className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">
                Editor Tab & Stage Settings
              </span>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-300 block">Stage Open Mode</label>
                <select
                  value={config.openMode}
                  onChange={(e) =>
                    onUpdateConfig({ openMode: e.target.value as StageOpenMode })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 outline-none"
                >
                  <option value="split">Split Beside Active Editor</option>
                  <option value="tab">Full Editor Tab</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-300 block">Default Viewport Preset</label>
                <select
                  value={stageState.viewport}
                  onChange={(e) => {
                    const vp = e.target.value as ViewportPreset;
                    onUpdateStageState({ viewport: vp });
                    onUpdateConfig({ defaultViewport: vp });
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 outline-none"
                >
                  <option value="responsive">Responsive (Fluid)</option>
                  <option value="mobile">Mobile (375px)</option>
                  <option value="tablet">Tablet (768px)</option>
                  <option value="desktop">Desktop (1024px)</option>
                </select>
              </div>

              <label className="flex items-center justify-between cursor-pointer pt-1">
                <span className="text-[11px] text-zinc-300">Show Stage Dot Grid</span>
                <input
                  type="checkbox"
                  checked={stageState.showGrid}
                  onChange={(e) => {
                    onUpdateStageState({ showGrid: e.target.checked });
                    onUpdateConfig({ showGrid: e.target.checked });
                  }}
                  className="rounded border-zinc-700 bg-zinc-900 text-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[11px] text-zinc-300">Auto-Sync Active .tsx File</span>
                <input
                  type="checkbox"
                  checked={config.autoSyncActiveEditor}
                  onChange={(e) =>
                    onUpdateConfig({ autoSyncActiveEditor: e.target.checked })
                  }
                  className="rounded border-zinc-700 bg-zinc-900 text-indigo-600"
                />
              </label>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">
                Daemon & Scalar API Console
              </span>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-300 block">Retune Daemon Port</label>
                <input
                  type="number"
                  value={config.daemonPort}
                  onChange={(e) =>
                    onUpdateConfig({ daemonPort: Number(e.target.value) || 49221 })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 font-mono outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-300 block">Scalar Reference Layout</label>
                <select
                  value={config.scalarLayout}
                  onChange={(e) =>
                    onUpdateConfig({
                      scalarLayout: e.target.value as 'modern' | 'classic',
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 outline-none"
                >
                  <option value="modern">Modern</option>
                  <option value="classic">Classic</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => onOpenStageTab(config.openMode, 'api')}
                className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium transition"
              >
                Open Scalar API Tab
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

