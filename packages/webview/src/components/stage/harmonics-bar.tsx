import React from 'react';

export interface HarmonicsBarProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}

const QUICK_TOKENS = [
  'shadow-xl',
  'rounded-full',
  'ring-2 ring-indigo-500',
  'scale-105',
  'px-6 py-2.5',
  'font-semibold',
];

export function HarmonicsBar({ value, onChange, onCommit }: HarmonicsBarProps) {
  const toggleToken = (token: string) => {
    const hasToken = value.includes(token);
    const updated = hasToken
      ? value
          .replace(token, '')
          .replace(/\s+/g, ' ')
          .trim()
      : `${value.trim()} ${token}`.trim();
    onChange(updated);
    onCommit(updated);
  };

  return (
    <div className="p-3 border-t border-zinc-800 bg-zinc-900/60 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-semibold text-indigo-400">Harmonics:</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' && onCommit((e.target as HTMLInputElement).value)
          }
          placeholder="Enter Tailwind classes..."
          className="flex-1 bg-zinc-800/90 border border-zinc-700 rounded-md px-3 py-1.5 text-xs font-mono text-zinc-100 outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={() => onCommit(value)}
          className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
        >
          Sync AST
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-1">
          Quick Tokens:
        </span>
        {QUICK_TOKENS.map((token) => {
          const active = value.includes(token);
          return (
            <button
              key={token}
              type="button"
              onClick={() => toggleToken(token)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                active
                  ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {active ? `✓ ${token}` : `+ ${token}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
