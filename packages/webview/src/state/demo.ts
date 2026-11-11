import type { ComponentMetadata, RetuneExtensionConfig, StageState } from '@retune/core';

export const DEFAULT_CONFIG: RetuneExtensionConfig = {
  daemonPort: 49221,
  sandboxPort: 5173,
  openMode: 'split',
  defaultViewport: 'responsive',
  showGrid: true,
  autoSyncActiveEditor: true,
  scalarLayout: 'modern',
};

export const DEFAULT_STAGE_STATE: StageState = {
  selectedVariants: {
    variant: 'default',
    size: 'default',
  },
  propValues: {
    label: 'Launch Retune Stage',
    disabled: false,
  },
  harmonicsClass:
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
  baselineClass:
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
  viewport: 'responsive',
  showGrid: true,
  activeTab: 'stage',
};

export const DEMO_SOURCE = `import * as React from 'react';
import { cva } from 'class-variance-authority';

// Non-lossy AST comments are preserved on mutation!
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-indigo-600 text-white shadow hover:bg-indigo-500',
        destructive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-500',
        outline: 'border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800',
        secondary: 'bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700',
        ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-white',
      },
      size: {
        default: 'h-9 px-4 py-2 text-sm',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps {
  label: string;
  disabled?: boolean;
}

export function Button({ label = 'Launch Retune Stage', disabled = false }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors"
    >
      {label}
    </button>
  );
}
`;

export const DEMO_META: ComponentMetadata = {
  componentName: 'Button',
  filePath: 'examples/Button.tsx',
  cva: {
    hasCva: true,
    cvaIdentifier: 'buttonVariants',
    baseClasses:
      'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
    variants: {
      variant: ['default', 'destructive', 'outline', 'secondary', 'ghost'],
      size: ['default', 'sm', 'lg'],
    },
    variantClasses: {
      variant: {
        default: 'bg-indigo-600 text-white shadow hover:bg-indigo-500',
        destructive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-500',
        outline: 'border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800',
        secondary: 'bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700',
        ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-white',
      },
      size: {
        default: 'h-9 px-4 py-2 text-sm',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
  props: [
    { name: 'label', type: 'string', optional: false },
    { name: 'disabled', type: 'boolean', optional: true },
  ],
  rawSource: DEMO_SOURCE,
  elements: [
    {
      name: 'button',
      start: 0,
      end: 0,
      line: 36,
      column: 4,
      className:
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
    },
  ],
};

export const EMPTY_STAGE_STATE: StageState = {
  selectedVariants: {},
  propValues: {},
  harmonicsClass: '',
  baselineClass: '',
  viewport: 'responsive',
  showGrid: true,
  activeTab: 'stage',
};
