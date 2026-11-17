import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';

export interface PreviewNode {
  tag: string;
  elementIndex: number;
  className: string;
  text?: string;
  attrs?: Record<string, string | number | boolean>;
  style?: Record<string, string | number>;
  children: PreviewNode[];
}

export type ResolvedImport = string | { id: string; source: string };

export interface PreviewTreeOptions {
  /** Prefer extracting a specific component exported/declared in the file. */
  targetComponent?: string;
  /** Resolve a relative specifier (`.tsx`/`.jsx`/`.svg`) relative to `fromId` into source text (or `{ id, source }`) or a data URI. */
  resolveImport?: (specifier: string, fromId?: string) => ResolvedImport | null;
  /** Identifier/file path of the current source for resolving nested relative imports. */
  sourceId?: string;
  /** Maximum component/expression expansion depth. Defaults to 6. */
  maxDepth?: number;
  /** @internal Cycle protection across cross-file imports. */
  _visitedImports?: Set<string>;
  /** @internal Current cross-file import depth. */
  _importDepth?: number;
}

const UNKNOWN = Symbol('unknown');
type EvalResult = string | number | boolean | null | undefined | Record<string, unknown> | unknown[] | typeof UNKNOWN;

const CLASS_HELPERS = new Set(['cn', 'clsx', 'classnames', 'classNames', 'twMerge', 'cx']);
const FRAGMENT_TAGS = new Set(['Fragment', 'React.Fragment', 'StrictMode', 'React.StrictMode']);
const SAFE_ATTR_NAMES = new Set([
  'viewBox', 'width', 'height', 'fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin',
  'strokeDasharray', 'opacity', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'points', 'transform', 'preserveAspectRatio', 'type', 'placeholder', 'value', 'checked', 'disabled',
  'rows', 'min', 'max', 'step', 'src', 'alt', 'href', 'role', 'aria-label', 'aria-hidden', 'hidden',
  'open',
]);
const STYLE_KEYS = new Set([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'background',
  'backgroundColor', 'color', 'borderRadius', 'padding', 'gap', 'opacity',
]);

const SKIP_UNKNOWN_GUARD_RE =
  /^(error|err|loading|isLoading|loadFailed|failed|editing|removing|renaming|reauth|setup|open|addOpen|rescheduleModalOpen|blockedModalOpen|hasError|pendingCleanup|ended|checking)$/i;
const DATA_COLLECTION_STATE_RE =
  /^(data|devices|items|tasks|events|occurrences|records|results|rows|list|entries|failures|snapshot|avatar|client)$/i;

const FALLBACK_ICON_PATHS: Record<string, string> = {
  'arrow-left': 'M19 12H5m6-6-6 6 6 6',
  'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
  'arrow-up-right': 'M6 18 18 6M7 6h11v11',
  'chevron-left': 'm14 7-5 5 5 5',
  'chevron-right': 'm10 7 5 5-5 5',
  plus: 'M12 5v14M5 12h14',
  close: 'M18 6 6 18M6 6l12 12',
  check: 'M5 12l5 5L19 7',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-4.35-4.35',
  edit: 'm13 5 6 6M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3Z',
  sort: 'm3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16',
  Today: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  Tasks: 'm3 6 2 2 3-3m-5 8 2 2 3-3m-5 8 2 2 3-3M12 6h9M12 13h9M12 20h9',
  Integrations: 'm10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1',
  History: 'M3 10a9 9 0 1 1 1 7M3 4v6h6m3-3v5l3 2',
  Settings: 'M4 6h16M4 12h16M4 18h16',
  Dispatch: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
};

const DEFAULT_IMG_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none">' +
      '<rect width="36" height="36" rx="10" fill="#234b3b"/>' +
      '<rect x="7" y="21" width="6" height="7" rx="1.5" fill="#b8d4a3"/>' +
      '<rect x="15" y="15" width="6" height="7" rx="1.5" fill="#d6e6b7"/>' +
      '<rect x="23" y="9" width="6" height="7" rx="1.5" fill="#f6f5e8"/>' +
      '</svg>'
  );

const SAMPLE_ITEMS: Record<string, unknown>[] = [
  {
    name: 'Morning Stretch',
    label: 'Daily rituals',
    title: 'Screen & Eye Rest',
    instruction: 'Look 20 feet away and roll your shoulders back.',
    provider: 'google',
    key: 'rituals',
    id: 'sample-1',
    sourceId: 'work-calendar',
    deviceId: 'dev-1',
    platform: 'windows',
    state: 'connected',
    status: 'verified',
    enabled: true,
    isCurrent: true,
    intervalMinutes: 45,
    durationSeconds: 30,
    count: 4,
    total: 8,
    completed: 6,
    rate: 75,
    at: '10:30 AM',
  },
  {
    name: 'Hydrate & Reset',
    label: 'Movement',
    title: 'Posture Check',
    instruction: 'Step away for a glass of water and deep breaths.',
    provider: 'microsoft',
    key: 'calendar',
    id: 'sample-2',
    sourceId: 'personal-calendar',
    deviceId: 'dev-2',
    platform: 'macos',
    state: 'pending',
    status: 'offline_cached',
    enabled: false,
    isCurrent: false,
    intervalMinutes: 60,
    durationSeconds: 45,
    count: 3,
    total: 6,
    completed: 4,
    rate: 67,
    at: '11:15 AM',
  },
];

interface ComponentEntry {
  name: string;
  fn: t.Function;
  exported: boolean;
}

interface HelperFnEntry {
  fn: t.Function;
}

interface FileScope {
  program: t.Program;
  indexByOpening: Map<t.JSXOpeningElement, number>;
  constMap: Map<string, t.Expression>;
  arrayMap: Map<string, t.ArrayExpression>;
  objMap: Map<string, t.ObjectExpression>;
  jsxVarMap: Map<string, t.Expression>;
  stateEnv: Record<string, unknown>;
  components: ComponentEntry[];
  componentByName: Map<string, ComponentEntry>;
  helperFns: Map<string, HelperFnEntry>;
  importMap: Map<string, { specifier: string; importedName: string }>;
  assetImportMap: Map<string, string>;
  reexports: Array<{ specifier: string; importedName: string; exportedName: string }>;
}

interface BuildContext {
  scope: FileScope;
  env: Record<string, unknown>;
  jsxVars: Map<string, t.Expression>;
  depth: number;
  maxDepth: number;
  nodeCount: { value: number };
  maxNodes: number;
  visitedVars: Set<string>;
  options: PreviewTreeOptions;
  extractStaticClass: (el: t.JSXOpeningElement) => string;
  extractImported: (source: string, options?: PreviewTreeOptions) => PreviewNode | null;
}

function parseModule(source: string): t.Program {
  return babelParse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  }).program;
}

function walkAny(node: any, visit: (n: any) => void): void {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key.endsWith('Comments')) continue;
    const val = node[key];
    if (Array.isArray(val)) val.forEach((c) => walkAny(c, visit));
    else if (val && typeof val.type === 'string') walkAny(val, visit);
  }
}

