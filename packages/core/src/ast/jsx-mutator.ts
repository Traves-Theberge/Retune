import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';

/**
 * Non-lossy source edits.
 *
 * Instead of reprinting the whole file, every mutation is computed as a minimal text splice
 * (`TextEdit`) against the original source. Comments, formatting and unrelated code are never
 * touched, and the VS Code host can apply the splice as a single small `WorkspaceEdit`
 * (clean undo, cursor stays put, tiny git diffs).
 */

export interface TextEdit {
  start: number;
  end: number;
  text: string;
}

export interface ElementTarget {
  /** Element/component name, matched case-insensitively. Falls back to the first element. */
  name?: string;
  /** Character offset in the source; picks the innermost opening tag that contains it. */
  offset?: number;
}

export interface ElementInfo {
  name: string;
  start: number;
  end: number;
  line: number;
  column: number;
  className: string;
}

const CLASS_HELPERS = new Set(['cn', 'clsx', 'classnames', 'classNames', 'twMerge', 'cx']);

function parseSource(source: string) {
  return babelParse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });
}

function walk(node: any, visit: (n: any) => void): void {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key.endsWith('Comments')) continue;
    const value = node[key];
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value.type === 'string') walk(value, visit);
  }
}

function elementName(el: t.JSXOpeningElement): string {
  const n = el.name;
  if (t.isJSXIdentifier(n)) return n.name;
  if (t.isJSXMemberExpression(n)) {
    const parts: string[] = [];
    let cur: t.JSXMemberExpression | t.JSXIdentifier = n;
    while (t.isJSXMemberExpression(cur)) {
      parts.unshift(cur.property.name);
      cur = cur.object as t.JSXMemberExpression | t.JSXIdentifier;
    }
    if (t.isJSXIdentifier(cur)) parts.unshift(cur.name);
    return parts.join('.');
  }
  return '';
}

function openingElements(source: string): t.JSXOpeningElement[] {
  const found: t.JSXOpeningElement[] = [];
  walk(parseSource(source).program, (n) => {
    if (t.isJSXOpeningElement(n)) found.push(n);
  });
  return found;
}

function findElement(
  elements: t.JSXOpeningElement[],
  target: ElementTarget = {}
): t.JSXOpeningElement | undefined {
  if (target.offset !== undefined) {
    const offset = target.offset;
    const exact = elements.find((el) => el.start === offset);
    if (exact) return exact;
    const containing = elements
      .filter((el) => el.start! <= offset && offset < el.end!)
      .sort((a, b) => a.end! - a.start! - (b.end! - b.start!));
    if (containing[0]) return containing[0];
  }
  if (target.name) {
    const wanted = target.name.toLowerCase();
    const exact = elements.find((el) => elementName(el) === target.name);
    if (exact) return exact;
    const loose = elements.find((el) => elementName(el).toLowerCase() === wanted);
    if (loose) return loose;
  }
  return elements[0];
}

function classNameAttr(el: t.JSXOpeningElement): t.JSXAttribute | undefined {
  return el.attributes.find(
    (a): a is t.JSXAttribute => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'className'
  );
}

function isPlainTemplate(n: t.Node): n is t.TemplateLiteral {
  return t.isTemplateLiteral(n) && n.expressions.length === 0;
}

/** Recognise `["…", expr].filter(Boolean).join(" ")` (the wrapper this tool writes) and return its string. */
function generatedWrapperString(expr: t.Node): t.StringLiteral | undefined {
  if (!t.isCallExpression(expr)) return undefined;
  const join = expr.callee;
  if (!t.isMemberExpression(join) || join.computed || !t.isIdentifier(join.property, { name: 'join' })) return undefined;
  const filter = join.object;
  if (!t.isCallExpression(filter)) return undefined;
  const fcallee = filter.callee;
  if (!t.isMemberExpression(fcallee) || fcallee.computed || !t.isIdentifier(fcallee.property, { name: 'filter' })) return undefined;
  if (filter.arguments.length !== 1 || !t.isIdentifier(filter.arguments[0], { name: 'Boolean' })) return undefined;
  const arr = fcallee.object;
  if (!t.isArrayExpression(arr)) return undefined;
  const first = arr.elements[0];
  return t.isStringLiteral(first) ? first : undefined;
}

