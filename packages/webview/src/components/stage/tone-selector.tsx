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
  return (
    <div className="px-4 py-2.5 border-b border-zinc-800/80 flex flex-wrap gap-4 items-center justify-between bg-zinc-900/30">
      <div className="flex flex-wrap gap-4 items-center">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
          Tone Matrix
        </span>
        {cva?.hasCva ? (
          Object.entries(cva.variants).map(([group, options]) => (
            <div key={group} className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-zinc-400 uppercase tracking-wider text-[11px]">
                {group}:
              </span>
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
                {options.map((opt) => {
                  const isSelected = selectedVariants[group] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onSelectVariant(group, opt)}
                      onDoubleClick={() => onCommitVariant?.(group, opt)}
                      title="Click to preview variant, double-click to write as defaultVariant in AST"
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-zinc-500 italic">
            No CVA configuration found in active component
          </div>
        )}
      </div>
      {cva?.cvaIdentifier && (
        <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
          cva: {cva.cvaIdentifier}
        </span>
      )}
    </div>
  );
}