function walkShallowReturns(
  node: any,
  inConditional: boolean,
  out: Array<{ expr: t.Expression | null; unconditional: boolean }>
): void {
  if (!node || typeof node.type !== 'string') return;
  if (t.isFunction(node)) return;
  if (t.isReturnStatement(node)) {
    out.push({ expr: node.argument ?? null, unconditional: !inConditional });
    return;
  }
  if (t.isIfStatement(node)) {
    walkShallowReturns(node.consequent, true, out);
    walkShallowReturns(node.alternate, true, out);
    return;
  }
  if (t.isSwitchStatement(node)) {
    for (const c of node.cases) {
      c.consequent.forEach((s) => walkShallowReturns(s, true, out));
    }
    return;
  }
  if (t.isTryStatement(node)) {
    walkShallowReturns(node.block, true, out);
    walkShallowReturns(node.handler, true, out);
    return;
  }
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key.endsWith('Comments')) continue;
    const val = node[key];
    if (Array.isArray(val)) val.forEach((c) => walkShallowReturns(c, inConditional, out));
    else if (val && typeof val.type === 'string') walkShallowReturns(val, inConditional, out);
  }
}

function unwrapExpr(node: t.Node | null | undefined): t.Node | null | undefined {
  let cur = node;
  while (cur) {
    if (
      t.isTSAsExpression(cur) ||
      t.isTSTypeAssertion(cur) ||
      t.isTSSatisfiesExpression(cur) ||
      t.isTSNonNullExpression(cur) ||
      t.isParenthesizedExpression(cur)
    ) {
      cur = cur.expression;
    } else if (t.isJSXExpressionContainer(cur)) {
      cur = cur.expression;
    } else {
      break;
    }
  }
  return cur;
}

