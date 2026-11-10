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

const PADDING_X_OPTIONS = ['px-2', 'px-3', 'px-4', 'px-6', 'px-8'];
const PADDING_Y_OPTIONS = ['py-1', 'py-1.5', 'py-2', 'py-2.5', 'py-3'];
const HEIGHT_OPTIONS = ['h-7', 'h-8', 'h-9', 'h-10', 'h-11', 'h-12'];
const GAP_OPTIONS = ['gap-1', 'gap-1.5', 'gap-2', 'gap-3', 'gap-4'];
const TEXT_SIZE_OPTIONS = ['text-xs', 'text-sm', 'text-base', 'text-lg'];
const FONT_WEIGHT_OPTIONS = ['font-normal', 'font-medium', 'font-semibold', 'font-bold'];
const RADIUS_OPTIONS = [
  'rounded-none',
  'rounded',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-full',
];
const SHADOW_OPTIONS = ['shadow-none', 'shadow-sm', 'shadow', 'shadow-lg', 'shadow-xl'];

const BG_SWATCHES = [
  { label: 'Indigo', token: 'bg-indigo-600', swatch: '#4f46e5' },
  { label: 'Zinc', token: 'bg-zinc-800', swatch: '#27272a' },
  { label: 'Emerald', token: 'bg-emerald-600', swatch: '#059669' },
  { label: 'Rose', token: 'bg-rose-600', swatch: '#e11d48' },
  { label: 'Sky', token: 'bg-sky-600', swatch: '#0284c7' },
  { label: 'Violet', token: 'bg-violet-600', swatch: '#7c3aed' },
  { label: 'Amber', token: 'bg-amber-500', swatch: '#f59e0b' },
  { label: 'White', token: 'bg-white', swatch: '#ffffff' },
  { label: 'None', token: 'bg-transparent', swatch: 'transparent' },
];

const TEXT_SWATCHES = [
  { label: 'White', token: 'text-white', swatch: '#ffffff' },
  { label: 'Light', token: 'text-zinc-100', swatch: '#f4f4f5' },
  { label: 'Muted', token: 'text-zinc-400', swatch: '#a1a1aa' },
  { label: 'Dark', token: 'text-zinc-900', swatch: '#18181b' },
  { label: 'Indigo', token: 'text-indigo-300', swatch: '#a5b4fc' },
];

function replaceTokenGroup(current: string, groupTokens: string[], nextToken: string): string {
  const tokens = current.split(/\s+/).filter(Boolean);
  const filtered = tokens.filter((t) => !groupTokens.includes(t));
  if (!tokens.includes(nextToken)) {
    filtered.push(nextToken);
  }
  return filtered.join(' ');
}

