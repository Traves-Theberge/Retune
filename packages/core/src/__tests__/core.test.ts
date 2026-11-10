import { describe, it, expect } from 'vitest';
import { extractCvaMetadata } from '../ast/cva-extractor';
import { extractElementClassName, mutateClassName } from '../ast/jsx-mutator';
import { analyzeProps } from '../ast/prop-analyzer';

const sampleButtonSource = `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

// Important comment that must be preserved
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow",
        destructive: "bg-destructive text-destructive-foreground shadow-sm",
        outline: "border border-input bg-background shadow-sm",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps {
  label: string;
  disabled?: boolean;
}

export function Button({ label }: ButtonProps) {
  return (
    <button className="px-4 py-2 bg-indigo-600 text-white">
      {label}
    </button>
  )
}
`;

describe('@retune/core AST Engine', () => {
  it('extracts CVA metadata including base classes, variants, and defaultVariants', () => {
    const meta = extractCvaMetadata(sampleButtonSource);
    expect(meta.hasCva).toBe(true);
    expect(meta.cvaIdentifier).toBe('buttonVariants');
    expect(meta.baseClasses).toBe(
      'inline-flex items-center justify-center rounded-md text-sm font-medium'
    );
    expect(meta.variants).toEqual({
      variant: ['default', 'destructive', 'outline'],
      size: ['default', 'sm', 'lg'],
    });
    expect(meta.defaultVariants).toEqual({
      variant: 'default',
      size: 'default',
    });
  });

  it('mutates JSX className without losing comments or formatting', () => {
    const updated = mutateClassName(
      sampleButtonSource,
      'Button',
      'px-4 py-2 bg-indigo-600 text-white shadow-2xl'
    );
    expect(updated).toContain('// Important comment that must be preserved');
    expect(updated).toContain('className="px-4 py-2 bg-indigo-600 text-white shadow-2xl"');
  });

  it('analyzes component TypeScript props interface', () => {
    const props = analyzeProps(sampleButtonSource);
    expect(props).toEqual([
      { name: 'label', type: 'string', optional: false },
      { name: 'disabled', type: 'boolean', optional: true },
    ]);
  });

  it('extracts element className for any JSX component or tag', () => {
    const cls = extractElementClassName(sampleButtonSource, 'button');
    expect(cls).toBe('px-4 py-2 bg-indigo-600 text-white');
  });
});

