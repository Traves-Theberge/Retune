import { describe, it, expect } from 'vitest';
import { extractCvaMetadata } from '@retune/core';

describe('@retune/webview stage state integration', () => {
  it('computes variant class maps from CVA metadata for the stage & sidebar', () => {
    const meta = extractCvaMetadata(`
      const chip = cva("inline-flex items-center", {
        variants: {
          tone: {
            indigo: "bg-indigo-600 text-white",
            zinc: "bg-zinc-800 text-zinc-200"
          }
        },
        defaultVariants: {
          tone: "indigo"
        }
      });
    `);

    expect(meta.hasCva).toBe(true);
    expect(meta.variantClasses?.tone?.indigo).toBe('bg-indigo-600 text-white');
    expect(meta.variantClasses?.tone?.zinc).toBe('bg-zinc-800 text-zinc-200');
  });
});

