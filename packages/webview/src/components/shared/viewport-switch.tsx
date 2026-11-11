import type { ViewportPreset } from '@retune/core';
import { Segmented } from '../ui';
import { VIEWPORTS } from './viewports';

export function ViewportSwitch({ value, onChange }: { value: ViewportPreset; onChange: (v: ViewportPreset) => void }) {
  return (
    <Segmented
      label="Viewport"
      active={value}
      onPick={(id) => onChange(id as ViewportPreset)}
      options={VIEWPORTS.map(({ id, label }) => ({ id, label }))}
    />
  );
}
