const INTRINSIC_TARGETS = new Set([
  'button', 'a', 'div', 'span', 'p', 'label', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'section', 'article', 'nav', 'header', 'footer',
]);

export function previewTag(target?: string, componentName?: string): string {
  if (target && INTRINSIC_TARGETS.has(target)) return target;
  if (componentName && /button|btn/i.test(componentName)) return 'button';
  return 'div';
}
