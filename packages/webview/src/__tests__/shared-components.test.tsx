import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CvaMetadata, ElementInfo } from '@retune/core';
import { EmptyState, Popover, Toast } from '../components/ui';
import { VIEWPORTS } from '../components/shared/viewports';
import { ViewportSwitch } from '../components/shared/viewport-switch';
import { VariantPicker } from '../components/shared/variant-picker';
import { ClassChips } from '../components/shared/class-chips';
import { ElementList } from '../components/shared/element-list';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const cva: CvaMetadata = { hasCva: true, variants: { size: ['sm', 'lg'] }, variantClasses: {}, defaultVariants: { size: 'sm' }, baseClasses: 'a' };
const el = (name: string, line: number, className: string): ElementInfo => ({ name, line, className, start: 0, end: 1, column: 0 });

describe('shared components', () => {
  it('announces toasts and keeps the region when empty', () => {
    expect(html(<Toast toast={null} />)).toContain('role="status"');
    expect(html(<Toast toast={{ message: 'Synced to code', tone: 'success' }} />)).toContain('Synced to code');
  });
  it('renders a labelled dialog only with an anchor', () => {
    expect(html(<Popover anchor={null} container={{ width: 800, height: 600 }} title="Fill" onClose={() => {}}>x</Popover>)).toBe('');
    const out = html(<Popover anchor={{ left: 400, top: 100, width: 100, height: 40 }} container={{ width: 800, height: 600 }} title="Fill" subtitle="<button>" onClose={() => {}}>x</Popover>);
    expect(out).toContain('role="dialog"'); expect(out).toContain('aria-label="Fill"'); expect(out).toContain('aria-label="Close"');
    expect(out).toContain('left:310px'); expect(out).toContain('top:148px');
  });
  it('lists the four viewports', () => {
    expect(VIEWPORTS.map((v) => v.label)).toEqual(['Fluid', '375', '768', '1024']);
    expect(html(<ViewportSwitch value="tablet" onChange={() => {}} />)).toMatch(/aria-checked="true"[^>]*>768</);
  });
  it('marks the current variant and falls back to the default', () => {
    const out = html(<VariantPicker cva={cva} selected={{}} onSelect={() => {}} onSetDefault={() => {}} />);
    expect(out).toMatch(/aria-pressed="true"[^>]*>sm</); expect(out).toMatch(/aria-pressed="false"[^>]*>lg</);
    expect(out).toContain('set default');
  });
  it('renders removable class chips', () => {
    const out = html(<ClassChips classes="p-2 gap-1" onChange={() => {}} />);
    expect(out).toContain('aria-label="Remove p-2"'); expect(out).toContain('aria-label="Remove gap-1"');
    expect(out).toContain('placeholder="Add classes · Enter"');
  });
  it('lists the root and elements and marks the selected one', () => {
    const els = [el('div', 3, 'a b'), el('span', 4, 'c'), el('span', 5, '')];
    const out = html(<ElementList elements={els} rootLabel="buttonVariants" target={{ name: 'span', index: 1 }} onSelect={() => {}} />);
    expect(out).toContain('role="listbox"'); expect(out).toContain('buttonVariants');
    expect(out).toContain('&lt;div&gt;'); expect(out).toContain('L5');
    expect(out.match(/aria-selected="true"/g)?.length).toBe(1);
    expect(out).toMatch(/aria-selected="true"[^>]*>(?:(?!<\/[a-z]+>\s*<[a-z]+ role="option").)*L5/s);
    expect(html(<ElementList elements={els} rootLabel="root" target={{}} onSelect={() => {}} />)).toMatch(/aria-selected="true"[^>]*>[^<]*(<[^>]+>)*root/);
  });
  it('renders the empty state copy', () => {
    const out = html(<EmptyState title="No component selected" hint="Open a .tsx or .jsx file to start tuning." />);
    expect(out).toContain('No component selected'); expect(out).toContain('Open a .tsx or .jsx file to start tuning.');
  });
});
