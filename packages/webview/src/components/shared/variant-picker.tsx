import { useState } from 'react';
import type { CvaMetadata } from '@retune/core';
import { fieldClass, focusRing } from '../ui/scrub-input';

export function VariantPicker({
  cva,
  selected,
  onSelect,
  onSetDefault,
  editingTarget,
  onEditVariant,
  onSaveNewVariant,
}: {
  cva: CvaMetadata;
  selected: Record<string, string>;
  onSelect: (group: string, value: string) => void;
  onSetDefault: (group: string, value: string) => void;
  editingTarget?: { group: string; key: string } | null;
  onEditVariant?: (target: { group: string; key: string } | null) => void;
  onSaveNewVariant?: (group: string, newKey: string) => void;
}) {
  const [addingGroup, setAddingGroup] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');

  return (
    <div className="space-y-2">
      {Object.entries(cva.variants).map(([group, options]) => {
        const current = selected[group] ?? cva.defaultVariants[group] ?? options[0];
        const isEditingThisGroup = editingTarget?.group === group && editingTarget?.key === current;
        return (
          <div key={group} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted">{group}</span>
              <div className="flex items-center gap-1.5">
                {onEditVariant && (
                  <button
                    type="button"
                    title={isEditingThisGroup ? 'Return to base classes' : `Edit ${group}.${current} classes`}
                    onClick={() => onEditVariant(isEditingThisGroup ? null : { group, key: current })}
                    className={`rounded px-1 text-[11px] transition ${focusRing} ${
                      isEditingThisGroup ? 'bg-accent text-accent-fg' : 'text-subtle hover:text-fg'
                    }`}
                  >
                    {isEditingThisGroup ? 'editing' : 'edit'}
                  </button>
                )}
                <button
                  type="button"
                  title="Write as defaultVariant in the file"
                  onClick={() => onSetDefault(group, current)}
                  className={`rounded px-1 text-[11px] text-subtle transition hover:text-fg ${focusRing}`}
                >
                  set default
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {options.map((option) => {
                const active = option === current;
                return (
                  <button
                    key={option}
                    aria-pressed={active}
                    type="button"
                    onClick={() => onSelect(group, option)}
                    className={`rounded px-2 py-0.5 font-mono text-[11px] transition ${focusRing} ${
                      active ? 'bg-active text-active-fg' : 'bg-raised border border-line text-muted hover:text-fg hover:bg-hover'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
              {onSaveNewVariant && (
                <button
                  type="button"
                  title={`Save current styles as a new ${group} option`}
                  onClick={() => {
                    setAddingGroup(addingGroup === group ? null : group);
                    setNewKey('');
                  }}
                  className={`rounded border border-dashed border-line px-1.5 py-0.5 font-mono text-[11px] text-subtle transition hover:text-fg ${focusRing}`}
                >
                  +
                </button>
              )}
            </div>
            {addingGroup === group && onSaveNewVariant && (
              <input
                autoFocus
                type="text"
                value={newKey}
                placeholder={`New ${group} name · Enter`}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setAddingGroup(null);
                  if (e.key === 'Enter' && newKey.trim()) {
                    onSaveNewVariant(group, newKey.trim());
                    setAddingGroup(null);
                    setNewKey('');
                  }
                }}
                className={`${fieldClass} w-full px-2 py-1 font-mono text-[11px]`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