function tagNameOf(el: t.JSXOpeningElement): string {
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

function propKeyName(key: t.Node): string {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  return '';
}

function containsJsx(node: t.Node | null | undefined): boolean {
  let found = false;
  walkAny(node, (n) => {
    if (!found && (t.isJSXElement(n) || t.isJSXFragment(n))) found = true;
  });
  return found;
}

function unwrapReactWrapper(init: t.Node | null | undefined): t.Function | null {
  const u = unwrapExpr(init);
  if (t.isFunction(u)) return u;
  if (t.isCallExpression(u) && u.arguments[0]) {
    const calleeName = t.isIdentifier(u.callee)
      ? u.callee.name
      : t.isMemberExpression(u.callee) && t.isIdentifier(u.callee.property)
        ? u.callee.property.name
        : '';
    if (calleeName === 'memo' || calleeName === 'forwardRef') {
      const inner = unwrapExpr(u.arguments[0]);
      if (t.isFunction(inner)) return inner;
    }
  }
  return null;
}

function getReturnsForFn(fn: t.Function): Array<{ expr: t.Expression | null; unconditional: boolean }> {
  if (t.isArrowFunctionExpression(fn) && !t.isBlockStatement(fn.body)) {
    return [{ expr: fn.body, unconditional: true }];
  }
  const out: Array<{ expr: t.Expression | null; unconditional: boolean }> = [];
  if (t.isBlockStatement(fn.body)) {
    for (const stmt of fn.body.body) {
      walkShallowReturns(stmt, false, out);
    }
  }
  return out;
}

function buildFileScope(program: t.Program): FileScope {
  const indexByOpening = new Map<t.JSXOpeningElement, number>();
  const seen: Record<string, number> = {};
  walkAny(program, (n) => {
    if (t.isJSXOpeningElement(n)) {
      const name = tagNameOf(n);
      const idx = seen[name] ?? 0;
      seen[name] = idx + 1;
      indexByOpening.set(n, idx);
    }
  });

  const constMap = new Map<string, t.Expression>();
  const arrayMap = new Map<string, t.ArrayExpression>();
  const objMap = new Map<string, t.ObjectExpression>();
  const jsxVarMap = new Map<string, t.Expression>();
  const stateEnv: Record<string, unknown> = {};
  const components: ComponentEntry[] = [];
  const componentByName = new Map<string, ComponentEntry>();
  const helperFns = new Map<string, HelperFnEntry>();
  const importMap = new Map<string, { specifier: string; importedName: string }>();
  const assetImportMap = new Map<string, string>();
  const reexports: Array<{ specifier: string; importedName: string; exportedName: string }> = [];

  for (const stmt of program.body) {
    if (t.isImportDeclaration(stmt)) {
      const specifier = stmt.source.value;
      if (!specifier.startsWith('.')) continue;
      if (/\.(svg|png|jpe?g|webp|gif)$/i.test(specifier)) {
        for (const sp of stmt.specifiers) {
          if (t.isImportDefaultSpecifier(sp)) {
            assetImportMap.set(sp.local.name, specifier);
          }
        }
        continue;
      }
      if (/\.css$/i.test(specifier)) continue;
      for (const sp of stmt.specifiers) {
        if (t.isImportDefaultSpecifier(sp)) {
          importMap.set(sp.local.name, { specifier, importedName: 'default' });
        } else if (t.isImportSpecifier(sp)) {
          const importedName = t.isIdentifier(sp.imported) ? sp.imported.name : sp.imported.value;
          importMap.set(sp.local.name, { specifier, importedName });
        }
      }
      continue;
    }

    if (t.isExportNamedDeclaration(stmt) && stmt.source) {
      const specifier = stmt.source.value;
      if (!specifier.startsWith('.')) continue;
      for (const sp of stmt.specifiers) {
        if (t.isExportSpecifier(sp)) {
          const exportedName = t.isIdentifier(sp.exported) ? sp.exported.name : sp.exported.value;
          const importedName = t.isIdentifier(sp.local) ? sp.local.name : String((sp.local as any).value ?? '');
          reexports.push({ specifier, importedName, exportedName });
        }
      }
      continue;
    }

    if (t.isExportAllDeclaration(stmt) && stmt.source.value.startsWith('.')) {
      reexports.push({ specifier: stmt.source.value, importedName: 'default', exportedName: '*' });
    }
  }

  const recordComponent = (name: string, fn: t.Function, exported: boolean) => {
    const returns = getReturnsForFn(fn);
    const hasJsx = returns.some((r) => r.expr && containsJsx(r.expr));
    if (!hasJsx) return;
    if (/^[a-z]/.test(name) && !exported) {
      helperFns.set(name, { fn });
      return;
    }
    const existing = componentByName.get(name);
    if (existing) {
      if (exported) existing.exported = true;
      return;
    }
    const entry: ComponentEntry = { name, fn, exported };
    components.push(entry);
    componentByName.set(name, entry);
  };

  for (const stmt of program.body) {
    if (t.isExportNamedDeclaration(stmt) && stmt.declaration) {
      const d = stmt.declaration;
      if (t.isFunctionDeclaration(d) && d.id) recordComponent(d.id.name, d, true);
      else if (t.isVariableDeclaration(d)) {
        for (const dec of d.declarations) {
          const fn = unwrapReactWrapper(dec.init);
          if (fn && t.isIdentifier(dec.id)) recordComponent(dec.id.name, fn, true);
        }
      }
    } else if (t.isExportDefaultDeclaration(stmt)) {
      const d = stmt.declaration;
      const fn = unwrapReactWrapper(d);
      if (fn) {
        const name = (t.isFunctionDeclaration(d) && d.id?.name) || 'default';
        recordComponent(name, fn, true);
      } else if (t.isIdentifier(d)) {
        const entry = componentByName.get(d.name);
        if (entry) entry.exported = true;
      } else if (t.isCallExpression(d) && d.arguments[0] && t.isIdentifier(d.arguments[0])) {
        const entry = componentByName.get(d.arguments[0].name);
        if (entry) entry.exported = true;
      }
    } else if (t.isFunctionDeclaration(stmt) && stmt.id) {
      recordComponent(stmt.id.name, stmt, false);
    } else if (t.isVariableDeclaration(stmt)) {
      for (const dec of stmt.declarations) {
        const fn = unwrapReactWrapper(dec.init);
        if (fn && t.isIdentifier(dec.id)) recordComponent(dec.id.name, fn, false);
      }
    }
  }

  // Re-check late `export default Ident` or `export { Foo }`
  for (const stmt of program.body) {
    if (t.isExportDefaultDeclaration(stmt) && t.isIdentifier(stmt.declaration)) {
      const entry = componentByName.get(stmt.declaration.name);
      if (entry) entry.exported = true;
    } else if (t.isExportNamedDeclaration(stmt) && !stmt.source) {
      for (const sp of stmt.specifiers) {
        if (t.isExportSpecifier(sp) && t.isIdentifier(sp.local)) {
          const entry = componentByName.get(sp.local.name);
          if (entry) entry.exported = true;
        }
      }
    }
  }

  // Record constants, objects, arrays, and useState defaults across the file
  walkAny(program, (node) => {
    if (t.isFunctionDeclaration(node) && node.id && /^[a-z]/.test(node.id.name)) {
      const rets = getReturnsForFn(node);
      if (rets.some((r) => r.expr && containsJsx(r.expr)) && !helperFns.has(node.id.name)) {
        helperFns.set(node.id.name, { fn: node });
      }
    }
    if (!t.isVariableDeclarator(node) || !node.init) return;
    const init = unwrapExpr(node.init) as t.Expression;

    // useState / React.useState initializers
    if (t.isArrayPattern(node.id) && t.isIdentifier(node.id.elements[0]) && t.isCallExpression(init)) {
      const callee = init.callee;
      const isUseState =
        (t.isIdentifier(callee) && callee.name === 'useState') ||
        (t.isMemberExpression(callee) && t.isIdentifier(callee.property, { name: 'useState' }));
      if (isUseState && init.arguments[0]) {
        const stateName = node.id.elements[0].name;
        const val = evalRawLiteral(init.arguments[0], constMap);
        if (val !== UNKNOWN) {
          if (val === null && DATA_COLLECTION_STATE_RE.test(stateName)) {
            // Keep fetched data models unknown rather than forcing null/loading state
          } else if (Array.isArray(val) && val.length === 0) {
            // Leave empty initial data collections unknown so lists render sample items
          } else {
            stateEnv[stateName] = val;
          }
        }
      }
      return;
    }

    if (!t.isIdentifier(node.id)) return;
    const name = node.id.name;
    if (t.isArrayExpression(init)) {
      arrayMap.set(name, init);
    } else if (t.isObjectExpression(init)) {
      objMap.set(name, init);
    } else if (containsJsx(init) && !unwrapReactWrapper(init)) {
      if (!jsxVarMap.has(name)) jsxVarMap.set(name, init);
    } else if (t.isExpression(init) && !unwrapReactWrapper(init)) {
      if (!constMap.has(name)) constMap.set(name, init);
    }
  });

  return {
    program,
    indexByOpening,
    constMap,
    arrayMap,
    objMap,
    jsxVarMap,
    stateEnv,
    components,
    componentByName,
    helperFns,
    importMap,
    assetImportMap,
    reexports,
  };
}

function evalRawLiteral(node: t.Node | null | undefined, constMap: Map<string, t.Expression>, depth = 0): EvalResult {
  if (depth > 4) return UNKNOWN;
  const u = unwrapExpr(node);
  if (!u) return UNKNOWN;
  if (t.isStringLiteral(u)) return u.value;
  if (t.isNumericLiteral(u)) return u.value;
  if (t.isBooleanLiteral(u)) return u.value;
  if (t.isNullLiteral(u)) return null;
  if (t.isIdentifier(u)) {
    if (u.name === 'undefined') return undefined;
    const c = constMap.get(u.name);
    return c ? evalRawLiteral(c, constMap, depth + 1) : UNKNOWN;
  }
  if (t.isArrayExpression(u)) {
    const out: unknown[] = [];
    for (const el of u.elements) {
      if (!el || t.isSpreadElement(el)) return UNKNOWN;
      const v = evalRawLiteral(el, constMap, depth + 1);
      if (v === UNKNOWN) return UNKNOWN;
      out.push(v);
    }
    return out;
  }
  if (t.isArrowFunctionExpression(u) && !t.isBlockStatement(u.body)) {
    return evalRawLiteral(u.body, constMap, depth + 1);
  }
  return UNKNOWN;
}

function evalValue(node: t.Node | null | undefined, env: Record<string, unknown>, scope: FileScope, depth = 0): EvalResult {
  if (depth > 6) return UNKNOWN;
  const u = unwrapExpr(node);
  if (!u) return UNKNOWN;
  if (t.isStringLiteral(u)) return u.value;
  if (t.isNumericLiteral(u)) return u.value;
  if (t.isBooleanLiteral(u)) return u.value;
  if (t.isNullLiteral(u)) return null;
  if (t.isTemplateLiteral(u)) {
    let acc = '';
    for (let i = 0; i < u.quasis.length; i++) {
      acc += u.quasis[i].value.cooked ?? '';
      if (i < u.expressions.length) {
        const v = evalValue(u.expressions[i], env, scope, depth + 1);
        if (v === UNKNOWN) return UNKNOWN;
        acc += String(v ?? '');
      }
    }
    return acc;
  }
  if (t.isIdentifier(u)) {
    if (u.name === 'undefined') return undefined;
    if (Object.prototype.hasOwnProperty.call(env, u.name)) {
      const val = env[u.name];
      return val === UNKNOWN ? UNKNOWN : (val as EvalResult);
    }
    const c = scope.constMap.get(u.name);
    if (c) return evalValue(c, env, scope, depth + 1);
    const arr = scope.arrayMap.get(u.name);
    if (arr) return evalValue(arr, env, scope, depth + 1);
    const obj = scope.objMap.get(u.name);
    if (obj) return evalValue(obj, env, scope, depth + 1);
    return UNKNOWN;
  }
  if (t.isArrayExpression(u)) {
    return u.elements.map((el) => (el && !t.isSpreadElement(el) ? evalValue(el, env, scope, depth + 1) : UNKNOWN));
  }
  if (t.isObjectExpression(u)) {
    const out: Record<string, unknown> = {};
    for (const p of u.properties) {
      if (t.isSpreadElement(p)) {
        const spread = evalValue(p.argument, env, scope, depth + 1);
        if (spread && typeof spread === 'object' && !Array.isArray(spread)) {
          Object.assign(out, spread);
        }
      } else if (t.isObjectProperty(p)) {
        const k = propKeyName(p.key);
        if (!k) continue;
        const v = evalValue(p.value, env, scope, depth + 1);
        if (v !== UNKNOWN) out[k] = v;
      }
    }
    return out;
  }
  if (t.isMemberExpression(u) || t.isOptionalMemberExpression(u)) {
    const objVal = evalValue(u.object, env, scope, depth + 1);
    if (objVal === UNKNOWN) return UNKNOWN;
    if (objVal === null || objVal === undefined) {
      return t.isOptionalMemberExpression(u) ? undefined : UNKNOWN;
    }
    const key = u.computed
      ? evalValue(u.property, env, scope, depth + 1)
      : t.isIdentifier(u.property)
        ? u.property.name
        : UNKNOWN;
    if (key === UNKNOWN) return UNKNOWN;
    if (typeof objVal === 'object' && key !== null && key !== undefined) {
      const prop = (objVal as Record<string, unknown>)[String(key)];
      return prop === undefined ? UNKNOWN : (prop as EvalResult);
    }
    return UNKNOWN;
  }
  if (t.isUnaryExpression(u)) {
    const arg = evalValue(u.argument, env, scope, depth + 1);
    if (arg === UNKNOWN) return UNKNOWN;
    if (u.operator === '!') return !arg;
    if (u.operator === '-') return -Number(arg);
    if (u.operator === '+') return +Number(arg);
    return UNKNOWN;
  }
  if (t.isBinaryExpression(u)) {
    const l = evalValue(u.left, env, scope, depth + 1);
    const r = evalValue(u.right, env, scope, depth + 1);
    if (l === UNKNOWN || r === UNKNOWN) return UNKNOWN;
    switch (u.operator) {
      case '===': return l === r;
      case '!==': return l !== r;
      case '==': return l == r;
      case '!=': return l != r;
      case '<': return Number(l) < Number(r);
      case '<=': return Number(l) <= Number(r);
      case '>': return Number(l) > Number(r);
      case '>=': return Number(l) >= Number(r);
      case '+': return typeof l === 'string' || typeof r === 'string' ? `${l}${r}` : Number(l) + Number(r);
      case '-': return Number(l) - Number(r);
      default: return UNKNOWN;
    }
  }
  if (t.isLogicalExpression(u)) {
    const l = evalValue(u.left, env, scope, depth + 1);
    if (u.operator === '&&') {
      if (l !== UNKNOWN && !l) return l;
      if (l !== UNKNOWN && l) return evalValue(u.right, env, scope, depth + 1);
      return UNKNOWN;
    }
    if (u.operator === '||') {
      if (l !== UNKNOWN) return l ? l : evalValue(u.right, env, scope, depth + 1);
      return UNKNOWN;
    }
    if (u.operator === '??') {
      if (l !== UNKNOWN) return l !== null && l !== undefined ? l : evalValue(u.right, env, scope, depth + 1);
      return UNKNOWN;
    }
  }
  if (t.isConditionalExpression(u)) {
    const test = evalValue(u.test, env, scope, depth + 1);
    if (test !== UNKNOWN) {
      return evalValue(test ? u.consequent : u.alternate, env, scope, depth + 1);
    }
    return UNKNOWN;
  }
  return UNKNOWN;
}

function evalCondition(node: t.Node | null | undefined, env: Record<string, unknown>, scope: FileScope): boolean | 'unknown' {
  const val = evalValue(node, env, scope);
  return val === UNKNOWN ? 'unknown' : Boolean(val);
}

function shouldSkipUnknownGuard(node: t.Node): boolean {
  const u = unwrapExpr(node);
  if (!u) return false;
  if (t.isIdentifier(u)) return SKIP_UNKNOWN_GUARD_RE.test(u.name);
  if (t.isUnaryExpression(u) && u.operator === '!') {
    const arg = unwrapExpr(u.argument);
    if (t.isIdentifier(arg) && /^(client|supported|authenticated|owned|ready)$/i.test(arg.name)) {
      return true;
    }
  }
  if (t.isBinaryExpression(u) && (u.operator === '===' || u.operator === '==')) {
    const l = unwrapExpr(u.left);
    const r = unwrapExpr(u.right);
    if (t.isNullLiteral(r) || (t.isStringLiteral(r) && /^(loading|error|expired)$/i.test(r.value))) {
      return true;
    }
    if (t.isIdentifier(l) && l.name === 'view' && t.isStringLiteral(r) && r.value !== 'ready') {
      return true;
    }
  }
  if (t.isLogicalExpression(u) && u.operator === '&&') {
    return shouldSkipUnknownGuard(u.left) || shouldSkipUnknownGuard(u.right);
  }
  return false;
}

function comparisonGroupKey(node: t.Node): string | null {
  const u = unwrapExpr(node);
  if (t.isBinaryExpression(u) && (u.operator === '===' || u.operator === '==')) {
    const l = unwrapExpr(u.left);
    if (t.isIdentifier(l) && (t.isStringLiteral(u.right) || t.isNumericLiteral(u.right))) {
      return l.name;
    }
  }
  if (t.isLogicalExpression(u) && u.operator === '&&') {
    return comparisonGroupKey(u.right) ?? comparisonGroupKey(u.left);
  }
  return null;
}

function isEmptyCheckTest(node: t.Node): boolean {
  const u = unwrapExpr(node);
  if (!u) return false;
  if (t.isIdentifier(u)) return SKIP_UNKNOWN_GUARD_RE.test(u.name);
  if (t.isUnaryExpression(u) && u.operator === '!') return true;
  if (t.isBinaryExpression(u) && (u.operator === '===' || u.operator === '==')) {
    const l = unwrapExpr(u.left);
    const r = unwrapExpr(u.right);
    if (t.isNumericLiteral(r, { value: 0 })) return true;
    if (t.isMemberExpression(l) && t.isIdentifier(l.property, { name: 'length' }) && t.isNumericLiteral(r, { value: 0 })) {
      return true;
    }
  }
  return false;
}

function countPreviewNodes(nodes: PreviewNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count += 1 + countPreviewNodes(n.children);
  }
  return count;
}

