import type { ComponentMetadata, PreviewNode } from '@retune/core';

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

export function previewNodeText(node: PreviewNode): string {
  if (node.text !== undefined) return node.text;
  const directText = node.children
    .filter((c) => c.tag === '#text')
    .map((c) => c.text ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (directText) return directText;
  const attrVal = node.attrs?.value ?? node.attrs?.defaultValue ?? node.attrs?.placeholder;
  return attrVal !== undefined && attrVal !== false ? String(attrVal) : '';
}

export function findPreviewNode(
  root: PreviewNode | null | undefined,
  name?: string,
  index = 0
): PreviewNode | null {
  if (!root) return null;
  if (!name) return root;
  const stack: PreviewNode[] = [root];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    const eff = cur.sourceTag ?? cur.tag;
    if (eff === name && cur.elementIndex === index) return cur;
    for (let i = 0; i < cur.children.length; i++) {
      stack.push(cur.children[i]);
    }
  }
  return null;
}

export function resolveSelectedElementText(
  meta: ComponentMetadata | null,
  name?: string,
  index = 0
): string {
  if (!meta) return '';
  const elements = meta.elements ?? [];
  const el = name ? elements.filter((item) => item.name === name)[index] : elements[0];
  if (el?.text !== undefined) return el.text;
  const pNode = findPreviewNode(meta.previewTree, name, index);
  return pNode ? previewNodeText(pNode) : '';
}