/** The classes an element statically carries: exactly what a write replaces. */
function staticClasses(el: t.JSXOpeningElement): string {
  const value = classNameAttr(el)?.value;
  const node = staticClassNode(value);
  if (node) return readClass(node);
  if (value && t.isJSXExpressionContainer(value) && t.isTemplateLiteral(value.expression)) {
    return (value.expression.quasis[0]?.value.cooked ?? '').trim();
  }
  return '';
}

/** Text for a bare JSX attribute value; JSX attribute strings have no backslash escapes. */
function attrValueText(text: string, preferred: '"' | "'" = '"'): string {
  const other = preferred === '"' ? "'" : '"';
  if (!text.includes(preferred)) return `${preferred}${text}${preferred}`;
  if (!text.includes(other)) return `${other}${text}${other}`;
  return `{${JSON.stringify(text)}}`;
}

/** Find the string node that carries the "static" class list inside a className value. */
function staticClassNode(value: t.Node | null | undefined): t.StringLiteral | t.TemplateLiteral | undefined {
  if (!value) return undefined;
  if (t.isStringLiteral(value)) return value;
  if (!t.isJSXExpressionContainer(value)) return undefined;
  const expr = value.expression;
  if (t.isStringLiteral(expr) || isPlainTemplate(expr)) return expr;
  if (t.isTemplateLiteral(expr)) return undefined;
  const wrapped = generatedWrapperString(expr);
  if (wrapped) return wrapped;
  if (t.isCallExpression(expr) && t.isIdentifier(expr.callee) && CLASS_HELPERS.has(expr.callee.name)) {
    return expr.arguments.find(
      (a): a is t.StringLiteral | t.TemplateLiteral => t.isStringLiteral(a) || (t.isTemplateLiteral(a) && isPlainTemplate(a))
    );
  }
  return undefined;
}

function readClass(node: t.StringLiteral | t.TemplateLiteral): string {
  return t.isStringLiteral(node) ? node.value : node.quasis[0]?.value.cooked ?? '';
}

function quoteFor(source: string, node: t.Node): '"' | "'" | '`' {
  const ch = source[node.start!];
  return ch === "'" || ch === '`' ? ch : '"';
}

function escapeFor(text: string, quote: '"' | "'" | '`'): string {
  let out = text.replace(/\\/g, '\\\\');
  if (quote === '`') return out.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return out.replace(new RegExp(quote, 'g'), `\\${quote}`);
}

export function applyEdits(source: string, edits: TextEdit | TextEdit[] | null): string {
  if (!edits) return source;
  const list = (Array.isArray(edits) ? edits : [edits]).slice().sort((a, b) => b.start - a.start);
  return list.reduce((acc, e) => acc.slice(0, e.start) + e.text + acc.slice(e.end), source);
}

/** Extract the static class list from the target element. */
export function extractElementClassName(source: string, targetComponent?: string, offset?: number): string {
  try {
    const el = findElement(openingElements(source), { name: targetComponent, offset });
    if (!el) return '';
    return staticClasses(el);
  } catch {
    return '';
  }
}

/** List every JSX element that can be tuned, with its position and current classes. */
export function listElements(source: string): ElementInfo[] {
  try {
    return openingElements(source).map((el) => {
      return {
        name: elementName(el),
        start: el.start!,
        end: el.end!,
        line: el.loc?.start.line ?? 0,
        column: el.loc?.start.column ?? 0,
        className: staticClasses(el),
      };
    });
  } catch {
    return [];
  }
}