function extractExprText(node: t.Node | null | undefined, env: Record<string, unknown>, scope: FileScope): string | undefined {
  const evaluated = evalValue(node, env, scope);
  if (evaluated !== UNKNOWN) {
    if (evaluated === null || evaluated === undefined || typeof evaluated === 'boolean') return undefined;
    return String(evaluated);
  }
  const u = unwrapExpr(node);
  if (!u) return undefined;
  if (t.isLogicalExpression(u) && (u.operator === '??' || u.operator === '||')) {
    const right = extractExprText(u.right, env, scope);
    if (right !== undefined) return right;
  }
  if (t.isConditionalExpression(u)) {
    return extractExprText(u.consequent, env, scope) ?? extractExprText(u.alternate, env, scope);
  }
  if (t.isTemplateLiteral(u)) {
    let out = '';
    for (let i = 0; i < u.quasis.length; i++) {
      out += u.quasis[i].value.cooked ?? '';
      if (i < u.expressions.length) {
        const piece = extractExprText(u.expressions[i], env, scope);
        if (piece) out += piece;
      }
    }
    const trimmed = out.replace(/\s+/g, ' ').trim();
    return trimmed || undefined;
  }
  if (t.isIdentifier(u) && u.name !== 'children' && u.name !== 'error' && u.name !== 'message') {
    const spaced = u.name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
  if (t.isMemberExpression(u) && t.isIdentifier(u.property)) {
    const p = u.property.name;
    if (p === 'name' || p === 'title' || p === 'label' || p === 'heading') return 'Sample title';
    if (p === 'instruction' || p === 'description' || p === 'subtitle') return 'Sample description';
    if (p === 'intervalMinutes' || p === 'durationSeconds' || p === 'minutes' || p === 'seconds' || p === 'count' || p === 'rate') {
      return '30';
    }
  }
  return undefined;
}

function resolveImportResult(
  options: PreviewTreeOptions,
  specifier: string
): { id?: string; source: string } | null {
  if (!options.resolveImport) return null;
  const raw = options.resolveImport(specifier, options.sourceId);
  if (!raw) return null;
  return typeof raw === 'string' ? { source: raw } : raw;
}

function extractAttrs(
  el: t.JSXOpeningElement,
  ctx: BuildContext
): { attrs: Record<string, string | number | boolean>; style: Record<string, string | number> } {
  const attrs: Record<string, string | number | boolean> = {};
  const style: Record<string, string | number> = {};
  const tag = tagNameOf(el);

  const assignObj = (objExpr: t.ObjectExpression) => {
    for (const p of objExpr.properties) {
      if (t.isSpreadElement(p)) {
        const spreadName = t.isIdentifier(p.argument) ? p.argument.name : '';
        const target = spreadName ? ctx.scope.objMap.get(spreadName) : undefined;
        if (target) assignObj(target);
        continue;
      }
      if (!t.isObjectProperty(p)) continue;
      const k = propKeyName(p.key);
      if (!SAFE_ATTR_NAMES.has(k)) continue;
      const v = evalValue(p.value, ctx.env, ctx.scope);
      if (v !== UNKNOWN && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
        attrs[k] = v;
      }
    }
  };

  for (const attr of el.attributes) {
    if (t.isJSXSpreadAttribute(attr)) {
      const arg = unwrapExpr(attr.argument);
      if (t.isIdentifier(arg)) {
        const obj = ctx.scope.objMap.get(arg.name);
        if (obj) assignObj(obj);
      } else if (t.isCallExpression(arg) && t.isIdentifier(arg.callee, { name: 'panelProps' })) {
        const firstArg = evalValue(arg.arguments[0], ctx.env, ctx.scope);
        const sel = evalValue(t.identifier('selectedTab'), ctx.env, ctx.scope);
        attrs.role = 'tabpanel';
        if (firstArg !== UNKNOWN && sel !== UNKNOWN && firstArg !== sel) {
          attrs.hidden = true;
        }
      }
      continue;
    }
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
    const key = attr.name.name;
    if (key === 'className' || key === 'class') continue;

    if (key === 'style' && attr.value && t.isJSXExpressionContainer(attr.value)) {
      const st = unwrapExpr(attr.value.expression);
      if (t.isObjectExpression(st)) {
        for (const p of st.properties) {
          if (!t.isObjectProperty(p)) continue;
          const sk = propKeyName(p.key);
          if (!STYLE_KEYS.has(sk)) continue;
          const sv = evalValue(p.value, ctx.env, ctx.scope);
          if (typeof sv === 'string' || typeof sv === 'number') style[sk] = sv;
        }
      }
      continue;
    }

    if (!SAFE_ATTR_NAMES.has(key)) continue;
    if (!attr.value) {
      attrs[key] = true;
      continue;
    }
    if (t.isStringLiteral(attr.value)) {
      attrs[key] = attr.value.value;
      continue;
    }
    if (t.isJSXExpressionContainer(attr.value)) {
      const rawExpr = unwrapExpr(attr.value.expression);
      if (key === 'src' && t.isIdentifier(rawExpr)) {
        const assetSpec = ctx.scope.assetImportMap.get(rawExpr.name);
        if (assetSpec && ctx.options.resolveImport) {
          const resolved = resolveImportResult(ctx.options, assetSpec)?.source;
          if (resolved) {
            attrs.src = resolved.startsWith('data:')
              ? resolved
              : resolved.trimStart().startsWith('<svg')
                ? `data:image/svg+xml;utf8,${encodeURIComponent(resolved)}`
                : DEFAULT_IMG_DATA_URI;
            continue;
          }
        }
        attrs.src = DEFAULT_IMG_DATA_URI;
        continue;
      }
      const v = evalValue(attr.value.expression, ctx.env, ctx.scope);
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        attrs[key] = v;
      } else if (tag === 'img' && key === 'src') {
        attrs.src = DEFAULT_IMG_DATA_URI;
      }
    }
  }

  if (tag === 'img' && !attrs.src) attrs.src = DEFAULT_IMG_DATA_URI;
  return { attrs, style };
}

