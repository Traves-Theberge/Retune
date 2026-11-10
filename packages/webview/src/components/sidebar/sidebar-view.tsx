import React, { useEffect, useState } from 'react';
import {
  ComponentMetadata,
  RetuneExtensionConfig,
  StageState,
  ViewportPreset,
  StageOpenMode,
} from '@retune/core';
import { addClasses, removeClass, splitClasses } from '../../lib/arbitrary-style';
import {
  BG_TOKENS, GAP, HEIGHT, PX, PY, RADIUS, SHADOW, TEXT_SIZE, WEIGHT,
  Row, Segmented, Section, createClassEditor, field,
} from '../controls';

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

/* ---------- Sidebar ---------- */

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
  const classes = stageState.harmonicsClass || '';
  const activeTarget = stageState.targetElement || meta?.componentName || 'Component';
  const [classDraft, setClassDraft] = useState('');
  const [baseline, setBaseline] = useState(classes);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setBaseline(classes);
    // Re-baseline only when switching to another component/element
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.filePath, stageState.targetElement]);

  const dirty = classes !== baseline;
  const set = (next: string) => onUpdateHarmonics(next, false);

  const sync = () => {
    onUpdateHarmonics(classes, true);
    setBaseline(classes);
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  };

  const { activePreset, pickPreset, len, col, opacity, swatches, weight, radiusPresets, shadowPresets } =
    createClassEditor(classes, set);

  const props = meta?.props?.filter((p) => p.name !== 'label') ?? [];

  return (
    <div className="flex flex-col h-screen bg-[#0b0b0e] text-zinc-200 text-[11px] select-none overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-zinc-800/80 bg-[#0e0e12] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono font-semibold text-zinc-100 truncate">{`<${activeTarget} />`}</div>
          <div className="text-[10px] text-zinc-500 font-mono truncate">
            {meta?.cva.hasCva ? 'cva' : 'jsx'}
            {meta?.filePath ? ` · ${meta.filePath.split(/[\\/]/).pop()}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenStageTab(config.openMode, 'stage')}
            className="px-2 py-1 rounded border border-zinc-700/80 text-zinc-300 hover:bg-zinc-800 transition text-[10px]"
          >
            Stage
          </button>
          <button
            type="button"
            onClick={sync}
            className={`px-2.5 py-1 rounded text-[10px] font-medium text-white transition flex items-center gap-1 ${
              flash ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {dirty && !flash && <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />}
            {flash ? 'Synced ✓' : 'Sync'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Content & props */}
        <Section title="Content">
          <Row label="text">
            <input
              type="text"
              value={String(stageState.propValues.label ?? '')}
              onChange={(e) => onUpdateProp('label', e.target.value)}
              placeholder={meta?.componentName || 'Label'}
              className={`${field} w-full px-2 py-1 text-[11px]`}
            />
          </Row>
          {props.map((prop) => (
            <Row key={prop.name} label={prop.name}>
              {prop.type === 'boolean' ? (
                <Segmented
                  options={[
                    { id: 'false', label: 'false' },
                    { id: 'true', label: 'true' },
                  ]}
                  active={String(Boolean(stageState.propValues[prop.name]))}
                  onPick={(id) => onUpdateProp(prop.name, id === 'true')}
                />
              ) : (
                <input
                  type={prop.type === 'number' ? 'number' : 'text'}
                  value={String(stageState.propValues[prop.name] ?? '')}
                  placeholder={prop.type}
                  onChange={(e) =>
                    onUpdateProp(
                      prop.name,
                      prop.type === 'number' ? Number(e.target.value) : e.target.value
                    )
                  }
                  className={`${field} w-full px-2 py-1 text-[11px] font-mono`}
                />
              )}
            </Row>
          ))}
          {!meta?.props?.some((p) => p.name === 'disabled') && (
            <Row label="disabled">
              <Segmented
                options={[
                  { id: 'false', label: 'false' },
                  { id: 'true', label: 'true' },
                ]}
                active={String(Boolean(stageState.propValues.disabled))}
                onPick={(id) => onUpdateProp('disabled', id === 'true')}
              />
            </Row>
          )}
        </Section>

        {/* Variants */}
        {meta?.cva.hasCva && (
          <Section title="Variants">
            {Object.entries(meta.cva.variants).map(([group, options]) => {
              const current =
                stageState.selectedVariants[group] || meta.cva.defaultVariants[group] || options[0];
              return (
                <div key={group} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-zinc-300">{group}</span>
                    <button
                      type="button"
                      onClick={() => onCommitVariant(group, current)}
                      className="text-[10px] text-zinc-500 hover:text-indigo-400 transition"
                      title="Write as defaultVariant in the file"
                    >
                      set default
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onSelectVariant(group, opt)}
                        className={`px-2 py-0.5 rounded border text-[10px] font-mono transition ${
                          current === opt
                            ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                            : 'bg-[#16161b] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </Section>
        )}

        {/* Layout */}
        <Section title="Layout">
          <Row label="pad X">{len('px', PX, 0, 64)}</Row>
          <Row label="pad Y">{len('py', PY, 0, 48)}</Row>
          <Row label="gap">{len('gap', GAP, 0, 32)}</Row>
          <Row label="width">{len('w', [], 0, 600, 4)}</Row>
          <Row label="height">{len('h', HEIGHT, 0, 200)}</Row>
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <Row label="size">{len('text', TEXT_SIZE, 8, 64)}</Row>
          <Row label="weight">{weight}</Row>
          <Row label="spacing">{len('tracking', [], -4, 16, 0.5)}</Row>
          <Row label="color">{col('text')}</Row>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <Row label="fill">{col('bg', BG_TOKENS)}</Row>
          <div className="pl-[72px]">{swatches}</div>
          <Row label="border">{len('border', [], 0, 12)}</Row>
          <Row label="stroke">{col('border')}</Row>
          <Row label="radius">{len('rounded', RADIUS, 0, 48)}</Row>
          <Row label="">{radiusPresets}</Row>
          <Row label="shadow">{shadowPresets}</Row>
          <Row label="opacity">{opacity}</Row>
        </Section>

        {/* Raw class editor */}
        <Section title={`Classes · ${splitClasses(classes).length}`}>
          <div className="flex flex-wrap gap-1">
            {splitClasses(classes).map((token) => (
              <span
                key={token}
                className="group inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded bg-[#16161b] border border-zinc-800 font-mono text-[10px] text-zinc-300"
              >
                {token}
                <button
                  type="button"
                  onClick={() => set(removeClass(classes, token))}
                  className="text-zinc-600 hover:text-rose-400 transition"
                  title="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={classDraft}
            onChange={(e) => setClassDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && classDraft.trim()) {
                set(addClasses(classes, classDraft));
                setClassDraft('');
              }
            }}
            placeholder="Add classes · Enter  (e.g. hover:bg-indigo-500 w-[220px])"
            className={`${field} w-full px-2 py-1 text-[11px] font-mono`}
          />
          <div className="flex items-center justify-between text-[10px]">
            <button
              type="button"
              onClick={() => set(meta?.cva.baseClasses || '')}
              className="text-zinc-500 hover:text-zinc-300 transition"
            >
              Reset to base
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(classes)}
              className="text-zinc-500 hover:text-zinc-300 transition"
            >
              Copy
            </button>
          </div>
        </Section>

        {/* Workspace */}
        <Section title="Workspace" defaultOpen={false}>
          <Row label="open">
            <Segmented
              options={[
                { id: 'split', label: 'Split' },
                { id: 'tab', label: 'Tab' },
              ]}
              active={config.openMode}
              onPick={(id) => onUpdateConfig({ openMode: id as StageOpenMode })}
            />
          </Row>
          <Row label="viewport">
            <Segmented
              options={[
                { id: 'responsive', label: 'Fluid' },
                { id: 'mobile', label: '375' },
                { id: 'tablet', label: '768' },
                { id: 'desktop', label: '1024' },
              ]}
              active={stageState.viewport}
              onPick={(id) => {
                const vp = id as ViewportPreset;
                onUpdateStageState({ viewport: vp });
                onUpdateConfig({ defaultViewport: vp });
              }}
            />
          </Row>
          <Row label="grid">
            <Segmented
              options={[
                { id: 'off', label: 'Off' },
                { id: 'on', label: 'On' },
              ]}
              active={stageState.showGrid ? 'on' : 'off'}
              onPick={(id) => {
                onUpdateStageState({ showGrid: id === 'on' });
                onUpdateConfig({ showGrid: id === 'on' });
              }}
            />
          </Row>
          <Row label="auto-sync">
            <Segmented
              options={[
                { id: 'off', label: 'Off' },
                { id: 'on', label: 'On' },
              ]}
              active={config.autoSyncActiveEditor ? 'on' : 'off'}
              onPick={(id) => onUpdateConfig({ autoSyncActiveEditor: id === 'on' })}
            />
          </Row>
          <Row label="port">
            <input
              type="number"
              value={config.daemonPort}
              onChange={(e) => onUpdateConfig({ daemonPort: Number(e.target.value) || 49221 })}
              className={`${field} w-full px-2 py-1 text-[11px] font-mono`}
            />
          </Row>
        </Section>
      </div>
    </div>
  );
}