/** Compute the minimal edit that sets `newClassName` on the target element. */
export function computeClassNameEdit(
  source: string,
  target: ElementTarget,
  newClassName: string
): TextEdit | null {
  const el = findElement(openingElements(source), target);
  if (!el) return null;

  const attr = classNameAttr(el);
  if (!attr) {
    const typeArgs = (el as any).typeArguments ?? (el as any).typeParameters;
    const at = (typeArgs?.end ?? el.name.end) as number;
    return { start: at, end: at, text: ` className=${attrValueText(newClassName)}` };
  }

  const stat = staticClassNode(attr.value);
  if (stat) {
    if (stat === attr.value) {
      const preferred = source[stat.start!] === "'" ? "'" : '"';
      return { start: stat.start!, end: stat.end!, text: attrValueText(newClassName, preferred) };
    }
    const quote = quoteFor(source, stat);
    return { start: stat.start!, end: stat.end!, text: `${quote}${escapeFor(newClassName, quote)}${quote}` };
  }

  const value = attr.value;
  if (!value) {
    return { start: attr.start!, end: attr.end!, text: `className=${attrValueText(newClassName)}` };
  }

  if (t.isJSXExpressionContainer(value)) {
    const expr = value.expression;
    // cn(...) with no static string: prepend one, keep every dynamic argument
    if (t.isCallExpression(expr) && t.isIdentifier(expr.callee) && CLASS_HELPERS.has(expr.callee.name)) {
      const text = `"${escapeFor(newClassName, '"')}"`;
      return expr.arguments.length
        ? { start: expr.arguments[0].start!, end: expr.arguments[0].start!, text: `${text}, ` }
        : { start: expr.end! - 1, end: expr.end! - 1, text };
    }
    // Template literal with interpolations: replace only the leading static text
    if (t.isTemplateLiteral(expr) && expr.quasis[0]) {
      const q = expr.quasis[0];
      return { start: q.start!, end: q.end!, text: `${escapeFor(newClassName, '`')} ` };
    }
    // Any other dynamic expression: keep it and prepend the static classes
    if (!t.isJSXEmptyExpression(expr)) {
      const dynamic = source.slice(expr.start!, expr.end!);
      return {
        start: value.start!,
        end: value.end!,
        text: `{["${escapeFor(newClassName, '"')}", ${dynamic}].filter(Boolean).join(" ")}`,
      };
    }
  }

  return { start: value.start!, end: value.end!, text: attrValueText(newClassName) };
}

export function mutateClassName(
  source: string,
  targetComponent: string,
  newClassName: string,
  offset?: number
): string {
  return applyEdits(source, computeClassNameEdit(source, { name: targetComponent, offset }, newClassName));
}

/** Compute the minimal edit that pins `group: value` inside `defaultVariants`. */
export function computeDefaultVariantEdit(
  source: string,
  variantGroup: string,
  variantValue: string
): TextEdit | null {
  let edit: TextEdit | null = null;
  walk(parseSource(source).program, (n) => {
    if (edit || !t.isObjectProperty(n)) return;
    const keyName = t.isIdentifier(n.key) ? n.key.name : t.isStringLiteral(n.key) ? n.key.value : '';
    if (keyName !== 'defaultVariants' || !t.isObjectExpression(n.value)) return;
    const obj = n.value;
    const existing = obj.properties.find(
      (p): p is t.ObjectProperty =>
        t.isObjectProperty(p) &&
        (t.isIdentifier(p.key) ? p.key.name : t.isStringLiteral(p.key) ? p.key.value : '') === variantGroup
    );
    if (existing) {
      const quote = t.isStringLiteral(existing.value) ? quoteFor(source, existing.value) : '"';
      edit = {
        start: existing.value.start!,
        end: existing.value.end!,
        text: `${quote}${escapeFor(variantValue, quote === '`' ? '"' : quote)}${quote}`,
      };
    } else if (obj.properties.length) {
      const last = obj.properties[obj.properties.length - 1];
      edit = { start: last.end!, end: last.end!, text: `, ${variantGroup}: "${escapeFor(variantValue, '"')}"` };
    } else {
      edit = { start: obj.start! + 1, end: obj.start! + 1, text: ` ${variantGroup}: "${escapeFor(variantValue, '"')}" ` };
    }
  });
  return edit;
}

export function mutateDefaultVariant(source: string, variantGroup: string, variantValue: string): string {
  return applyEdits(source, computeDefaultVariantEdit(source, variantGroup, variantValue));
}

/** Compute the minimal edit that replaces the base class literal passed to the first `cva()` call. */
export function computeCvaBaseEdit(source: string, newBase: string): TextEdit | null {
  try {
    let cvaCall: t.CallExpression | undefined;
    walk(parseSource(source).program, (n) => {
      if (cvaCall || !t.isCallExpression(n)) return;
      const callee = n.callee;
      const isCva =
        (t.isIdentifier(callee) && callee.name === 'cva') ||
        (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property) && callee.property.name === 'cva');
      if (isCva) cvaCall = n;
    });
    const first = cvaCall?.arguments[0];
    if (!first || !(t.isStringLiteral(first) || isPlainTemplate(first))) return null;
    const quote = quoteFor(source, first);
    return { start: first.start!, end: first.end!, text: `${quote}${escapeFor(newBase, quote)}${quote}` };
  } catch {
    return null;
  }
}

export function mutateCvaBase(source: string, newBase: string): string {
  return applyEdits(source, computeCvaBaseEdit(source, newBase));
}