function buildPreviewClasses(el: t.JSXOpeningElement, ctx: BuildContext): string {
  const base = ctx.extractStaticClass(el);
  if (base) return base;
  const clsAttr = el.attributes.find(
    (a): a is t.JSXAttribute => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'className'
  );
  if (!clsAttr?.value || !t.isJSXExpressionContainer(clsAttr.value)) return '';
  const expr = unwrapExpr(clsAttr.value.expression);
  if (!expr) return '';

  const evalClassPart = (n: t.Node): string => {
    const val = evalValue(n, ctx.env, ctx.scope);
    if (typeof val === 'string') return val;
    const u = unwrapExpr(n);
    if (t.isConditionalExpression(u)) {
      return evalClassPart(u.consequent) || evalClassPart(u.alternate);
    }
    if (t.isLogicalExpression(u) && u.operator === '&&') {
      return evalClassPart(u.right);
    }
    if (t.isTemplateLiteral(u)) {
      let acc = '';
      for (let i = 0; i < u.quasis.length; i++) {
        acc += u.quasis[i].value.cooked ?? '';
        if (i < u.expressions.length) acc += evalClassPart(u.expressions[i]);
      }
      return acc;
    }
    if (t.isCallExpression(u) && t.isIdentifier(u.callee) && CLASS_HELPERS.has(u.callee.name)) {
      return u.arguments.map((a) => evalClassPart(a)).filter(Boolean).join(' ');
    }
    return '';
  };

  return evalClassPart(expr).replace(/\s+/g, ' ').trim();
}

function bindPattern(
  pattern: t.Node,
  val: unknown,
  env: Record<string, unknown>,
  jsxVars: Map<string, t.Expression>,
  scope: FileScope
): void {
  if (t.isIdentifier(pattern)) {
    if (t.isJSXElement(val as t.Node) || t.isJSXFragment(val as t.Node)) {
      jsxVars.set(pattern.name, val as t.Expression);
    } else if (val !== UNKNOWN) {
      env[pattern.name] = val;
    }
    return;
  }
  if (t.isAssignmentPattern(pattern)) {
    if (val === undefined || val === UNKNOWN) {
      const def = evalValue(pattern.right, env, scope);
      bindPattern(pattern.left, def, env, jsxVars, scope);
    } else {
      bindPattern(pattern.left, val, env, jsxVars, scope);
    }
    return;
  }
  if (t.isObjectPattern(pattern) && val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    for (const prop of pattern.properties) {
      if (t.isObjectProperty(prop)) {
        const key = propKeyName(prop.key);
        if (!key) continue;
        bindPattern(prop.value, Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined, env, jsxVars, scope);
      }
    }
  }
}

function collectSeededDefaults(fn: t.Function, scope: FileScope): Record<string, unknown> {
  const env: Record<string, unknown> = { ...scope.stateEnv };
  for (const param of fn.params) {
    const target = t.isAssignmentPattern(param) ? param.left : param;
    if (t.isObjectPattern(target)) {
      for (const prop of target.properties) {
        if (!t.isObjectProperty(prop) || !t.isAssignmentPattern(prop.value)) continue;
        const left = prop.value.left;
        if (!t.isIdentifier(left)) continue;
        const defVal = evalRawLiteral(prop.value.right, scope.constMap);
        if (defVal === UNKNOWN) continue;
        if (defVal === null && !/^(error|err|loading|disabled)$/i.test(left.name)) continue;
        env[left.name] = defVal;
      }
    } else if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
      const defVal = evalRawLiteral(param.right, scope.constMap);
      if (defVal !== UNKNOWN && defVal !== null) env[param.left.name] = defVal;
    }
  }
  return env;
}

