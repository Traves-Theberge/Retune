import React from 'react';
import { CvaMetadata } from '@retune/core';

export interface ToneSelectorProps {
  cva?: CvaMetadata;
  selectedVariants: Record<string, string>;
  onSelectVariant: (group: string, value: string) => void;
  onCommitVariant?: (group: string, value: string) => void;
}

export function ToneSelector({
  cva,
  selectedVariants,
  onSelectVariant,
  onCommitVariant,
}: ToneSelectorProps) {
  if (!cva?.hasCva) {
    return null;
  }

  return (
    <div className="px-3 py-1.5 border-b border-zinc-800/80 flex flex-wrap gap-3 items-center justify-between bg-[#0c0c10] text-[11px] select-none">
      <div className="flex flex-wrap gap-3 items-center">
        {Object.entries(cva.variants).map(([group, options]) => (
          <div key={group} className="flex items-center gap-1.5">
            <span className="font-mono text-zinc-500 text-[10px]">{group}</span>
            <div className="flex items-center bg-[#141419] border border-zinc-800/90 rounded p-0.5 gap-0.5">
              {options.map((opt) => {
                const isSelected =
                  (selectedVariants[group] || cva.defaultVariants[group] || options[0]) === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onSelectVariant(group, opt)}
                    onDoubleClick={() => onCommitVariant?.(group, opt)}
                    title="Click to preview • Double-click to pin defaultVariant in AST"
                    className={`px-2 py-0.5 rounded-[3px] text-[10px] font-mono transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {cva.cvaIdentifier && (
        <span className="text-[10px] font-mono text-zinc-500">{cva.cvaIdentifier}</span>
      )}
    </div>
  );
}
