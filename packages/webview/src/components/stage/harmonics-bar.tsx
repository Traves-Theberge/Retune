import React from 'react';

export interface HarmonicsBarProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}

const QUICK_TOKENS = [
  'shadow-lg',
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
    <div className="px-3 py-2 border-t border-zinc-800/80 bg-[#0c0c10] flex flex-col gap-1.5 select-none">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">
          className
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' && onCommit((e.target as HTMLInputElement).value)
          }
          placeholder="Tailwind utility classes..."
          className="flex-1 bg-[#141419] border border-zinc-800 focus:border-indigo-500 rounded px-2.5 py-1 text-[11px] font-mono text-zinc-100 outline-none transition"
        />
        <button
          type="button"
          onClick={() => onCommit(value)}
          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition shrink-0"
        >
          Sync AST
        </button>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {QUICK_TOKENS.map((token) => {
          const active = value.includes(token);
          return (
            <button
              key={token}
              type="button"
              onClick={() => toggleToken(token)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
                active
                  ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                  : 'bg-[#141419] border-zinc-800/90 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {token}
            </button>
          );
        })}
      </div>
    </div>
  );
}
