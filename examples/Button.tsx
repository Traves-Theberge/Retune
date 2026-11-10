import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

// Retune Sample Component — open this file and press Ctrl+Shift+R (or click Open Visual Stage in the Editor Tab bar)
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
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
      className="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors bg-indigo-600 text-white shadow hover:bg-indigo-500 h-9 px-4 py-2 text-sm"
    >
      {label}
    </button>
  );
}