function getArrayItems(
  objNode: t.Node,
  ctx: BuildContext
): { items: Array<unknown>; isDynamic: boolean } | null {
  const u = unwrapExpr(objNode);
  if (!u) return null;

  if (t.isArrayExpression(u)) {
    return {
      isDynamic: false,
      items: u.elements.slice(0, 6).map((el) => {
        if (!el || t.isSpreadElement(el)) return SAMPLE_ITEMS[0];
        if (t.isObjectExpression(el)) {
          const rec: Record<string, unknown> = {};
          for (const p of el.properties) {
            if (!t.isObjectProperty(p)) continue;
            const k = propKeyName(p.key);
            if (!k) continue;
            if (containsJsx(p.value)) {
              rec[k] = p.value;
            } else {
              const v = evalValue(p.value, ctx.env, ctx.scope);
              if (v !== UNKNOWN) rec[k] = v;
            }
          }
          return rec;
        }
        const v = evalValue(el, ctx.env, ctx.scope);
        return v === UNKNOWN ? SAMPLE_ITEMS[0] : v;
      }),
    };
  }

  if (t.isIdentifier(u)) {
    const arr = ctx.scope.arrayMap.get(u.name);
    if (arr) return getArrayItems(arr, ctx);
    const val = evalValue(u, ctx.env, ctx.scope);
    if (Array.isArray(val)) return { isDynamic: false, items: val.slice(0, 6) };
    return { isDynamic: true, items: SAMPLE_ITEMS };
  }

  if (t.isCallExpression(u) && t.isMemberExpression(u.callee) && t.isIdentifier(u.callee.property)) {
    const m = u.callee.property.name;
    if (m === 'entries' || m === 'keys' || m === 'values') {
      const target = unwrapExpr(u.arguments[0]);
      if (t.isIdentifier(target)) {
        const obj = ctx.scope.objMap.get(target.name);
        if (obj) {
          const props = obj.properties.filter((p): p is t.ObjectProperty => t.isObjectProperty(p)).slice(0, 4);
          return {
            isDynamic: false,
            items: props.map((p) => {
              const k = propKeyName(p.key);
              const v = evalValue(p.value, ctx.env, ctx.scope);
              return m === 'entries' ? [k, v === UNKNOWN ? SAMPLE_ITEMS[0] : v] : m === 'keys' ? k : v;
            }),
          };
        }
      }
      return { isDynamic: true, items: SAMPLE_ITEMS };
    }
    if (m === 'filter' || m === 'sort' || m === 'slice') {
      return getArrayItems(u.callee.object, ctx);
    }
  }

  return { isDynamic: true, items: SAMPLE_ITEMS };
}

function expandArrayCall(expr: t.CallExpression, ctx: BuildContext): PreviewNode[] {
  const callee = expr.callee;
  if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.property)) return [];
  const method = callee.property.name;

  // Array.from({ length: N }, (_, i) => ...)
  if (method === 'from' && t.isIdentifier(callee.object, { name: 'Array' }) && expr.arguments[1]) {
    const cb = unwrapExpr(expr.arguments[1]);
    if (!t.isFunction(cb)) return [];
    let len = 4;
    const firstArg = unwrapExpr(expr.arguments[0]);
    if (t.isObjectExpression(firstArg)) {
      const lp = firstArg.properties.find((p): p is t.ObjectProperty => t.isObjectProperty(p) && propKeyName(p.key) === 'length');
      const lv = lp ? evalValue(lp.value, ctx.env, ctx.scope) : UNKNOWN;
      if (typeof lv === 'number' && lv > 0) len = Math.min(lv, 8);
    }
    const cbRet = getReturnsForFn(cb)[0]?.expr;
    if (!cbRet) return [];
    const out: PreviewNode[] = [];
    for (let i = 0; i < len; i++) {
      const nextEnv = { ...ctx.env };
      const nextVars = new Map(ctx.jsxVars);
      if (cb.params[0]) bindPattern(cb.params[0], i, nextEnv, nextVars, ctx.scope);
      if (cb.params[1]) bindPattern(cb.params[1], i, nextEnv, nextVars, ctx.scope);
      out.push(...expandExpr(cbRet, { ...ctx, env: nextEnv, jsxVars: nextVars, depth: ctx.depth + 1 }));
    }
    return out;
  }

  if (method !== 'map' && method !== 'flatMap') return [];
  const cb = unwrapExpr(expr.arguments[0]);
  if (!t.isFunction(cb)) return [];
  const resolved = getArrayItems(callee.object, ctx);
  if (!resolved) return [];

  const retExpr = getReturnsForFn(cb).find((r) => r.expr && containsJsx(r.expr))?.expr;
  if (!retExpr) return [];

  const out: PreviewNode[] = [];
  const limit = resolved.isDynamic ? 2 : 6;
  const items = resolved.items.slice(0, limit);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nextEnv = { ...ctx.env };
    const nextVars = new Map(ctx.jsxVars);
    // Support destructured [k, v] from Object.entries
    if (t.isArrayPattern(cb.params[0]) && Array.isArray(item)) {
      cb.params[0].elements.forEach((pat, pi) => {
        if (pat) bindPattern(pat, item[pi], nextEnv, nextVars, ctx.scope);
      });
    } else if (cb.params[0]) {
      bindPattern(cb.params[0], item, nextEnv, nextVars, ctx.scope);
    }
    if (cb.params[1] && t.isIdentifier(cb.params[1])) {
      nextEnv[cb.params[1].name] = i;
    }
    out.push(...expandExpr(retExpr, { ...ctx, env: nextEnv, jsxVars: nextVars, depth: ctx.depth + 1 }));
  }
  return out;
}

