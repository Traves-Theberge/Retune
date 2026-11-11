import React from 'react';
import type { StageOpenMode } from '@retune/core';
import type { StageStore } from '../../state/use-stage';
import { splitClasses } from '../../lib/arbitrary-style';
import { BG_TOKENS, GAP, HEIGHT, PX, PY, RADIUS, TEXT_SIZE, createClassEditor } from '../controls';
import { Button, EmptyState, Row, Section, Segmented, fieldClass } from '../ui';
import { ClassChips } from '../shared/class-chips';
import { ElementList } from '../shared/element-list';
import { VariantPicker } from '../shared/variant-picker';
import { ViewportSwitch } from '../shared/viewport-switch';

const BOOLEAN_OPTIONS = [
  { id: 'false', label: 'false' },
  { id: 'true', label: 'true' },
];

const TOGGLE_OPTIONS = [
  { id: 'off', label: 'Off' },
  { id: 'on', label: 'On' },
];

export function SidebarView({ store, embedded }: { store: StageStore; embedded?: boolean }) {
  const { meta, stage, config, dirty } = store;
  const classes = stage.harmonicsClass;
  const tokens = splitClasses(classes);
  const ed = createClassEditor(classes, store.setClasses);
  const props = meta?.props?.filter((p) => p.name !== 'label') ?? [];
  const fileName = meta?.filePath ? meta.filePath.split(/[\\/]/).pop() : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(classes);
      store.notify('Copied className', 'info');
    } catch {
      store.notify('Copy failed', 'error');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-panel text-fg text-xs">
      {!embedded && (
        <header className="flex items-center justify-between gap-2 border-b border-line bg-panel px-3 py-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-mono text-fg">{store.targetLabel}</span>
              {dirty && <span role="img" aria-label="Unsynced changes" className="size-1.5 shrink-0 rounded-full bg-warn" />}
            </div>
            <div className="truncate text-subtle">
              {meta?.cva.hasCva ? 'cva' : 'jsx'}
              {fileName ? ` · ${fileName}` : ''}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button onClick={() => store.openStage(config.openMode, 'stage')}>Stage</Button>
            <Button variant="primary" title="Sync to code (Ctrl+S)" disabled={!dirty} onClick={store.sync}>
              Sync
            </Button>
          </div>
        </header>
      )}

      <div className="flex-1 overflow-y-auto">
        {!meta ? (
          <EmptyState title="No component selected" hint="Open a .tsx or .jsx file to start tuning." />
        ) : (
          <>
            <Section title="Element">
              <ElementList
                elements={meta.elements ?? []}
                rootLabel={meta.cva.cvaIdentifier ?? meta.componentName}
                target={{ name: stage.targetElement, index: stage.targetIndex }}
                onSelect={store.selectElement}
              />
            </Section>

            <Section title="Content">
              <Row label="text">
                <input
                  type="text"
                  aria-label="Label"
                  value={String(stage.propValues.label ?? '')}
                  onChange={(e) => store.setProp('label', e.target.value)}
                  placeholder={meta.componentName || 'Label'}
                  className={`${fieldClass} w-full px-2 py-1 text-[11px]`}
                />
              </Row>
              {props.map((prop) => (
                <Row key={prop.name} label={prop.name}>
                  {prop.type === 'boolean' ? (
                    <Segmented
                      options={BOOLEAN_OPTIONS}
                      active={String(Boolean(stage.propValues[prop.name]))}
                      onPick={(id) => store.setProp(prop.name, id === 'true')}
                    />
                  ) : (
                    <input
                      type={prop.type === 'number' ? 'number' : 'text'}
                      aria-label={prop.name}
                      value={String(stage.propValues[prop.name] ?? '')}
                      placeholder={prop.type}
                      onChange={(e) =>
                        store.setProp(prop.name, prop.type === 'number' ? Number(e.target.value) : e.target.value)
                      }
                      className={`${fieldClass} w-full px-2 py-1 text-[11px] font-mono`}
                    />
                  )}
                </Row>
              ))}
              {!meta.props.some((p) => p.name === 'disabled') && (
                <Row label="disabled">
                  <Segmented
                    options={BOOLEAN_OPTIONS}
                    active={String(Boolean(stage.propValues.disabled))}
                    onPick={(id) => store.setProp('disabled', id === 'true')}
                  />
                </Row>
              )}
            </Section>

            {meta.cva.hasCva && (
              <Section title="Variants">
                <VariantPicker
                  cva={meta.cva}
                  selected={stage.selectedVariants}
                  onSelect={store.selectVariant}
                  onSetDefault={store.commitVariant}
                />
              </Section>
            )}

            <Section title="Layout">
              {ed.lenRow('pad X', 'px', PX, 0, 64)}
              {ed.lenRow('pad Y', 'py', PY, 0, 48)}
              {ed.lenRow('gap', 'gap', GAP, 0, 32)}
              {ed.lenRow('width', 'w', [], 0, 600, 4)}
              {ed.lenRow('height', 'h', HEIGHT, 0, 200)}
            </Section>

            <Section title="Typography">
              {ed.lenRow('size', 'text', TEXT_SIZE, 8, 64)}
              <Row label="weight">{ed.weight}</Row>
              {ed.lenRow('spacing', 'tracking', [], -4, 16, 0.5)}
              <Row label="color">{ed.col('text')}</Row>
            </Section>

            <Section title="Appearance">
              <Row label="fill">{ed.col('bg', BG_TOKENS)}</Row>
              <div className="pl-[72px]">{ed.swatches}</div>
              {ed.lenRow('border', 'border', [], 0, 12)}
              <Row label="stroke">{ed.col('border')}</Row>
              {ed.lenRow('radius', 'rounded', RADIUS, 0, 48)}
              <Row label="">{ed.radiusPresets}</Row>
              <Row label="shadow">{ed.shadowPresets}</Row>
              <Row label="opacity">{ed.opacity}</Row>
            </Section>

            <Section title="Classes" count={tokens.length}>
              <ClassChips
                classes={classes}
                onChange={store.setClasses}
                placeholder="Add classes · Enter  (e.g. hover:bg-accent-hover w-[220px])"
              />
              <div className="flex items-center justify-between">
                <Button variant="ghost" disabled={!dirty} onClick={store.discard}>
                  Discard changes
                </Button>
                <Button variant="ghost" onClick={copy}>
                  Copy
                </Button>
              </div>
            </Section>

            <Section title="Workspace" defaultOpen={false}>
              <Row label="open">
                <Segmented
                  options={[
                    { id: 'split', label: 'Split' },
                    { id: 'tab', label: 'Tab' },
                  ]}
                  active={config.openMode}
                  onPick={(id) => store.patchConfig({ openMode: id as StageOpenMode })}
                />
              </Row>
              <Row label="viewport">
                <ViewportSwitch
                  value={stage.viewport}
                  onChange={(viewport) => {
                    store.patchStage({ viewport });
                    store.patchConfig({ defaultViewport: viewport });
                  }}
                />
              </Row>
              <Row label="grid">
                <Segmented
                  options={TOGGLE_OPTIONS}
                  active={stage.showGrid ? 'on' : 'off'}
                  onPick={(id) => {
                    store.patchStage({ showGrid: id === 'on' });
                    store.patchConfig({ showGrid: id === 'on' });
                  }}
                />
              </Row>
              <Row label="auto-sync">
                <Segmented
                  options={TOGGLE_OPTIONS}
                  active={config.autoSyncActiveEditor ? 'on' : 'off'}
                  onPick={(id) => store.patchConfig({ autoSyncActiveEditor: id === 'on' })}
                />
              </Row>
              <Row label="port">
                <input
                  type="number"
                  aria-label="Port"
                  value={config.daemonPort}
                  onChange={(e) => store.patchConfig({ daemonPort: Number(e.target.value) || 49221 })}
                  className={`${fieldClass} w-full px-2 py-1 text-[11px] font-mono`}
                />
              </Row>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
