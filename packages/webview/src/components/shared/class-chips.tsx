import { useState } from 'react';
import { X } from 'lucide-react';
import { addClasses, removeClass, splitClasses } from '../../lib/arbitrary-style';
import { focusRing, fieldClass } from '../ui/scrub-input';

export function ClassChips({
  classes,
  onChange,
  placeholder = 'Add classes · Enter',
  autoFocus,
}: {
  classes: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-1">
      {splitClasses(classes).map((token) => (
        <span key={token} className="inline-flex items-center gap-0.5 rounded bg-hover px-1 py-0.5 font-mono text-[11px] text-fg">
          <span>{token}</span>
          <button
            type="button"
            aria-label={`Remove ${token}`}
            title={`Remove ${token}`}
            onClick={() => onChange(removeClass(classes, token))}
            className={`rounded text-subtle hover:text-fg ${focusRing}`}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !draft.trim()) return;
          e.preventDefault();
          onChange(addClasses(classes, draft));
          setDraft('');
        }}
        className={`min-w-[8rem] flex-1 px-1 py-0.5 font-mono text-[11px] ${fieldClass}`}
      />
    </div>
  );
}
