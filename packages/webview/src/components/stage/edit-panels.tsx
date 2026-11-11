import type { StageStore } from '../../state/use-stage';
import { BG_TOKENS, GAP, HEIGHT, PX, PY, RADIUS, TEXT_SIZE, createClassEditor } from '../controls';
import { Row, Segmented, fieldClass } from '../ui';
import { ClassChips } from '../shared/class-chips';
import { VariantPicker } from '../shared/variant-picker';

export type PanelKind = 'text' | 'fill' | 'type' | 'spacing' | 'shape' | 'variants' | 'classes';

export const PANELS: { kind: PanelKind; label: string; title: string }[] = [
  { kind: 'text', label: 'Text', title: 'Text' },
  { kind: 'fill', label: 'Fill', title: 'Fill & Border' },
  { kind: 'type', label: 'Type', title: 'Typography' },
  { kind: 'spacing', label: 'Space', title: 'Spacing & Size' },
  { kind: 'shape', label: 'Shape', title: 'Shape & Effects' },
  { kind: 'variants', label: 'Variants', title: 'Variants' },
  { kind: 'classes', label: 'Classes', title: 'Classes' },
];

export function availablePanels(hasVariants: boolean): typeof PANELS {
  return hasVariants ? PANELS : PANELS.filter((p) => p.kind !== 'variants');
}

export function EditPanel({ kind, store, onDone }: { kind: PanelKind; store: StageStore; onDone: () => void }) {
  const ed = createClassEditor(store.stage.harmonicsClass, store.setClasses);
  const cva = store.meta?.cva;
  const hasVariants = Boolean(cva?.hasCva && cva && Object.keys(cva.variants).length > 0);

  switch (kind) {
    case 'text': {
      const disabled = Boolean(store.stage.propValues.disabled);
      return (
        <div className="space-y-2.5 text-xs">
          <Row label="label">
            <input
              aria-label="Label"
              autoFocus
              value={String(store.stage.propValues.label ?? '')}
              onChange={(e) => store.setProp('label', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onDone();
              }}
              className={`${fieldClass} w-full px-2 py-1 text-[11px]`}
            />
          </Row>
          <Row label="disabled">
            <Segmented
              label="Disabled"
              options={[
                { id: 'on', label: 'on' },
                { id: 'off', label: 'off' },
              ]}
              active={disabled ? 'on' : 'off'}
              onPick={(id) => store.setProp('disabled', id === 'on')}
            />
          </Row>
        </div>
      );
    }
    case 'fill':
      return (
        <div className="space-y-2.5 text-xs">
          <Row label="fill">{ed.col('bg', BG_TOKENS)}</Row>
          <div className="pl-[72px]">{ed.swatches}</div>
          {ed.lenRow('border', 'border', [], 0, 12)}
          <Row label="stroke">{ed.col('border')}</Row>
          <Row label="opacity">{ed.opacity}</Row>
        </div>
      );
    case 'type':
      return (
        <div className="space-y-2.5 text-xs">
          {ed.lenRow('size', 'text', TEXT_SIZE, 8, 64)}
          <Row label="weight">{ed.weight}</Row>
          {ed.lenRow('spacing', 'tracking', [], -4, 16, 0.5)}
          <Row label="color">{ed.col('text')}</Row>
        </div>
      );
    case 'spacing':
      return (
        <div className="space-y-2.5 text-xs">
          {ed.lenRow('pad X', 'px', PX, 0, 64)}
          {ed.lenRow('pad Y', 'py', PY, 0, 48)}
          {ed.lenRow('gap', 'gap', GAP, 0, 32)}
          {ed.lenRow('width', 'w', [], 0, 600, 4)}
          {ed.lenRow('height', 'h', HEIGHT, 0, 200)}
        </div>
      );
    case 'shape':
      return (
        <div className="space-y-2.5 text-xs">
          {ed.lenRow('radius', 'rounded', RADIUS, 0, 48)}
          <Row label="">{ed.radiusPresets}</Row>
          <Row label="shadow">{ed.shadowPresets}</Row>
        </div>
      );
    case 'variants':
      return hasVariants && cva ? (
        <VariantPicker
          cva={cva}
          selected={store.stage.selectedVariants}
          onSelect={store.selectVariant}
          onSetDefault={store.commitVariant}
        />
      ) : (
        <p className="text-xs text-muted">No cva() variants in this component.</p>
      );
    case 'classes':
      return <ClassChips classes={store.stage.harmonicsClass} onChange={store.setClasses} autoFocus />;
  }
}
