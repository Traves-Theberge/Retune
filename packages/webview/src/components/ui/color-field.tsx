import { RotateCcw } from 'lucide-react';
import { IconButton } from './button';
import { fieldClass, focusRing } from './scrub-input';

export function ColorField({
  value,
  onChange,
  onClear,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const hex = value && value.startsWith('#') && value.length === 7 ? value : '#000000';

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Pick colour"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className={`w-6 h-6 rounded border border-line bg-transparent p-0 cursor-pointer ${focusRing}`}
      />
      <input
        type="text"
        aria-label="Colour value"
        value={value ?? ''}
        placeholder="#hex / rgb()"
        onChange={(e) => (e.target.value ? onChange(e.target.value) : onClear())}
        className={`${fieldClass} ${focusRing} flex-1 min-w-0 px-2 py-0.5 text-[11px] font-mono`}
      />
      <IconButton icon={RotateCcw} label="Reset" onClick={onClear} disabled={!value} />
    </div>
  );
}
