import type { ViewportPreset } from '@retune/core';

export const VIEWPORTS: { id: ViewportPreset; label: string; widthClass: string }[] = [
  { id: 'responsive', label: 'Fluid', widthClass: 'w-full max-w-3xl' },
  { id: 'mobile', label: '375', widthClass: 'w-[375px]' },
  { id: 'tablet', label: '768', widthClass: 'w-[768px]' },
  { id: 'desktop', label: '1024', widthClass: 'w-[1024px]' },
];