function getActiveToken(current: string, groupTokens: string[]): string | undefined {
  const tokens = current.split(/\s+/).filter(Boolean);
  return tokens.find((t) => groupTokens.includes(t));
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
  const [activeSection, setActiveSection] = useState<'params' | 'style' | 'config'>('params');
  const [syncedFlash, setSyncedFlash] = useState(false);

  const classes = stageState.harmonicsClass || '';
  const activeTarget = stageState.targetElement || meta?.componentName || 'Component';

  const applyTokenGroup = (group: string[], token: string) => {
    const next = replaceTokenGroup(classes, group, token);
    onUpdateHarmonics(next, false);
  };

  const handleSyncToCode = () => {
    onUpdateHarmonics(classes, true);
    setSyncedFlash(true);
    setTimeout(() => setSyncedFlash(false), 1400);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0b0b0e] text-zinc-200 text-[11px] select-none overflow-hidden border-r border-zinc-800/80">
      {/* Top Minimal Header & Target Bar */}
      <div className="px-3 py-2 border-b border-zinc-800/80 bg-[#0e0e12] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
          <span className="font-mono font-semibold text-zinc-100 truncate">
            {`<${activeTarget} />`}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-800/90 text-[10px] font-mono text-zinc-400 shrink-0">
            {meta?.cva.hasCva ? 'CVA' : 'JSX'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOpenStageTab('split', 'stage')}
            title="Open Stage beside editor"
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/70 transition text-[10px]"
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => onOpenStageTab('tab', 'stage')}
            title="Open Stage as full tab"
            className="px-2 py-0.5 rounded bg-indigo-600/90 hover:bg-indigo-500 text-white transition text-[10px] font-medium"
          >
            Stage
          </button>
        </div>
      </div>

      {/* Minimal 3-Way Mode Switcher */}
      <div className="grid grid-cols-3 border-b border-zinc-800/80 bg-[#0b0b0e] px-2 pt-1 gap-1">
        {(
          [
            { id: 'params', label: 'Params' },
            { id: 'style', label: 'Style' },
            { id: 'config', label: 'Config' },
          ] as const
        ).map((tab) => {
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`py-1.5 text-[11px] font-medium border-b-2 transition ${
                active
                  ? 'border-indigo-500 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/70">
        {activeSection === 'params' && (
          <>
            {/* Content & Live Props Manipulation */}
            <div className="p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Props & Content
                </span>
                <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[140px]">
                  {meta?.filePath ? meta.filePath.split(/[\\/]/).pop() : ''}
                </span>
              </div>

              {/* Always show Label / Text override */}
              <div className="grid grid-cols-[72px_1fr] items-center gap-2">
                <label className="text-zinc-400 font-mono text-[11px] truncate">children</label>
                <input
                  type="text"
                  value={String(stageState.propValues.label ?? '')}
                  onChange={(e) => onUpdateProp('label', e.target.value)}
                  placeholder={meta?.componentName || 'Button text...'}
                  className="w-full bg-[#141419] border border-zinc-800 focus:border-indigo-500 rounded px-2 py-1 text-zinc-100 font-mono text-[11px] outline-none transition"
                />
              </div>

              {/* Dynamic TypeScript Props */}
              {meta?.props
                ?.filter((p) => p.name !== 'label')
                .map((prop) => (
                  <div key={prop.name} className="grid grid-cols-[72px_1fr] items-center gap-2">
                    <label
                      className="text-zinc-400 font-mono text-[11px] truncate"
                      title={`${prop.name}: ${prop.type}`}
                    >
                      {prop.name}
                    </label>
                    {prop.type === 'boolean' ? (
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateProp(prop.name, !Boolean(stageState.propValues[prop.name]))
                          }
                          className={`px-2.5 py-0.5 rounded font-mono text-[10px] border transition ${
                            stageState.propValues[prop.name]
                              ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                              : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {stageState.propValues[prop.name] ? 'true' : 'false'}
                        </button>
                        <span className="text-[10px] font-mono text-zinc-600">boolean</span>
                      </div>
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
                        placeholder={prop.type}
                        className="w-full bg-[#141419] border border-zinc-800 focus:border-indigo-500 rounded px-2 py-1 text-zinc-100 font-mono text-[11px] outline-none transition"
                      />
                    )}
                  </div>
                ))}

              {/* Fallback disabled state toggle if not in props */}
              {!meta?.props?.some((p) => p.name === 'disabled') && (
                <div className="grid grid-cols-[72px_1fr] items-center gap-2">
                  <label className="text-zinc-400 font-mono text-[11px]">disabled</label>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateProp('disabled', !Boolean(stageState.propValues.disabled))
                    }
                    className={`w-fit px-2.5 py-0.5 rounded font-mono text-[10px] border transition ${
                      stageState.propValues.disabled
                        ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                        : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {stageState.propValues.disabled ? 'true' : 'false'}
                  </button>
                </div>
              )}
            </div>

            {/* CVA Variants Matrix */}
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Variants (CVA)
                </span>
                {meta?.cva.hasCva && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStageState({
                        selectedVariants: { ...meta.cva.defaultVariants },
                      })
                    }
                    className="text-[10px] text-zinc-400 hover:text-indigo-400 transition"
                  >
                    Reset
                  </button>
                )}
              </div>

              {meta?.cva.hasCva ? (
                <div className="space-y-3">
                  {Object.entries(meta.cva.variants).map(([group, options]) => {
                    const currentVal =
                      stageState.selectedVariants[group] ||
                      meta.cva.defaultVariants[group] ||
                      options[0];
                    return (
                      <div key={group} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-zinc-300">{group}</span>
                          <button
                            type="button"
                            onClick={() => onCommitVariant(group, currentVal)}
                            className="text-[10px] font-mono text-zinc-500 hover:text-indigo-400 transition"
                            title="Save as defaultVariant in .tsx"
                          >
                            pin default
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {options.map((opt) => {
                            const isSelected = currentVal === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => onSelectVariant(group, opt)}
                                className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
                                  isSelected
                                    ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200 font-medium'
                                    : 'bg-[#141419] border-zinc-800/90 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-zinc-500 leading-relaxed">
                  No <code className="text-zinc-400 font-mono">cva()</code> call detected. Use the{' '}
                  <button
                    type="button"
                    onClick={() => setActiveSection('style')}
                    className="text-indigo-400 hover:underline"
                  >
                    Style
                  </button>{' '}
                  tab to manipulate layout, spacing, and surface tokens directly.
                </div>
              )}
            </div>

            {/* Viewport & Canvas Quick Controls */}
            <div className="p-3 space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                Canvas Viewport
              </span>
              <div className="grid grid-cols-4 gap-1 bg-[#141419] p-1 rounded border border-zinc-800/80">
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
                    onClick={() => onUpdateStageState({ viewport: vp.id })}
                    className={`py-1 rounded text-[10px] font-mono transition ${
                      stageState.viewport === vp.id
                        ? 'bg-zinc-800 text-zinc-100 font-medium shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {vp.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeSection === 'style' && (
          <>
            {/* Spacing & Sizing Controls */}
            <div className="p-3 space-y-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                Spacing & Sizing
              </span>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>Padding X</span>
                  <span className="text-indigo-400">
                    {getActiveToken(classes, PADDING_X_OPTIONS) || 'auto'}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {PADDING_X_OPTIONS.map((token) => {
                    const active = getActiveToken(classes, PADDING_X_OPTIONS) === token;
                    return (
                      <button
                        key={token}
                        type="button"
                        onClick={() => applyTokenGroup(PADDING_X_OPTIONS, token)}
                        className={`py-1 rounded font-mono text-[10px] border transition ${
                          active
                            ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                            : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {token.replace('px-', '')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>Padding Y</span>
                  <span className="text-indigo-400">
                    {getActiveToken(classes, PADDING_Y_OPTIONS) || 'auto'}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {PADDING_Y_OPTIONS.map((token) => {
                    const active = getActiveToken(classes, PADDING_Y_OPTIONS) === token;
                    return (
                      <button
                        key={token}
                        type="button"
                        onClick={() => applyTokenGroup(PADDING_Y_OPTIONS, token)}
                        className={`py-1 rounded font-mono text-[10px] border transition ${
                          active
                            ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                            : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {token.replace('py-', '')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>Height</span>
                  <span className="text-indigo-400">
                    {getActiveToken(classes, HEIGHT_OPTIONS) || 'auto'}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {HEIGHT_OPTIONS.map((token) => {
                    const active = getActiveToken(classes, HEIGHT_OPTIONS) === token;
                    return (
                      <button
                        key={token}
                        type="button"
                        onClick={() => applyTokenGroup(HEIGHT_OPTIONS, token)}
                        className={`py-1 rounded font-mono text-[10px] border transition ${
                          active
                            ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                            : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {token.replace('h-', '')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>Gap</span>
                  <span className="text-indigo-400">
                    {getActiveToken(classes, GAP_OPTIONS) || '0'}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {GAP_OPTIONS.map((token) => {
                    const active = getActiveToken(classes, GAP_OPTIONS) === token;
                    return (
                      <button
                        key={token}
                        type="button"
                        onClick={() => applyTokenGroup(GAP_OPTIONS, token)}
                        className={`py-1 rounded font-mono text-[10px] border transition ${
                          active
                            ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                            : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {token.replace('gap-', '')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Typography Controls */}
            <div className="p-3 space-y-2.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                Typography
              </span>
              <div className="grid grid-cols-4 gap-1">
                {TEXT_SIZE_OPTIONS.map((token) => {
                  const active = getActiveToken(classes, TEXT_SIZE_OPTIONS) === token;
                  return (
                    <button
                      key={token}
                      type="button"
                      onClick={() => applyTokenGroup(TEXT_SIZE_OPTIONS, token)}
                      className={`py-1 rounded font-mono text-[10px] border transition ${
                        active
                          ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                          : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {token.replace('text-', '')}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {FONT_WEIGHT_OPTIONS.map((token) => {
                  const active = getActiveToken(classes, FONT_WEIGHT_OPTIONS) === token;
                  return (
                    <button
                      key={token}
                      type="button"
                      onClick={() => applyTokenGroup(FONT_WEIGHT_OPTIONS, token)}
                      className={`py-1 rounded font-mono text-[10px] border transition ${
                        active
                          ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                          : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {token.replace('font-', '')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Surface & Color Swatches */}
            <div className="p-3 space-y-2.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                Surface & Color
              </span>
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-mono block">Background</span>
                <div className="grid grid-cols-3 gap-1">
                  {BG_SWATCHES.map((item) => {
                    const groupTokens = BG_SWATCHES.map((s) => s.token);
                    const active = getActiveToken(classes, groupTokens) === item.token;
                    return (
                      <button
                        key={item.token}
                        type="button"
                        onClick={() => applyTokenGroup(groupTokens, item.token)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono transition ${
                          active
                            ? 'bg-indigo-600/20 border-indigo-500 text-zinc-100'
                            : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-zinc-600 shrink-0"
                          style={{ backgroundColor: item.swatch }}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-mono block">Text Color</span>
                <div className="grid grid-cols-5 gap-1">
                  {TEXT_SWATCHES.map((item) => {
                    const groupTokens = TEXT_SWATCHES.map((s) => s.token);
                    const active = getActiveToken(classes, groupTokens) === item.token;
                    return (
                      <button
                        key={item.token}
                        type="button"
                        onClick={() => applyTokenGroup(groupTokens, item.token)}
                        className={`py-1 rounded border text-[10px] font-mono transition ${
                          active
                            ? 'bg-indigo-600/20 border-indigo-500 text-zinc-100'
                            : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Radius & Shadow */}
            <div className="p-3 space-y-2.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                Radius & Elevation
              </span>
              <div className="grid grid-cols-6 gap-1">
                {RADIUS_OPTIONS.map((token) => {
                  const active = getActiveToken(classes, RADIUS_OPTIONS) === token;
                  const label = token === 'rounded' ? 'base' : token.replace('rounded-', '');
                  return (
                    <button
                      key={token}
                      type="button"
                      onClick={() => applyTokenGroup(RADIUS_OPTIONS, token)}
                      className={`py-1 rounded font-mono text-[10px] border transition ${
                        active
                          ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                          : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-5 gap-1">
                {SHADOW_OPTIONS.map((token) => {
                  const active = getActiveToken(classes, SHADOW_OPTIONS) === token;
                  const label = token === 'shadow' ? 'md' : token.replace('shadow-', '');
                  return (
                    <button
                      key={token}
                      type="button"
                      onClick={() => applyTokenGroup(SHADOW_OPTIONS, token)}
                      className={`py-1 rounded font-mono text-[10px] border transition ${
                        active
                          ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                          : 'bg-[#141419] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeSection === 'config' && (
          <div className="p-3 space-y-3">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
              Workspace Configuration
            </span>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 block">Stage Open Mode</label>
              <select
                value={config.openMode}
                onChange={(e) => onUpdateConfig({ openMode: e.target.value as StageOpenMode })}
                className="w-full bg-[#141419] border border-zinc-800 rounded px-2 py-1.5 text-zinc-100 outline-none focus:border-indigo-500"
              >
                <option value="split">Split Beside Editor</option>
                <option value="tab">Full Editor Tab</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 block">Default Viewport</label>
              <select
                value={stageState.viewport}
                onChange={(e) => {
                  const vp = e.target.value as ViewportPreset;
                  onUpdateStageState({ viewport: vp });
                  onUpdateConfig({ defaultViewport: vp });
                }}
                className="w-full bg-[#141419] border border-zinc-800 rounded px-2 py-1.5 text-zinc-100 outline-none focus:border-indigo-500"
              >
                <option value="responsive">Responsive (Fluid)</option>
                <option value="mobile">Mobile (375px)</option>
                <option value="tablet">Tablet (768px)</option>
                <option value="desktop">Desktop (1024px)</option>
              </select>
            </div>

            <label className="flex items-center justify-between py-1 cursor-pointer">
              <span className="text-zinc-300">Show Canvas Grid</span>
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

            <label className="flex items-center justify-between py-1 cursor-pointer">
              <span className="text-zinc-300">Auto-Sync Active Editor</span>
              <input
                type="checkbox"
                checked={config.autoSyncActiveEditor}
                onChange={(e) => onUpdateConfig({ autoSyncActiveEditor: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-900 text-indigo-600"
              />
            </label>

            <div className="space-y-1 pt-1 border-t border-zinc-800/70">
              <label className="text-[11px] text-zinc-400 block">Daemon Port</label>
              <input
                type="number"
                value={config.daemonPort}
                onChange={(e) => onUpdateConfig({ daemonPort: Number(e.target.value) || 49221 })}
                className="w-full bg-[#141419] border border-zinc-800 rounded px-2 py-1 text-zinc-100 font-mono outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onOpenStageTab(config.openMode, 'ast')}
                className="py-1.5 rounded bg-[#141419] hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"
              >
                AST & Code
              </button>
              <button
                type="button"
                onClick={() => onOpenStageTab(config.openMode, 'api')}
                className="py-1.5 rounded bg-[#141419] hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"
              >
                Scalar API
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Class String & AST Sync Dock */}
      <div className="p-2.5 border-t border-zinc-800/80 bg-[#0e0e12] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            className
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onUpdateHarmonics(meta?.cva.baseClasses || '', false)
              }
              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSyncToCode}
              className={`px-2.5 py-0.5 rounded text-[10px] font-medium transition ${
                syncedFlash
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {syncedFlash ? 'Synced ✓' : 'Sync to Code'}
            </button>
          </div>
        </div>
        <textarea
          rows={2}
          value={classes}
          onChange={(e) => onUpdateHarmonics(e.target.value, false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSyncToCode();
            }
          }}
          placeholder="Tailwind utility classes..."
          className="w-full bg-[#141419] border border-zinc-800 focus:border-indigo-500 rounded p-1.5 text-zinc-200 font-mono text-[10px] leading-relaxed outline-none resize-none"
        />
      </div>
    </div>
  );
}