function buildElementNode(el: t.JSXElement, ctx: BuildContext): PreviewNode[] {
  if (ctx.nodeCount.value >= ctx.maxNodes || ctx.depth > ctx.maxDepth) return [];
  const tag = tagNameOf(el.openingElement) || 'div';

  if (FRAGMENT_TAGS.has(tag) || tag.endsWith('.Provider')) {
    return expandJsxChildren(el.children, ctx);
  }

  // Inline local components defined in the same file
  const localComp = ctx.scope.componentByName.get(tag);
  if (localComp && ctx.depth < ctx.maxDepth) {
    const nextEnv = collectSeededDefaults(localComp.fn, ctx.scope);
    const nextVars = new Map(ctx.jsxVars);
    for (const attr of el.openingElement.attributes) {
      if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
      if (!attr.value) {
        nextEnv[attr.name.name] = true;
      } else if (t.isStringLiteral(attr.value)) {
        nextEnv[attr.name.name] = attr.value.value;
      } else if (t.isJSXExpressionContainer(attr.value)) {
        if (containsJsx(attr.value.expression)) {
          nextVars.set(attr.name.name, attr.value.expression as t.Expression);
        } else {
          const val = evalValue(attr.value.expression, ctx.env, ctx.scope);
          if (val !== UNKNOWN) nextEnv[attr.name.name] = val;
        }
      }
    }
    const inlineTree = extractFromFunction(localComp.fn, {
      ...ctx,
      env: nextEnv,
      jsxVars: nextVars,
      depth: ctx.depth + 1,
    });
    if (inlineTree.length > 0) return inlineTree;
  }

  // Inline imported components across files when resolveImport is supplied
  const imp = ctx.scope.importMap.get(tag);
  const importDepth = ctx.options._importDepth ?? 0;
  if (imp && ctx.options.resolveImport && importDepth < 2) {
    const visited = ctx.options._visitedImports ?? new Set<string>();
    const cacheKey = `${ctx.options.sourceId ?? ''}::${imp.specifier}#${imp.importedName}`;
    if (!visited.has(cacheKey)) {
      const target = resolveImportResult(ctx.options, imp.specifier);
      if (target && !target.source.startsWith('data:')) {
        const nextVisited = new Set(visited);
        nextVisited.add(cacheKey);
        const importedTree = ctx.extractImported(target.source, {
          targetComponent: imp.importedName === 'default' ? undefined : imp.importedName,
          resolveImport: ctx.options.resolveImport,
          sourceId: target.id,
          maxDepth: Math.max(3, ctx.maxDepth - ctx.depth),
          _visitedImports: nextVisited,
          _importDepth: importDepth + 1,
        });
        if (importedTree) {
          const foreign = markForeignSubtree(importedTree);
          ctx.nodeCount.value += countPreviewNodes([foreign]);
          return [foreign];
        }
      }
    }
  }

  // Lightweight fallback for un-resolved <Icon name="..." /> and <Avatar name="..." />
  if (/^[A-Z]/.test(tag) || tag.includes('.')) {
    if (tag === 'Icon' || tag.endsWith('.Icon')) {
      const nameAttr = el.openingElement.attributes.find(
        (a): a is t.JSXAttribute => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'name' })
      );
      const iconKey =
        nameAttr?.value && t.isStringLiteral(nameAttr.value)
          ? nameAttr.value.value
          : nameAttr?.value && t.isJSXExpressionContainer(nameAttr.value)
            ? String(evalValue(nameAttr.value.expression, ctx.env, ctx.scope) ?? '')
            : '';
      const d = FALLBACK_ICON_PATHS[iconKey] ?? FALLBACK_ICON_PATHS['arrow-up-right'];
      ctx.nodeCount.value += 2;
      return [
        {
          tag: 'svg',
          elementIndex: -1,
          className: buildPreviewClasses(el.openingElement, ctx),
          attrs: {
            viewBox: '0 0 24 24',
            width: 18,
            height: 18,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.8,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          children: [{ tag: 'path', elementIndex: -1, className: '', attrs: { d }, children: [] }],
        },
      ];
    }

    if (tag === 'Avatar') {
      ctx.nodeCount.value += 1;
      return [
        {
          tag: 'span',
          elementIndex: -1,
          className: 'account-avatar shared-avatar',
          text: 'B',
          children: [],
        },
      ];
    }

    const passed = expandJsxChildrenWithText(el.children, ctx);
    if (passed.children.length > 0 || passed.text) {
      ctx.nodeCount.value += 1;
      return [
        {
          tag: 'div',
          elementIndex: ctx.scope.indexByOpening.get(el.openingElement) ?? -1,
          className: buildPreviewClasses(el.openingElement, ctx),
          attrs: { 'data-component': tag },
          ...(passed.text ? { text: passed.text } : {}),
          children: passed.children,
        },
      ];
    }

    // Minimal representative badge for external leaf components without resolveImport
    const titleAttr = el.openingElement.attributes.find(
      (a): a is t.JSXAttribute =>
        t.isJSXAttribute(a) &&
        t.isJSXIdentifier(a.name) &&
        (a.name.name === 'title' || a.name.name === 'label' || a.name.name === 'name')
    );
    const labelHint =
      titleAttr?.value && t.isStringLiteral(titleAttr.value) ? `${tag}: ${titleAttr.value.value}` : tag;
    ctx.nodeCount.value += 1;
    return [
      {
        tag: 'div',
        elementIndex: ctx.scope.indexByOpening.get(el.openingElement) ?? -1,
        className: buildPreviewClasses(el.openingElement, ctx) || 'retune-component-stub',
        attrs: { 'data-component': tag },
        text: labelHint,
        children: [],
      },
    ];
  }

  ctx.nodeCount.value += 1;
  const elementIndex = ctx.scope.indexByOpening.get(el.openingElement) ?? 0;
  const className = buildPreviewClasses(el.openingElement, ctx);
  const { attrs, style } = extractAttrs(el.openingElement, ctx);
  const { text, children } = expandJsxChildrenWithText(el.children, ctx);

  return [
    {
      tag,
      elementIndex,
      className,
      ...(text ? { text } : {}),
      ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
      ...(Object.keys(style).length > 0 ? { style } : {}),
      children,
    },
  ];
}

function markForeignSubtree(node: PreviewNode): PreviewNode {
  return {
    ...node,
    elementIndex: -1,
    children: node.children.map(markForeignSubtree),
  };
}

function expandJsxChildren(rawChildren: t.JSXElement['children'], ctx: BuildContext): PreviewNode[] {
  return expandJsxChildrenWithText(rawChildren, ctx).children;
}

function expandJsxChildrenWithText(
  rawChildren: t.JSXElement['children'],
  ctx: BuildContext
): { text?: string; children: PreviewNode[] } {
  const textParts: string[] = [];
  const children: PreviewNode[] = [];
  const matchedGroups = new Set<string>();

  for (const child of rawChildren) {
    if (ctx.nodeCount.value >= ctx.maxNodes) break;
    if (t.isJSXText(child)) {
      const collapsed = child.value.replace(/\s+/g, ' ').trim();
      if (collapsed) textParts.push(collapsed);
    } else if (t.isJSXElement(child)) {
      children.push(...buildElementNode(child, ctx));
    } else if (t.isJSXFragment(child)) {
      const res = expandJsxChildrenWithText(child.children, ctx);
      if (res.text) textParts.push(res.text);
      children.push(...res.children);
    } else if (t.isJSXExpressionContainer(child)) {
      const expr = child.expression;
      if (t.isJSXEmptyExpression(expr)) continue;

      // Deduplicate mutually-exclusive sibling `ident === 'literal'` guards inside same parent
      const u = unwrapExpr(expr);
      if (t.isLogicalExpression(u) && u.operator === '&&') {
        const cond = evalCondition(u.left, ctx.env, ctx.scope);
        if (cond === 'unknown') {
          const grp = comparisonGroupKey(u.left);
          if (grp) {
            if (matchedGroups.has(grp)) continue;
            matchedGroups.add(grp);
          }
        }
      }

      const nodes = expandExpr(expr, ctx);
      if (nodes.length > 0) {
        children.push(...nodes);
      } else {
        const txt = extractExprText(expr, ctx.env, ctx.scope);
        if (txt) textParts.push(txt);
      }
    }
  }

  return {
    ...(textParts.length > 0 ? { text: textParts.join(' ') } : {}),
    children,
  };
}

function expandExpr(node: t.Node | null | undefined, ctx: BuildContext): PreviewNode[] {
  if (!node || ctx.nodeCount.value >= ctx.maxNodes || ctx.depth > ctx.maxDepth) return [];
  const u = unwrapExpr(node);
  if (!u || t.isNullLiteral(u) || t.isBooleanLiteral(u)) return [];

  if (t.isJSXElement(u)) return buildElementNode(u, ctx);
  if (t.isJSXFragment(u)) return expandJsxChildren(u.children, ctx);

  if (t.isArrayExpression(u)) {
    return u.elements.flatMap((el) => (el && !t.isSpreadElement(el) ? expandExpr(el, ctx) : []));
  }

  if (t.isLogicalExpression(u)) {
    if (u.operator === '&&') {
      const cond = evalCondition(u.left, ctx.env, ctx.scope);
      if (cond === false) return [];
      if (cond === true) return expandExpr(u.right, ctx);
      if (shouldSkipUnknownGuard(u.left)) return [];
      return expandExpr(u.right, ctx);
    }
    if (u.operator === '||' || u.operator === '??') {
      const left = expandExpr(u.left, ctx);
      return left.length > 0 ? left : expandExpr(u.right, ctx);
    }
  }

  if (t.isConditionalExpression(u)) {
    const cond = evalCondition(u.test, ctx.env, ctx.scope);
    if (cond === true) return expandExpr(u.consequent, ctx);
    if (cond === false) return expandExpr(u.alternate, ctx);
    const left = expandExpr(u.consequent, { ...ctx, depth: ctx.depth + 1 });
    const right = expandExpr(u.alternate, { ...ctx, depth: ctx.depth + 1 });
    if (isEmptyCheckTest(u.test) && right.length > 0) return right;
    return countPreviewNodes(left) >= countPreviewNodes(right) ? left : right;
  }

  if (t.isCallExpression(u)) {
    const callee = u.callee;
    if (
      (t.isIdentifier(callee) && callee.name === 'createPortal') ||
      (t.isMemberExpression(callee) && t.isIdentifier(callee.property) && callee.property.name === 'createPortal')
    ) {
      return expandExpr(u.arguments[0], ctx);
    }
    // Helper function calls returning JSX, e.g. {number('Calendar buffer', 'calendarBeforeMinutes', 0, 120)}
    if (t.isIdentifier(callee)) {
      const helper = ctx.scope.helperFns.get(callee.name);
      if (helper && ctx.depth < ctx.maxDepth) {
        const nextEnv = { ...ctx.env };
        const nextVars = new Map(ctx.jsxVars);
        helper.fn.params.forEach((p, idx) => {
          const arg = u.arguments[idx];
          const val = arg ? evalValue(arg, ctx.env, ctx.scope) : undefined;
          bindPattern(p, val, nextEnv, nextVars, ctx.scope);
        });
        return extractFromFunction(helper.fn, { ...ctx, env: nextEnv, jsxVars: nextVars, depth: ctx.depth + 1 });
      }
    }
    return expandArrayCall(u, ctx);
  }

  if (t.isIdentifier(u)) {
    if (ctx.visitedVars.has(u.name)) return [];
    const target = ctx.jsxVars.get(u.name) ?? ctx.scope.jsxVarMap.get(u.name);
    if (target) {
      const nextVisited = new Set(ctx.visitedVars);
      nextVisited.add(u.name);
      return expandExpr(target, { ...ctx, visitedVars: nextVisited, depth: ctx.depth + 1 });
    }
  }

  if (t.isMemberExpression(u)) {
    const objId = unwrapExpr(u.object);
    if (t.isIdentifier(objId)) {
      const dict = ctx.scope.objMap.get(objId.name);
      if (dict) {
        const rawKey = u.computed ? evalValue(u.property, ctx.env, ctx.scope) : t.isIdentifier(u.property) ? u.property.name : UNKNOWN;
        const prop =
          rawKey !== UNKNOWN
            ? dict.properties.find((p): p is t.ObjectProperty => t.isObjectProperty(p) && propKeyName(p.key) === String(rawKey))
            : dict.properties.find((p): p is t.ObjectProperty => t.isObjectProperty(p));
        if (prop) return expandExpr(prop.value, ctx);
      }
    }
  }

  return [];
}

function extractFromFunction(fn: t.Function, ctx: BuildContext): PreviewNode[] {
  const returns = getReturnsForFn(fn);
  if (returns.length === 0) return [];

  let bestNodes: PreviewNode[] = [];
  let bestScore = -1;

  for (const ret of returns) {
    if (!ret.expr) continue;
    const trialCtx: BuildContext = {
      ...ctx,
      nodeCount: { value: ctx.nodeCount.value },
    };
    const nodes = expandExpr(ret.expr, trialCtx);
    const weight = countPreviewNodes(nodes) * (ret.unconditional ? 3 : 1);
    if (weight > bestScore && nodes.length > 0) {
      bestScore = weight;
      bestNodes = nodes;
    }
  }

  return bestNodes;
}

function nodesToRoot(nodes: PreviewNode[]): PreviewNode | null {
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  return { tag: 'div', elementIndex: -1, className: '', children: nodes };
}

function pickPrimaryComponent(scope: FileScope, targetName?: string): ComponentEntry | undefined {
  if (targetName) {
    const exact = scope.componentByName.get(targetName);
    if (exact) return exact;
    const lower = targetName.toLowerCase();
    const loose = scope.components.find((c) => c.name.toLowerCase() === lower);
    if (loose) return loose;
  }

  const pool = scope.components.some((c) => c.exported)
    ? scope.components.filter((c) => c.exported)
    : scope.components;

  if (pool.length === 0) return undefined;
  if (pool.length === 1) return pool[0];

  // Prefer the component with the richest returned JSX (so small hooks/helpers never beat main views)
  let chosen = pool[0];
  let topScore = -1;
  for (const comp of pool) {
    let localJsx = 0;
    walkAny(comp.fn, (n) => {
      if (t.isJSXOpeningElement(n)) localJsx += 1;
    });
    if (localJsx > topScore) {
      topScore = localJsx;
      chosen = comp;
    }
  }
  return chosen;
}

export function createPreviewExtractor(
  extractStaticClass: (el: t.JSXOpeningElement) => string
) {
  return function extractPreviewTreeWithClass(source: string, options: PreviewTreeOptions = {}): PreviewNode | null {
    try {
      const program = parseModule(source);
      const scope = buildFileScope(program);
      const maxDepth = options.maxDepth ?? 6;
      const maxNodes = 220;

      // Re-export barrel file (`export { X as Y } from './...'`) with no local components
      if (scope.components.length === 0 && scope.reexports.length > 0) {
        const re = scope.reexports[0];
        const importDepth = options._importDepth ?? 0;
        const visited = options._visitedImports ?? new Set<string>();
        const key = `${options.sourceId ?? ''}::${re.specifier}#${re.importedName}`;
        if (options.resolveImport && importDepth < 2 && !visited.has(key)) {
          const target = resolveImportResult(options, re.specifier);
          if (target && !target.source.startsWith('data:')) {
            const nextVisited = new Set(visited);
            nextVisited.add(key);
            const targetTree = extractPreviewTreeWithClass(target.source, {
              targetComponent: re.importedName === 'default' ? undefined : re.importedName,
              resolveImport: options.resolveImport,
              sourceId: target.id,
              maxDepth,
              _visitedImports: nextVisited,
              _importDepth: importDepth,
            });
            if (targetTree) return markForeignSubtree(targetTree);
          }
        }
        return {
          tag: 'div',
          elementIndex: -1,
          className: 'retune-component-stub',
          attrs: { 'data-component': re.exportedName },
          text: `${re.exportedName === '*' ? re.importedName : re.exportedName} (re-exported from ${re.specifier})`,
          children: [],
        };
      }

      const comp = pickPrimaryComponent(scope, options.targetComponent);
      if (comp) {
        const env = collectSeededDefaults(comp.fn, scope);
        const ctx: BuildContext = {
          scope,
          env,
          jsxVars: new Map(scope.jsxVarMap),
          depth: 0,
          maxDepth,
          nodeCount: { value: 0 },
          maxNodes,
          visitedVars: new Set(),
          options,
          extractStaticClass,
          extractImported: extractPreviewTreeWithClass,
        };
        const nodes = extractFromFunction(comp.fn, ctx);
        const result = nodesToRoot(nodes);
        if (result) return result;
      }

      // Fallback for non-component files with bare JSX (`const x = <div>...</div>` or `root.render(...)`)
      let rootExpr: t.JSXElement | t.JSXFragment | null = null;
      walkAny(program, (n) => {
        if (!rootExpr && (t.isJSXElement(n) || t.isJSXFragment(n))) rootExpr = n;
      });
      if (!rootExpr) return null;

      const ctx: BuildContext = {
        scope,
        env: { ...scope.stateEnv },
        jsxVars: new Map(scope.jsxVarMap),
        depth: 0,
        maxDepth,
        nodeCount: { value: 0 },
        maxNodes,
        visitedVars: new Set(),
        options,
        extractStaticClass,
        extractImported: extractPreviewTreeWithClass,
      };
      return nodesToRoot(expandExpr(rootExpr, ctx));
    } catch {
      return null;
    }
  };
}
