# Stage Interaction & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Retune visual editor write to the right place, report real results, support undo/keyboard/selection properly, and adopt the host theme behind a host-agnostic token and bridge layer.

**Architecture:** The extension host owns the edit target, working class string and baseline; webviews keep only an undo stack. Logic moves into pure modules (core edit computation, extension `stage-state.ts`, webview `lib/` and `state/`) that are unit-tested in node; React components are thin and tested with `renderToStaticMarkup`. All colour goes through `--rt-*` tokens mapped from `--vscode-*`.

**Tech Stack:** TypeScript 7, pnpm 10 workspaces + Turborepo, React 19, Tailwind CSS 4.3 (`@tailwindcss/vite`, `@tailwindcss/browser`), lucide-react, vitest 5, Babel parser, VS Code webview API.

**Spec:** `docs/superpowers/specs/2026-11-11-stage-interaction-design.md` — read §3–§8 before starting any task.

**Execution:** one Haiku implementer subagent per task, in order, on branch `feat/stage-interaction-polish`. Tasks 3, 11 and 12 are the widest; if a Haiku attempt fails review twice, re-dispatch that task on Sonnet.

## Global Constraints

- Work only on branch `feat/stage-interaction-polish` in `C:\Users\trave\Documents\Projects\Retune`. Commit at the end of each task; never push.
- **Never run** `pnpm build` at the repo root, `pnpm --filter retune-vscode build`, or `scripts/install-local.mjs` — they install the extension into the user's IDEs. To bundle the extension for its test use `node packages/vscode-extension/scripts/bundle.mjs`.
- After any change under `packages/core/src`, run `pnpm --filter @retune/core build` before type-checking or testing another package (they consume `core/dist`).
- Per-package commands: test `pnpm --filter <pkg> test`; typecheck `pnpm --filter <pkg> lint`. Package names: `@retune/core`, `@retune/webview`, `retune-vscode`.
- Every task must leave `pnpm --filter @retune/core test`, `pnpm --filter @retune/webview lint`, `pnpm --filter @retune/webview test`, `pnpm --filter retune-vscode lint` green.
- Webview colour rule (from Task 8 on, for files a task creates or rewrites): only token utilities (`bg-canvas bg-panel bg-raised bg-overlay border-line text-fg text-muted text-subtle bg-accent text-accent-fg bg-accent-hover ring-focus border-focus bg-hover bg-active text-active-fg text-danger text-success text-warn` and opacity variants such as `bg-accent/20`). No raw hex, no `zinc-/indigo-/rose-/emerald-/amber-/sky-/violet-` utilities, except in `components/controls.tsx` preset data, `state/demo.ts`, `styles.css`.
- Minimum font size `text-[11px]`; body `text-xs`. `font-mono` only for class names, tags and numbers.
- Every interactive element: `type="button"` on buttons, visible `focus-visible:ring-1 focus-visible:ring-focus outline-none`; icon-only buttons need `aria-label` and `title`.
- Icons: `lucide-react`, `size={14}`.
- Webview tests run in node (no jsdom). Test components with `renderToStaticMarkup` from `react-dom/server`. Test files live in `packages/webview/src/__tests__/` and are named `*.test.ts(x)`.
- Markup assertions are order-sensitive: on any element write `role` first, then `aria-*`, then other props; put a button's or title's text directly inside its own element (e.g. `<span>Layout</span>`, `<button …>Sync</button>`), never concatenated with siblings in the same text node.
- Do not add dependencies other than `@tailwindcss/browser@4.3.5` (Task 5).
- Commit message trailer: `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Class text containing quotes or `${`** written into a `cva()` base literal must be escaped for the literal's quote style, not corrupt the file. → Task 1 test.
2. **The targeted element disappears** (user deletes or renames it while dirty): Sync must fail with a message, not write to a different element. → Task 2 test.
3. **External edit while dirty**: the user's unsynced classes survive; only the baseline moves. → Task 2 test.
4. **Slider drag flooding history**: a burst of changes is one undo step back to the pre-drag value. → Task 6 test.
5. **Popover/menu in a panel narrower or shorter than itself** (stage docked at ~250px): position is never negative and never past the margin. → Task 7 tests.

---

### Task 1: Core protocol types and `computeCvaBaseEdit`

**Files:**
- Modify: `packages/core/src/types/index.ts`
- Modify: `packages/core/src/ast/jsx-mutator.ts` (append two functions)
- Create: `packages/core/src/__tests__/cva-base-edit.test.ts`
- Modify (compile fixes only): `packages/webview/src/App.tsx`, `packages/vscode-extension/src/providers/stage-panel.ts`

**Interfaces:**
- Produces (types): `StageState.targetIndex?: number`, `StageState.baselineClass: string`, `ComponentMetadata.elements?: ElementInfo[]` (import type from `../ast/jsx-mutator`), `WebviewMessage` gains `{ type: 'SELECT_ELEMENT'; payload: { name: string; index: number } | null }` and `MUTATE_CLASSES` payload becomes `{ className: string; componentName?: string }`, `HostMessage` gains `{ type: 'MUTATION_RESULT'; payload: { ok: boolean; kind: 'classes' | 'variant'; message: string } }` and `SYNC_COMPONENT` payload becomes `ComponentMetadata | null`. Do **not** remove `SWITCH_TAB`, `THEME_CHANGED`, `MUTATION_SUCCESS` yet (Task 14).
- Produces (functions, exported from `jsx-mutator.ts`): `computeCvaBaseEdit(source: string, newBase: string): TextEdit | null`, `mutateCvaBase(source: string, newBase: string): string`.

- [ ] **Step 1: Write the failing test** `cva-base-edit.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { computeCvaBaseEdit, mutateCvaBase } from '../ast/jsx-mutator';

const SRC = `// keep
const b = cva(
  'inline-flex gap-2', // base
  { variants: { size: { sm: 'h-8' } }, defaultVariants: { size: 'sm' } }
);
export const A = () => <button className="x">a</button>;
`;

describe('computeCvaBaseEdit', () => {
  it('replaces only the base literal and keeps the quote style', () => {
    expect(mutateCvaBase(SRC, 'inline-flex gap-4')).toBe(SRC.replace("'inline-flex gap-2'", "'inline-flex gap-4'"));
  });
  it('escapes the quote character of the literal', () => {
    expect(mutateCvaBase(SRC, "content-['a']")).toContain("'content-[\\'a\\']', // base");
  });
  it('keeps an expression-free template literal as a template and escapes ${', () => {
    const src = 'const b = cva(`p-2`, {});';
    expect(mutateCvaBase(src, 'p-4 ${x}')).toBe('const b = cva(`p-4 \\${x}`, {});');
  });
  it('supports member calls like cvaLib.cva("...")', () => {
    expect(mutateCvaBase('const b = lib.cva("p-2");', 'p-3')).toBe('const b = lib.cva("p-3");');
  });
  it('returns null when the base is not a plain string or there is no cva()', () => {
    expect(computeCvaBaseEdit('const b = cva(["p-2", "m-1"], {});', 'p-4')).toBeNull();
    expect(computeCvaBaseEdit('const b = cva(base, {});', 'p-4')).toBeNull();
    expect(computeCvaBaseEdit('const x = <div className="a" />;', 'p-4')).toBeNull();
  });
  it('produces one small edit', () => {
    const edit = computeCvaBaseEdit(SRC, 'p-1')!;
    expect(SRC.slice(edit.start, edit.end)).toBe("'inline-flex gap-2'");
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @retune/core test` — expected: FAIL (`computeCvaBaseEdit` is not exported).
- [ ] **Step 3: Implement** both functions in `jsx-mutator.ts` using the file's existing `parseSource`, `walk`, `quoteFor`, `escapeFor`, `applyEdits`, `isPlainTemplate`. Use the first `CallExpression` whose callee is identifier `cva` or a member expression with property `cva`; edit `arguments[0]` when it is a `StringLiteral` or plain template literal, else return `null`. Wrap parsing in `try/catch` returning `null`.
- [ ] **Step 4: Edit the types** exactly as listed under Interfaces.
- [ ] **Step 5: Compile fixes.** In `App.tsx`: add `baselineClass` to `DEFAULT_STAGE_STATE` with the same string as that object's `harmonicsClass`; in the `SYNC_COMPONENT` branch start with `if (!msg.payload) { setMeta(null); return; }`; in `handleUpdateHarmonics` change the `MUTATE_CLASSES` payload to `{ className: newClasses }`. In `stage-panel.ts`: add `baselineClass: ''` to the `_stageState` initialiser and read `className` only from the `MUTATE_CLASSES` payload, passing `StagePanel._stageState.targetElement ?? ''` where `componentName` was used.
- [ ] **Step 6: Verify.** `pnpm --filter @retune/core test` PASS (all files); `pnpm --filter @retune/core build`; `pnpm --filter @retune/webview lint`; `pnpm --filter retune-vscode lint` — all exit 0.
- [ ] **Step 7: Commit** `feat(core): cva base edit and stage protocol types for targets, baseline and mutation results`.

---

### Task 2: Extension pure stage-state module

**Files:**
- Create: `packages/vscode-extension/src/state/stage-state.ts` (must not import `vscode`)
- Create: `packages/vscode-extension/src/__tests__/stage-state.test.ts`

**Interfaces:**
- Consumes from `@retune/core`: `listElements`, `extractCvaMetadata`, `computeClassNameEdit`, `computeCvaBaseEdit`, `computeDefaultVariantEdit`, `applyEdits`, types `ElementInfo`, `CvaMetadata`, `StageState`, `TextEdit`.
- Produces:

```ts
export interface TargetRef { targetElement?: string; targetIndex?: number }
/** Nth element whose name === name (exact, case-sensitive). */
export function resolveTarget(elements: ElementInfo[], name?: string, index?: number): ElementInfo | undefined;
/** Returns {} when name is missing or matches nothing; otherwise { targetElement: name, targetIndex } with index clamped to the last match. */
export function normalizeTarget(elements: ElementInfo[], name?: string, index?: number): TargetRef;
/** Classes the file holds for the target; root = cva base when hasCva, else first element's className, else ''. */
export function fileClassFor(cva: CvaMetadata, elements: ElementInfo[], target: TargetRef): string;
export function reconcile(state: StageState, fileClass: string, targetChanged: boolean): StageState;
export type MutationPlan = { ok: true; edit: TextEdit | null; message: string } | { ok: false; message: string };
export function planClassMutation(source: string, target: TargetRef, className: string): MutationPlan;
export function planVariantMutation(source: string, group: string, value: string): MutationPlan;
```

Messages (exact): success `Synced to code`; no-op `Already up to date`; missing target `` `No <${name}> element found` ``; root without elements or cva `No JSX element found`; cva base not editable `cva() base classes are not a plain string`; variant success `` `Default ${group} set to ${value}` ``; variant failure `No defaultVariants block found`; thrown parse error `Could not parse file`.

Rules: `planClassMutation` with a target resolves it via `listElements(source)` + `resolveTarget` and calls `computeClassNameEdit(source, { offset: el.start }, className)`. With no target: `extractCvaMetadata(source).hasCva` → `computeCvaBaseEdit`; otherwise `computeClassNameEdit(source, {}, className)` only if `listElements(source).length > 0`. If `applyEdits(source, edit) === source` return the no-op plan with `edit: null`. `reconcile`: `targetChanged || state.harmonicsClass === state.baselineClass` → both become `fileClass`; else only `baselineClass`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { applyEdits, extractCvaMetadata, listElements, type StageState } from '@retune/core';
import { fileClassFor, normalizeTarget, planClassMutation, planVariantMutation, reconcile, resolveTarget } from '../state/stage-state';

const SRC = `const b = cva('base-a', { variants: {}, defaultVariants: { size: 'sm' } });
export const A = () => (
  <div className="wrap">
    <span className="one">1</span>
    <span className="two">2</span>
  </div>
);
`;
const PLAIN = `export const A = () => <div className="wrap"><span className="one">1</span></div>;`;
const state = (h: string, b: string): StageState => ({
  selectedVariants: {}, propValues: {}, harmonicsClass: h, baselineClass: b,
  viewport: 'responsive', showGrid: true, activeTab: 'stage',
});

describe('targets', () => {
  const els = listElements(SRC);
  it('resolves the Nth exact-name element', () => {
    expect(resolveTarget(els, 'span', 1)?.className).toBe('two');
    expect(resolveTarget(els, 'Span', 0)).toBeUndefined();
    expect(resolveTarget(els, undefined)).toBeUndefined();
  });
  it('normalises unknown names to the root and clamps the index', () => {
    expect(normalizeTarget(els, 'Button')).toEqual({});
    expect(normalizeTarget(els, 'span', 9)).toEqual({ targetElement: 'span', targetIndex: 1 });
    expect(normalizeTarget(els, 'div')).toEqual({ targetElement: 'div', targetIndex: 0 });
  });
  it('reads the file class for root and element targets', () => {
    expect(fileClassFor(extractCvaMetadata(SRC), els, {})).toBe('base-a');
    expect(fileClassFor(extractCvaMetadata(SRC), els, { targetElement: 'span', targetIndex: 1 })).toBe('two');
    expect(fileClassFor(extractCvaMetadata(PLAIN), listElements(PLAIN), {})).toBe('wrap');
  });
});

describe('reconcile', () => {
  it('follows the file when clean or when the target changed', () => {
    expect(reconcile(state('a', 'a'), 'b', false)).toMatchObject({ harmonicsClass: 'b', baselineClass: 'b' });
    expect(reconcile(state('edited', 'a'), 'z', true)).toMatchObject({ harmonicsClass: 'z', baselineClass: 'z' });
  });
  it('keeps unsynced edits when the file changes underneath', () => {
    expect(reconcile(state('edited', 'a'), 'b', false)).toMatchObject({ harmonicsClass: 'edited', baselineClass: 'b' });
  });
});

describe('planClassMutation', () => {
  it('edits the cva base for the root target', () => {
    const plan = planClassMutation(SRC, {}, 'base-b');
    expect(plan).toMatchObject({ ok: true, message: 'Synced to code' });
    expect(applyEdits(SRC, (plan as any).edit)).toBe(SRC.replace("'base-a'", "'base-b'"));
  });
  it('edits exactly the Nth element', () => {
    const plan = planClassMutation(SRC, { targetElement: 'span', targetIndex: 1 }, 'two x');
    expect(applyEdits(SRC, (plan as any).edit)).toBe(SRC.replace('"two"', '"two x"'));
  });
  it('fails instead of writing elsewhere when the target is gone', () => {
    expect(planClassMutation(SRC, { targetElement: 'span', targetIndex: 2 }, 'x')).toEqual({ ok: false, message: 'No <span> element found' });
    expect(planClassMutation(SRC, { targetElement: 'section', targetIndex: 0 }, 'x')).toEqual({ ok: false, message: 'No <section> element found' });
  });
  it('reports a no-op, non-string cva bases, empty files and parse errors', () => {
    expect(planClassMutation(SRC, {}, 'base-a')).toEqual({ ok: true, edit: null, message: 'Already up to date' });
    expect(planClassMutation(`const b = cva(['a'], {});`, {}, 'x')).toEqual({ ok: false, message: 'cva() base classes are not a plain string' });
    expect(planClassMutation(`export const n = 1;`, {}, 'x')).toEqual({ ok: false, message: 'No JSX element found' });
    expect(planClassMutation(PLAIN, {}, 'wrap p-2')).toMatchObject({ ok: true });
  });
});

describe('planVariantMutation', () => {
  it('sets the default and reports failures', () => {
    const plan = planVariantMutation(SRC, 'size', 'lg');
    expect(plan).toMatchObject({ ok: true, message: 'Default size set to lg' });
    expect(applyEdits(SRC, (plan as any).edit)).toContain("size: 'lg'");
    expect(planVariantMutation(PLAIN, 'size', 'lg')).toEqual({ ok: false, message: 'No defaultVariants block found' });
    expect(planVariantMutation(SRC, 'size', 'sm')).toEqual({ ok: true, edit: null, message: 'Already up to date' });
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter retune-vscode exec vitest run src/__tests__/stage-state.test.ts` — expected: FAIL (module not found).
- [ ] **Step 3: Implement** `stage-state.ts` per Interfaces. `extractCvaMetadata` throws on unparsable input: wrap each `plan*` body in `try/catch` returning `{ ok: false, message: 'Could not parse file' }`.
- [ ] **Step 4: Run** the same command — expected: PASS. Then `pnpm --filter retune-vscode lint` — exit 0.
- [ ] **Step 5: Commit** `feat(extension): pure stage-state module for targets, reconcile and mutation planning`.

---

### Task 3: Host wiring — sinks, no echo, minimal edits, results, element selection

**Files:**
- Modify: `packages/vscode-extension/src/providers/stage-panel.ts`
- Modify: `packages/vscode-extension/src/providers/sidebar.provider.ts`
- Modify: `packages/vscode-extension/src/extension.ts`
- Modify: `packages/vscode-extension/src/__tests__/extension.test.ts`

**Interfaces:**
- Consumes: everything Task 2 produces; `listElements` from core.
- Produces (static API of `StagePanel`, used by sidebar provider and `extension.ts`):

```ts
export type SinkId = 'stage' | 'sidebar';
static registerSink(id: SinkId, post: (msg: HostMessage) => void): vscode.Disposable;
static broadcast(msg: HostMessage, except?: SinkId): void;
static syncAll(except?: SinkId): void;          // SYNC_COMPONENT (payload may be null), SYNC_STAGE_STATE, SYNC_CONFIG
static handleSharedMessage(message: WebviewMessage, extensionUri: vscode.Uri, source: SinkId): Promise<void>;
static getActiveMetadata(): ComponentMetadata | null;   // now includes elements: listElements(text)
static setActiveDocument(document: vscode.TextDocument): void;
```

Remove `onDidStateChange`, `_stateListeners`, `_notifyListeners`, the instance `syncAll`/`postMessage`/`updateDocument`, and `RetuneSidebarProvider.syncSidebar` (callers switch to `StagePanel.syncAll()`).

Behaviour:
- The panel constructor registers the `'stage'` sink (dispose it with the panel). `resolveWebviewView` registers the `'sidebar'` sink and passes `'sidebar'` as `source`. Both `onDidReceiveMessage` listeners must `return StagePanel.handleSharedMessage(...)` so callers can await it.
- `READY` → `syncAll()`.
- `UPDATE_STAGE_STATE` → merge the patch, then `broadcast({ type: 'SYNC_STAGE_STATE', payload: state }, source)` (never back to the sender). `UPDATE_PROP_VALUE` → same with the merged `propValues`.
- `UPDATE_CONFIG` → `await updateRetuneConfig`, then `broadcast` `SYNC_CONFIG` to all.
- `SELECT_ELEMENT` → `normalizeTarget(meta.elements, payload?.name, payload?.index)`; replace `targetElement`/`targetIndex` in state (delete both for root); `reconcile(state, fileClassFor(...), true)`; `syncAll()`; if an element was selected and a visible text editor shows the active document, `editor.revealRange` the element's line with `vscode.TextEditorRevealType.InCenterIfOutsideViewport`.
- `MUTATE_CLASSES` / `MUTATE_VARIANT`: no active document → `broadcast` `MUTATION_RESULT { ok: false, kind, message: 'No active component file' }`. Otherwise call `planClassMutation(doc.getText(), state, className)` / `planVariantMutation(...)`; when the plan has an edit, apply `WorkspaceEdit.replace(doc.uri, new vscode.Range(doc.positionAt(edit.start), doc.positionAt(edit.end)), edit.text)`; if `applyEdit` resolves `false` report `{ ok: false, message: 'VS Code rejected the edit' }`. On a successful class mutation set `baselineClass = harmonicsClass = className` before broadcasting. Always `broadcast` the `MUTATION_RESULT` to all sinks, then `syncAll()`.
- `setActiveDocument`: compute meta; `targetChanged` = document URI differs from the previous one. When the document is new, drop the target, reset `selectedVariants` to the cva defaults and take `viewport`/`showGrid` from config. Always run `reconcile(state, fileClassFor(meta.cva, meta.elements ?? [], target), targetChanged)` — if the current target no longer resolves, keep the target fields and use `baselineClass` unchanged. Then `syncAll()`.
- `render(..., options)`: `options.targetElement` goes through `normalizeTarget` (unknown names → root) and `reconcile(..., true)`.
- `extension.ts`: config change → `StagePanel.syncAll()`.

- [ ] **Step 1: Extend the test.** In `extension.test.ts`, extract the mock construction and bundle loading into `function loadExtension()` returning `{ ext, mockVscode, registeredViews, registeredCommands, getSidebarProvider }`; keep the existing test passing through it; add:

```ts
it('syncs null component, does not echo state to the sender, and reports mutation failures', async () => {
  const { ext, mockVscode, getSidebarProvider } = loadExtension();
  ext.activate({ extensionUri: mockVscode.Uri.file(path.resolve(__dirname, '..', '..')), subscriptions: [] });
  const posted: any[] = [];
  let receive: (m: any) => unknown = () => {};
  const view = { webview: {
    options: {}, html: '', cspSource: 'vscode-resource:', asWebviewUri: (u: any) => u.fsPath,
    onDidReceiveMessage: (fn: any) => { receive = fn; return { dispose() {} }; },
    postMessage: async (m: any) => { posted.push(m); return true; },
  } };
  getSidebarProvider().resolveWebviewView(view, {}, {});
  await receive({ type: 'READY' });
  expect(posted.find((m) => m.type === 'SYNC_COMPONENT')).toEqual({ type: 'SYNC_COMPONENT', payload: null });
  expect(posted.find((m) => m.type === 'SYNC_STAGE_STATE').payload).toHaveProperty('baselineClass');
  posted.length = 0;
  await receive({ type: 'UPDATE_STAGE_STATE', payload: { showGrid: false } });
  expect(posted.filter((m) => m.type === 'SYNC_STAGE_STATE')).toEqual([]);
  await receive({ type: 'MUTATE_CLASSES', payload: { className: 'p-2' } });
  expect(posted.find((m) => m.type === 'MUTATION_RESULT').payload).toEqual({ ok: false, kind: 'classes', message: 'No active component file' });
  ext.deactivate();
});
```

- [ ] **Step 2: Run** `node packages/vscode-extension/scripts/bundle.mjs` then `pnpm --filter retune-vscode test` — expected: the new test FAILS.
- [ ] **Step 3: Implement** the behaviour above. Keep a single module-private `Map<SinkId, (msg: HostMessage) => void>`.
- [ ] **Step 4: Verify.** `pnpm --filter retune-vscode lint`; `node packages/vscode-extension/scripts/bundle.mjs`; `pnpm --filter retune-vscode test` — expected: all PASS.
- [ ] **Step 5: Commit** `feat(extension): single-source stage state, minimal edits, mutation results and element selection`.

---

### Task 4: Webview HTML with CSP and nonce, no CDN

**Files:**
- Create: `packages/vscode-extension/src/providers/webview-html-template.ts` (must not import `vscode`)
- Create: `packages/vscode-extension/src/__tests__/webview-html-template.test.ts`
- Modify: `packages/vscode-extension/src/providers/webview-html.ts`

**Interfaces:**
- Produces:

```ts
export interface WebviewHtmlOptions {
  cspSource: string; nonce: string; viewMode: 'editor-tab' | 'sidebar';
  scriptSrc: string; styleHref?: string; baseHref?: string; devOrigin?: string;
}
export function buildCsp(o: { cspSource: string; nonce: string; devOrigin?: string }): string;
export function renderWebviewHtml(o: WebviewHtmlOptions): string;
```

`buildCsp` returns exactly (single spaces, `; ` separators): `default-src 'none'; img-src ${cspSource} https: data:; font-src ${cspSource} https: data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource}` + (devOrigin ? ` ${devOrigin}` : ``) + `; connect-src http://127.0.0.1:* http://localhost:* ws://localhost:*; worker-src blob:`.

The HTML: `<meta http-equiv="Content-Security-Policy" content="…">`, optional `<base href>`, optional stylesheet link, one inline `<script nonce>` containing `window.RETUNE_VIEW_MODE = "${viewMode}";` and `const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined; window.vscode = vscode;`, `<body>` with **no class attribute**, `<div id="root"></div>`, and `<script type="module" nonce="…" src="${scriptSrc}">`. No `cdn.tailwindcss.com`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildCsp, renderWebviewHtml } from '../providers/webview-html-template';

const base = { cspSource: 'vscode-webview://x', nonce: 'N0NCE', viewMode: 'sidebar' as const, scriptSrc: 'vscode-webview://x/app.js' };

describe('webview html', () => {
  it('builds the exact CSP', () => {
    expect(buildCsp(base)).toBe(
      "default-src 'none'; img-src vscode-webview://x https: data:; font-src vscode-webview://x https: data:; " +
      "style-src vscode-webview://x 'unsafe-inline'; script-src 'nonce-N0NCE' vscode-webview://x; " +
      'connect-src http://127.0.0.1:* http://localhost:* ws://localhost:*; worker-src blob:'
    );
    expect(buildCsp({ ...base, devOrigin: 'http://localhost:5173' })).toContain("script-src 'nonce-N0NCE' vscode-webview://x http://localhost:5173;");
  });
  it('renders nonce-tagged scripts and no CDN', () => {
    const html = renderWebviewHtml({ ...base, styleHref: 'vscode-webview://x/app.css', baseHref: 'vscode-webview://x/' });
    expect(html).toContain('window.RETUNE_VIEW_MODE = "sidebar"');
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).not.toContain('cdn.tailwindcss.com');
    expect(html).toContain('<body>');
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBe(2);
    for (const s of scripts) expect(s).toContain('nonce="N0NCE"');
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter retune-vscode exec vitest run src/__tests__/webview-html-template.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** the template module; change `buildWebviewHtml` to keep its signature and asset discovery, generate the nonce with `crypto.randomBytes(16).toString('base64')` (`node:crypto`), pass `webview.cspSource`, and pass `devOrigin: http://localhost:${sandboxPort}` + `scriptSrc: ${devOrigin}/src/main.tsx` only when no built JS file is found.
- [ ] **Step 4: Verify.** The test PASSES; `pnpm --filter retune-vscode lint`; `node packages/vscode-extension/scripts/bundle.mjs`; `pnpm --filter retune-vscode test` — all green.
- [ ] **Step 5: Commit** `feat(extension): content security policy with nonce for webviews, drop Tailwind CDN`.

---

### Task 5: Design tokens and offline Tailwind runtime

**Files:**
- Modify: `packages/webview/src/styles.css`
- Modify: `packages/webview/src/main.tsx`
- Modify: `packages/webview/package.json` (via pnpm)
- Create: `packages/webview/src/__tests__/tokens.test.ts`

**Interfaces:**
- Produces: the 20 `--rt-*` tokens and Tailwind names of spec §6 (table is authoritative: token, Tailwind name, VS Code source, fallback), plus `--rt-stage-dark: #09090b` and `--rt-stage-light: #f4f4f5` with utilities `bg-stage-dark` / `bg-stage-light`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles.css'), 'utf8');
const TOKENS: Record<string, string> = {
  canvas: '--vscode-editor-background', panel: '--vscode-sideBar-background', raised: '--vscode-input-background',
  overlay: '--vscode-menu-background', line: '--vscode-panel-border', fg: '--vscode-foreground',
  muted: '--vscode-descriptionForeground', subtle: '--vscode-disabledForeground', accent: '--vscode-button-background',
  'accent-fg': '--vscode-button-foreground', 'accent-hover': '--vscode-button-hoverBackground', focus: '--vscode-focusBorder',
  hover: '--vscode-list-hoverBackground', active: '--vscode-list-activeSelectionBackground',
  'active-fg': '--vscode-list-activeSelectionForeground', danger: '--vscode-errorForeground',
  success: '--vscode-testing-iconPassed', warn: '--vscode-editorWarning-foreground',
};

describe('design tokens', () => {
  it('maps every --rt colour token from its VS Code variable with a fallback and exposes it to Tailwind', () => {
    for (const [name, source] of Object.entries(TOKENS)) {
      expect(css).toMatch(new RegExp(`--rt-${name}:\\s*var\\(${source},\\s*#[0-9a-fA-F]{6}\\)`));
      expect(css).toMatch(new RegExp(`--color-${name}:\\s*var\\(--rt-${name}\\)`));
    }
    expect(css).toMatch(/--rt-font:\s*var\(--vscode-font-family,/);
    expect(css).toMatch(/--rt-mono:\s*var\(--vscode-editor-font-family,/);
    expect(css).toContain('@theme inline');
  });
  it('no longer hardcodes the page colours', () => {
    expect(css).not.toMatch(/background-color:\s*#09090b/);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @retune/webview test` — expected: FAIL.
- [ ] **Step 3: Edit `styles.css`.** Keep `@import "tailwindcss";` and every `@source inline(...)` line. Add a `:root` block with the `--rt-*` tokens, an `@theme inline` block with `--color-<name>: var(--rt-<name>)` for the 18 colours plus `--color-stage-dark`, `--color-stage-light`, `--font-sans: var(--rt-font)`, `--font-mono: var(--rt-mono)`. Set `html, body, #root` to `background-color: var(--rt-canvas); color: var(--rt-fg); font-family: var(--rt-font); font-size: 12px;`. Replace `:root { color-scheme: dark; }` with `:root { color-scheme: dark; } body.vscode-light { color-scheme: light; }`. Scrollbar thumb: `color-mix(in srgb, var(--rt-muted) 35%, transparent)`, hover 55%.
- [ ] **Step 4: Add the runtime.** `pnpm --filter @retune/webview add @tailwindcss/browser@4.3.5`; add `import '@tailwindcss/browser';` as the first import of `main.tsx`. If `tsc` reports no type declarations, add `declare module '@tailwindcss/browser';` to `src/vite-env.d.ts`.
- [ ] **Step 5: Verify.** `pnpm --filter @retune/webview test` PASS; `pnpm --filter @retune/webview build` exits 0 and `packages/webview/dist/assets/*.css` contains `--rt-canvas`.
- [ ] **Step 6: Commit** `feat(webview): host-mapped design tokens and bundled Tailwind runtime` (include `pnpm-lock.yaml`).

---

### Task 6: Webview logic A — host bridge, edit session, shortcuts

**Files:**
- Create: `packages/webview/src/lib/host.ts`, `packages/webview/src/lib/edit-session.ts`, `packages/webview/src/lib/shortcuts.ts`
- Create: `packages/webview/src/__tests__/host.test.ts`, `edit-session.test.ts`, `shortcuts.test.ts`

**Interfaces:**
- Produces:

```ts
// host.ts
export interface HostBridge {
  readonly kind: 'vscode' | 'standalone';
  post(message: WebviewMessage): void;                            // no-op when standalone
  subscribe(listener: (message: HostMessage) => void): () => void; // ignores events whose data is not an object with a string `type`
}
export interface HostWindow {
  vscode?: { postMessage(message: unknown): void };
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}
export function createHost(win: HostWindow): HostBridge;
export function getHost(): HostBridge;   // memoised createHost(window as unknown as HostWindow)

// edit-session.ts
export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 400;
export interface EditSession { past: string[]; present: string; future: string[]; lastChangeAt: number }
export function createSession(classes: string): EditSession;          // lastChangeAt: -Infinity
export function applyChange(s: EditSession, next: string, now: number): EditSession;
export function undo(s: EditSession): EditSession;                    // sets lastChangeAt to -Infinity
export function redo(s: EditSession): EditSession;                    // sets lastChangeAt to -Infinity
export function canUndo(s: EditSession): boolean;
export function canRedo(s: EditSession): boolean;

// shortcuts.ts
export type Shortcut = 'undo' | 'redo' | 'sync';
export function matchShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }, inTextField: boolean): Shortcut | null;
```

`applyChange`: `next === s.present` → return `s` itself. If `now - s.lastChangeAt < COALESCE_MS` replace `present` without pushing; otherwise push the old `present` onto `past` (keep the last `HISTORY_LIMIT`). Always clear `future`, set `lastChangeAt = now`. `matchShortcut`: modifier = ctrl or meta; `s` → `'sync'` always; `z` without shift → `'undo'`, `z` with shift or `y` → `'redo'`, both `null` when `inTextField`; key compared case-insensitively; no modifier → `null`.

- [ ] **Step 1: Write the failing tests**

```ts
// edit-session.test.ts
import { describe, it, expect } from 'vitest';
import { HISTORY_LIMIT, applyChange, canRedo, canUndo, createSession, redo, undo } from '../lib/edit-session';

describe('edit session', () => {
  it('coalesces a burst into one undo step', () => {
    let s = createSession('a');
    s = applyChange(s, 'b', 1000); s = applyChange(s, 'c', 1100); s = applyChange(s, 'd', 1200);
    expect(s.past).toEqual(['a']); expect(s.present).toBe('d');
    s = undo(s); expect(s.present).toBe('a'); expect(s.future).toEqual(['d']); expect(canUndo(s)).toBe(false);
    s = redo(s); expect(s.present).toBe('d'); expect(canRedo(s)).toBe(false);
  });
  it('separates changes that are far apart and clears redo on a new change', () => {
    let s = createSession('a');
    s = applyChange(s, 'b', 1000); s = applyChange(s, 'c', 2000);
    expect(s.past).toEqual(['a', 'b']);
    s = undo(s); s = applyChange(s, 'x', 2050);
    expect(s.past).toEqual(['a', 'b']); expect(s.present).toBe('x'); expect(s.future).toEqual([]);
  });
  it('returns the same object for a no-op and caps history', () => {
    let s = createSession('a');
    expect(applyChange(s, 'a', 5)).toBe(s);
    for (let i = 0; i < 150; i++) s = applyChange(s, `c${i}`, i * 1000);
    expect(s.past.length).toBe(HISTORY_LIMIT);
    expect(undo(createSession('a')).present).toBe('a');
  });
});
```

```ts
// host.test.ts
import { describe, it, expect } from 'vitest';
import { createHost, type HostWindow } from '../lib/host';

function fakeWindow(withVscode: boolean) {
  const sent: unknown[] = []; const listeners = new Set<(e: { data: unknown }) => void>();
  const win: HostWindow = {
    vscode: withVscode ? { postMessage: (m) => { sent.push(m); } } : undefined,
    addEventListener: (_t, l) => { listeners.add(l); },
    removeEventListener: (_t, l) => { listeners.delete(l); },
  };
  return { win, sent, emit: (data: unknown) => listeners.forEach((l) => l({ data })), count: () => listeners.size };
}

describe('host bridge', () => {
  it('posts to VS Code and reports its kind', () => {
    const f = fakeWindow(true); const host = createHost(f.win);
    host.post({ type: 'READY' });
    expect(host.kind).toBe('vscode'); expect(f.sent).toEqual([{ type: 'READY' }]);
  });
  it('is a silent standalone host without the API', () => {
    const f = fakeWindow(false); const host = createHost(f.win);
    expect(host.kind).toBe('standalone'); expect(() => host.post({ type: 'READY' })).not.toThrow();
  });
  it('delivers only well-formed messages and unsubscribes', () => {
    const f = fakeWindow(true); const got: unknown[] = [];
    const off = createHost(f.win).subscribe((m) => got.push(m));
    f.emit(null); f.emit('x'); f.emit({ nope: 1 }); f.emit({ type: 'SYNC_COMPONENT', payload: null });
    expect(got).toEqual([{ type: 'SYNC_COMPONENT', payload: null }]);
    off(); expect(f.count()).toBe(0);
  });
});
```

```ts
// shortcuts.test.ts
import { describe, it, expect } from 'vitest';
import { matchShortcut } from '../lib/shortcuts';
const k = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) =>
  ({ key, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });

describe('matchShortcut', () => {
  it('maps the editing shortcuts', () => {
    expect(matchShortcut(k('s', { ctrlKey: true }), false)).toBe('sync');
    expect(matchShortcut(k('S', { metaKey: true }), true)).toBe('sync');
    expect(matchShortcut(k('z', { ctrlKey: true }), false)).toBe('undo');
    expect(matchShortcut(k('Z', { ctrlKey: true, shiftKey: true }), false)).toBe('redo');
    expect(matchShortcut(k('y', { metaKey: true }), false)).toBe('redo');
  });
  it('leaves undo/redo to text fields and ignores unmodified keys', () => {
    expect(matchShortcut(k('z', { ctrlKey: true }), true)).toBeNull();
    expect(matchShortcut(k('y', { ctrlKey: true }), true)).toBeNull();
    expect(matchShortcut(k('s'), false)).toBeNull();
    expect(matchShortcut(k('a', { ctrlKey: true }), false)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @retune/webview test` — expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the three modules per Interfaces.
- [ ] **Step 4: Run** `pnpm --filter @retune/webview test` and `pnpm --filter @retune/webview lint` — expected: PASS.
- [ ] **Step 5: Commit** `feat(webview): host bridge, undoable edit session and shortcut matching`.

---

### Task 7: Webview logic B — placement, scrubbing, preview tag

**Files:**
- Create: `packages/webview/src/lib/placement.ts`, `packages/webview/src/lib/scrub.ts`, `packages/webview/src/lib/preview.ts`
- Create: `packages/webview/src/__tests__/placement.test.ts`, `scrub.test.ts`, `preview.test.ts`

**Interfaces:**
- Produces:

```ts
// placement.ts
export interface Rect { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }
export interface Placement { left: number; top: number; side: 'below' | 'above'; maxHeight: number }
export function placePopover(anchor: Rect, popover: Size, container: Size,
  opts?: { gap?: number; margin?: number; prefer?: 'below' | 'above' }): Placement;   // gap 8, margin 8, prefer 'below'
export function clampMenu(point: { x: number; y: number }, menu: Size, viewport: Size, margin?: number): { left: number; top: number }; // margin 4

// scrub.ts
export function clamp(value: number, min: number, max: number): number;
export function roundToStep(value: number, step: number): number;
export function scrubValue(start: number, dxPx: number, step: number, min: number, max: number, pxPerStep?: number): number; // pxPerStep 2
export function nudgeValue(value: number, dir: 1 | -1, step: number, min: number, max: number, mods?: { shift?: boolean; alt?: boolean }): number;

// preview.ts
export function previewTag(target?: string, componentName?: string): string;
```

`placePopover`: `spaceBelow = container.height - (anchor.top + anchor.height) - gap - margin`; `spaceAbove = anchor.top - gap - margin`. Use the preferred side if its space ≥ `popover.height`, else the other side if it fits, else the side with more space. `maxHeight = max(80, space of the chosen side)`. `top` below = `anchor.top + anchor.height + gap`; above = `max(margin, anchor.top - gap - min(popover.height, maxHeight))`. `left = clamp(anchor.left + anchor.width / 2 - popover.width / 2, margin, max(margin, container.width - popover.width - margin))`. `clampMenu`: `left = max(margin, min(x, viewport.width - menu.width - margin))`, same for `top`. `roundToStep` rounds to the nearest multiple of `step` and trims float noise to the step's decimal places. `scrubValue` moves `Math.trunc(dxPx / pxPerStep)` steps. `nudgeValue` uses `step × 10` with shift, `step × 0.1` with alt, and rounds to the effective step. `previewTag`: allowed set `button a div span p label li h1 h2 h3 h4 h5 h6 section article nav header footer`; a target in the set is returned as is; otherwise `button` when `/button|btn/i` matches `componentName`; otherwise `div`.

- [ ] **Step 1: Write the failing tests**

```ts
// placement.test.ts
import { describe, it, expect } from 'vitest';
import { clampMenu, placePopover } from '../lib/placement';

describe('placePopover', () => {
  const pop = { width: 280, height: 200 };
  it('centres below the anchor when there is room', () => {
    expect(placePopover({ left: 400, top: 100, width: 100, height: 40 }, pop, { width: 800, height: 600 }))
      .toEqual({ left: 310, top: 148, side: 'below', maxHeight: 444 });
  });
  it('flips above near the bottom edge', () => {
    expect(placePopover({ left: 400, top: 500, width: 100, height: 40 }, pop, { width: 800, height: 600 }))
      .toEqual({ left: 310, top: 292, side: 'above', maxHeight: 484 });
  });
  it('clamps to the margin at the left edge and in a container narrower than the popover', () => {
    expect(placePopover({ left: 0, top: 100, width: 40, height: 20 }, pop, { width: 800, height: 600 }).left).toBe(8);
    expect(placePopover({ left: 100, top: 100, width: 40, height: 20 }, pop, { width: 250, height: 600 }).left).toBe(8);
  });
  it('picks the roomier side and never goes below 80px or above the margin when nothing fits', () => {
    const p = placePopover({ left: 100, top: 60, width: 40, height: 40 }, pop, { width: 800, height: 150 });
    expect(p.side).toBe('above'); expect(p.maxHeight).toBe(80); expect(p.top).toBe(8);
  });
});

describe('clampMenu', () => {
  it('keeps the menu inside the viewport', () => {
    expect(clampMenu({ x: 790, y: 590 }, { width: 224, height: 300 }, { width: 800, height: 600 })).toEqual({ left: 572, top: 296 });
    expect(clampMenu({ x: 10, y: 20 }, { width: 224, height: 300 }, { width: 800, height: 600 })).toEqual({ left: 10, top: 20 });
    expect(clampMenu({ x: 150, y: 150 }, { width: 224, height: 300 }, { width: 200, height: 200 })).toEqual({ left: 4, top: 4 });
  });
});
```

```ts
// scrub.test.ts
import { describe, it, expect } from 'vitest';
import { clamp, nudgeValue, roundToStep, scrubValue } from '../lib/scrub';

describe('scrub maths', () => {
  it('rounds to the step without float noise', () => {
    expect(roundToStep(0.30000000000000004, 0.05)).toBe(0.3);
    expect(roundToStep(7, 4)).toBe(8);
    expect(clamp(70, 0, 64)).toBe(64);
  });
  it('scrubs one step per two pixels within the range', () => {
    expect(scrubValue(16, 10, 1, 0, 64)).toBe(21);
    expect(scrubValue(16, -100, 1, 0, 64)).toBe(0);
    expect(scrubValue(16, 3, 1, 0, 64)).toBe(17);
    expect(scrubValue(0.5, 4, 0.05, 0, 1)).toBe(0.6);
  });
  it('nudges with shift and alt modifiers', () => {
    expect(nudgeValue(16, 1, 1, 0, 64)).toBe(17);
    expect(nudgeValue(16, 1, 1, 0, 64, { shift: true })).toBe(26);
    expect(nudgeValue(60, 1, 1, 0, 64, { shift: true })).toBe(64);
    expect(nudgeValue(16, -1, 1, 0, 64, { alt: true })).toBe(15.9);
  });
});
```

```ts
// preview.test.ts
import { describe, it, expect } from 'vitest';
import { previewTag } from '../lib/preview';

describe('previewTag', () => {
  it('uses safe intrinsic targets and falls back by component name', () => {
    expect(previewTag('span')).toBe('span');
    expect(previewTag('h2', 'Card')).toBe('h2');
    expect(previewTag('Card', 'Card')).toBe('div');
    expect(previewTag(undefined, 'IconButton')).toBe('button');
    expect(previewTag('script')).toBe('div');
    expect(previewTag('input', 'Field')).toBe('div');
    expect(previewTag()).toBe('div');
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @retune/webview test` — expected: FAIL.
- [ ] **Step 3: Implement** the three modules per Interfaces.
- [ ] **Step 4: Run** `pnpm --filter @retune/webview test` and `pnpm --filter @retune/webview lint` — expected: PASS.
- [ ] **Step 5: Commit** `feat(webview): popover placement, scrub maths and preview tag selection`.

---

### Task 8: UI primitives and controls refit

**Files:**
- Create: `packages/webview/src/components/ui/button.tsx`, `segmented.tsx`, `section.tsx`, `row.tsx`, `scrub-input.tsx`, `color-field.tsx`, `index.ts`
- Modify: `packages/webview/src/components/controls.tsx`
- Create: `packages/webview/src/__tests__/ui-primitives.test.tsx`

**Interfaces:**
- Consumes: `clamp`, `roundToStep`, `scrubValue`, `nudgeValue` (Task 7); tokens (Task 5).
- Produces (all re-exported from `ui/index.ts`):

```ts
export const fieldClass: string;   // 'bg-raised border border-line rounded text-fg outline-none transition focus:border-focus'
export function Button(p: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }): JSX.Element; // default secondary, sm
export function IconButton(p: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: LucideIcon; label: string; active?: boolean }): JSX.Element; // aria-label + title = label; aria-pressed only when active !== undefined
export function Segmented(p: { options: { id: string; label: string }[]; active?: string; onPick: (id: string) => void; label?: string }): JSX.Element;
export function Section(p: { title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode }): JSX.Element;
export function Row(p: { label: string; children: React.ReactNode; onScrubStart?: () => void; onScrub?: (dxPx: number) => void }): JSX.Element;
export function ScrubInput(p: { value: string | undefined; min: number; max: number; step?: number; unit?: string; onChange: (v: string) => void; onClear: () => void }): JSX.Element;
export function ColorField(p: { value: string | undefined; onChange: (v: string) => void; onClear: () => void }): JSX.Element;
```

- `controls.tsx` keeps exporting the preset arrays, `BG_PRESETS`, `BG_TOKENS`, `createClassEditor`, and re-exports `Row`, `Segmented`, `Section`, `ColorField` from `./ui`; `field` becomes an alias of `fieldClass`; `Slider` becomes an alias of `ScrubInput`. `createClassEditor` keeps every existing member and gains `lenRow(label: string, prefix: string, conflicts: string[], min: number, max: number, step?: number): JSX.Element`, rendered by a new exported component `LengthRow` (a `Row` whose label scrubs: `onScrubStart` stores the current numeric value or `min` in a ref, `onScrub(dx)` calls `set` with `scrubValue(...)` + `px`). Existing callers of `controls.tsx` must compile unchanged.

Behaviour:
- `Segmented`: container `role="radiogroup"` (`aria-label` = `label` when given); each option `role="radio"`, `aria-checked`, `tabIndex` 0 for the active (or first when none) and −1 otherwise; `ArrowRight`/`ArrowDown` picks the next option, `ArrowLeft`/`ArrowUp` the previous, wrapping.
- `Section`: header button with `aria-expanded`; lucide `ChevronDown` when open, `ChevronRight` when closed; `count` rendered after the title in `text-subtle`.
- `Row`: label is `cursor-ew-resize` and handles pointer down/move/up with pointer capture only when `onScrub` is given.
- `ScrubInput`: range input + number input + `IconButton` (`RotateCcw`, label `Reset`). Number input: `ArrowUp`/`ArrowDown` call `onChange` with `nudgeValue(...)` + unit (prevent default), honouring `shiftKey`/`altKey`; typed values are clamped to `[min, max]`. When `value` is undefined the number shows placeholder `–` and the range gets `opacity-40`.
- `ColorField`: colour swatch input + text input + reset `IconButton`, same props as today.

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Undo2 } from 'lucide-react';
import { Button, IconButton, Row, ScrubInput, Section, Segmented } from '../components/ui';
import { createClassEditor } from '../components/controls';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const OLD_PALETTE = /zinc-|indigo-|rose-|emerald-|amber-|#[0-9a-f]{6}/i;

describe('ui primitives', () => {
  it('renders an accessible segmented control', () => {
    const out = html(<Segmented label="Viewport" active="b" onPick={() => {}} options={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} />);
    expect(out).toContain('role="radiogroup"'); expect(out).toContain('aria-label="Viewport"');
    expect(out).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>B</);
    expect(out.match(/tabindex="0"/g)?.length).toBe(1);
  });
  it('labels icon buttons and exposes pressed state only when given', () => {
    expect(html(<IconButton icon={Undo2} label="Undo" />)).toMatch(/aria-label="Undo"[^>]*title="Undo"|title="Undo"[^>]*aria-label="Undo"/);
    expect(html(<IconButton icon={Undo2} label="Undo" />)).not.toContain('aria-pressed');
    expect(html(<IconButton icon={Undo2} label="Grid" active />)).toContain('aria-pressed="true"');
  });
  it('exposes section state and hides closed content', () => {
    expect(html(<Section title="Layout" count={3}>body</Section>)).toMatch(/aria-expanded="true"/);
    const closed = html(<Section title="Layout" defaultOpen={false}>body</Section>);
    expect(closed).toContain('aria-expanded="false"'); expect(closed).not.toContain('body');
  });
  it('shows an unset numeric control as a dash and a set one as its number', () => {
    expect(html(<ScrubInput value={undefined} min={0} max={64} onChange={() => {}} onClear={() => {}} />)).toContain('placeholder="–"');
    expect(html(<ScrubInput value="14px" min={0} max={64} onChange={() => {}} onClear={() => {}} />)).toContain('value="14"');
  });
  it('uses only token colours', () => {
    const ed = createClassEditor('px-[14px] bg-indigo-600', () => {});
    const out = html(<div><Button variant="primary">Sync</Button><Row label="x">y</Row>{ed.lenRow('pad X', 'px', [], 0, 64)}{ed.col('bg')}{ed.weight}</div>);
    expect(out.replace(/value="[^"]*"/g, '')).not.toMatch(OLD_PALETTE);
    expect(out).toContain('pad X'); expect(out).toContain('value="14"');
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @retune/webview test` — expected: FAIL.
- [ ] **Step 3: Implement** the primitives and refit `controls.tsx` (its own JSX — swatches included — must use token utilities; swatch colours stay as inline `style`, which is why the palette regex test renders only `lenRow`, `col` and `weight`).
- [ ] **Step 4: Verify.** `pnpm --filter @retune/webview test` PASS; `pnpm --filter @retune/webview lint` exit 0 (sidebar and viewport-frame still compile untouched).
- [ ] **Step 5: Commit** `feat(webview): accessible token-based UI primitives with scrubbable numeric rows`.

---

### Task 9: Overlay primitives and shared feature components

**Files:**
- Create: `packages/webview/src/components/ui/popover.tsx`, `toast.tsx`, `empty-state.tsx` (export from `ui/index.ts`)
- Create: `packages/webview/src/components/shared/viewports.ts`, `variant-picker.tsx`, `class-chips.tsx`, `viewport-switch.tsx`, `element-list.tsx`
- Create: `packages/webview/src/__tests__/shared-components.test.tsx`

**Interfaces:**
- Consumes: Task 7 `placePopover`, `Rect`, `Size`; Task 8 primitives; `addClasses`, `removeClass`, `splitClasses` from `lib/arbitrary-style`.
- Produces:

```ts
// ui/toast.tsx
export type ToastTone = 'success' | 'error' | 'info';
export interface ToastState { message: string; tone: ToastTone }
export function Toast(p: { toast: ToastState | null }): JSX.Element;     // always renders the role="status" aria-live="polite" region; empty when null
// ui/popover.tsx
export const POPOVER_WIDTH = 280;
export function Popover(p: { anchor: Rect | null; container: Size; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }): JSX.Element | null; // null when anchor is null
// ui/empty-state.tsx
export function EmptyState(p: { title: string; hint: string }): JSX.Element;
// shared/viewports.ts
export const VIEWPORTS: { id: ViewportPreset; label: string; widthClass: string }[];
//  responsive/Fluid/'w-full max-w-3xl', mobile/375/'w-[375px]', tablet/768/'w-[768px]', desktop/1024/'w-[1024px]'
// shared/*.tsx
export function ViewportSwitch(p: { value: ViewportPreset; onChange: (v: ViewportPreset) => void }): JSX.Element;
export function VariantPicker(p: { cva: CvaMetadata; selected: Record<string, string>; onSelect: (group: string, value: string) => void; onSetDefault: (group: string, value: string) => void }): JSX.Element;
export function ClassChips(p: { classes: string; onChange: (next: string) => void; placeholder?: string; autoFocus?: boolean }): JSX.Element;
export interface ElementRef { name: string; index: number }
export function ElementList(p: { elements: ElementInfo[]; rootLabel: string; target: { name?: string; index?: number }; onSelect: (ref: ElementRef | null) => void }): JSX.Element;
```

Behaviour:
- `Popover`: `role="dialog"` with `aria-label={title}`, absolutely positioned at `placePopover(anchor, { width: POPOVER_WIDTH, height: measured }, container)`; measure its own `offsetHeight` in `useLayoutEffect` (initial estimate 240); body `overflow-y-auto` with `maxHeight` = placement `maxHeight` minus 40; header shows `title`, optional `subtitle` in `font-mono text-accent`, and a close `IconButton` (`X`, label `Close`). Clicks inside stop propagation.
- `Toast`: bottom-centre, tone colours `text-success` / `text-danger` / `text-fg` on `bg-overlay border-line`.
- `VariantPicker`: per group, the group name in `font-mono`, a `set default` text button with `title="Write as defaultVariant in the file"`, and option chips as `aria-pressed` buttons; current = `selected[group] ?? cva.defaultVariants[group] ?? options[0]`.
- `ClassChips`: chips with a remove button `aria-label={`Remove ${token}`}`; text input adds on `Enter` via `addClasses` and clears; default placeholder `Add classes · Enter`.
- `ElementList`: `role="listbox"`; first row is the root (`rootLabel`, selected when `target.name` is undefined); then one row per element showing `` `<${name}>` ``, `` `L${line}` `` and the class count; `index` = position among elements with the same name; selected row has `aria-selected="true"` and `bg-active text-active-fg`; container `max-h-40 overflow-y-auto`.

- [ ] **Step 1: Write the failing test**

```tsx
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
```

Each `ElementList` row must be a single element with `role="option"`; give the root row and element rows `data-row="root"` / `data-row="element"`. If either of the two regex assertions on `aria-selected` proves brittle against your markup, replace it with an equivalent assertion that the **only** `aria-selected="true"` row is the one containing `L5` (first case) or `root` (second case) — do not weaken what is asserted.

- [ ] **Step 2: Run** `pnpm --filter @retune/webview test` — expected: FAIL.
- [ ] **Step 3: Implement** per Interfaces and Behaviour.
- [ ] **Step 4: Verify.** `pnpm --filter @retune/webview test` PASS; `pnpm --filter @retune/webview lint` exit 0; `git grep -nE "zinc-|indigo-|rose-|emerald-|amber-|#[0-9a-fA-F]{6}" -- packages/webview/src/components/ui packages/webview/src/components/shared` prints at most the `#000000` colour-input fallback in `ui/color-field.tsx`.
- [ ] **Step 5: Commit** `feat(webview): popover, toast, empty state and shared variant/class/viewport/element components`.

---

### Task 10: Stage reducer and demo data

**Files:**
- Create: `packages/webview/src/state/demo.ts` (move `DEFAULT_CONFIG`, `DEFAULT_STAGE_STATE`, `DEMO_SOURCE`, `DEMO_META` out of `App.tsx`; `App.tsx` imports them)
- Create: `packages/webview/src/state/stage-reducer.ts`
- Create: `packages/webview/src/__tests__/stage-reducer.test.ts`
- Modify: `packages/webview/src/App.tsx` (imports only)

**Interfaces:**
- Consumes: Task 6 `EditSession`, `createSession`, `applyChange`, `undo`, `redo`.
- Produces:

```ts
// demo.ts
export const DEFAULT_CONFIG: RetuneExtensionConfig;
export const DEFAULT_STAGE_STATE: StageState;   // baselineClass === harmonicsClass
export const DEMO_META: ComponentMetadata;      // now with elements: [{ name: 'button', start: 0, end: 0, line: 36, column: 4, className: <same base string> }]
export const EMPTY_STAGE_STATE: StageState;     // selectedVariants {}, propValues {}, harmonicsClass '', baselineClass '', viewport 'responsive', showGrid true, activeTab 'stage'

// stage-reducer.ts
export interface StageModel { meta: ComponentMetadata | null; stage: StageState; config: RetuneExtensionConfig; session: EditSession }
export type StageAction =
  | { type: 'host'; message: HostMessage; now: number }
  | { type: 'setClasses'; classes: string; now: number }
  | { type: 'undo' } | { type: 'redo' }
  | { type: 'patchStage'; patch: Partial<StageState> }
  | { type: 'patchConfig'; patch: Partial<RetuneExtensionConfig> }
  | { type: 'markSynced' };
export function initialModel(kind: 'vscode' | 'standalone'): StageModel;   // standalone: DEMO_META + DEFAULT_STAGE_STATE; vscode: meta null + EMPTY_STAGE_STATE
export function reduce(model: StageModel, action: StageAction): StageModel;
export function isDirty(model: StageModel): boolean;                        // stage.harmonicsClass !== stage.baselineClass
export function computePreviewClass(model: StageModel, classes?: string): string;   // classes defaults to stage.harmonicsClass; appends variantClasses of each selected variant; trimmed
export function targetLabel(model: StageModel): string;
export function sameTarget(a: StageState, b: StageState): boolean;          // targetElement and (targetIndex ?? 0) equal
```

Rules:
- `host` + `SYNC_COMPONENT`: set `meta` only. If the file path changed (or meta became null/non-null) reset `session` to `createSession(stage.harmonicsClass)`.
- `host` + `SYNC_STAGE_STATE`: replace `stage`. If `!sameTarget(old, new)` → `session = createSession(new.harmonicsClass)`; else `session = applyChange(session, new.harmonicsClass, now)`.
- `host` + `SYNC_CONFIG`: replace `config`. Other host messages: return the model unchanged.
- `setClasses`: `session = applyChange(...)`, `stage.harmonicsClass = classes`. `undo`/`redo`: move the session and copy `session.present` into `stage.harmonicsClass`.
- `markSynced`: `stage.baselineClass = stage.harmonicsClass`.
- `targetLabel`: `` `<${targetElement}>` `` when a target is set; else `meta.cva.cvaIdentifier` when `hasCva` and defined; else `` `<${meta.elements[0].name}>` `` when present; else `meta.componentName`; `'Component'` when meta is null.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { computePreviewClass, initialModel, isDirty, reduce, targetLabel } from '../state/stage-reducer';
import { DEMO_META } from '../state/demo';

const base = () => initialModel('standalone');

describe('stage reducer', () => {
  it('starts empty in VS Code and with the demo standalone', () => {
    expect(initialModel('vscode').meta).toBeNull();
    expect(base().meta?.componentName).toBe('Button');
    expect(isDirty(base())).toBe(false);
  });
  it('SYNC_COMPONENT never touches the working classes', () => {
    let m = reduce(base(), { type: 'setClasses', classes: 'edited', now: 1000 });
    m = reduce(m, { type: 'host', now: 2000, message: { type: 'SYNC_COMPONENT', payload: { ...DEMO_META, rawSource: 'changed' } } });
    expect(m.stage.harmonicsClass).toBe('edited'); expect(m.meta?.rawSource).toBe('changed'); expect(m.session.past.length).toBe(1);
  });
  it('tracks dirty state, undo and redo', () => {
    let m = reduce(base(), { type: 'setClasses', classes: 'x', now: 1000 });
    expect(isDirty(m)).toBe(true);
    m = reduce(m, { type: 'undo' }); expect(isDirty(m)).toBe(false);
    m = reduce(m, { type: 'redo' }); expect(m.stage.harmonicsClass).toBe('x');
    m = reduce(m, { type: 'markSynced' }); expect(isDirty(m)).toBe(false);
  });
  it('records host class changes on the same target and resets history on a new target', () => {
    const m0 = base();
    let m = reduce(m0, { type: 'host', now: 5000, message: { type: 'SYNC_STAGE_STATE', payload: { ...m0.stage, harmonicsClass: 'from-sidebar' } } });
    expect(m.session.past).toEqual([m0.stage.harmonicsClass]);
    m = reduce(m, { type: 'host', now: 9000, message: { type: 'SYNC_STAGE_STATE', payload: { ...m.stage, targetElement: 'span', targetIndex: 0, harmonicsClass: 's', baselineClass: 's' } } });
    expect(m.session.past).toEqual([]); expect(m.session.present).toBe('s');
  });
  it('computes preview classes and labels', () => {
    const m = base();
    expect(computePreviewClass(m)).toContain('bg-indigo-600');
    expect(computePreviewClass(m, 'only')).toMatch(/^only /);
    expect(targetLabel(m)).toBe('buttonVariants');
    expect(targetLabel({ ...m, stage: { ...m.stage, targetElement: 'span' } })).toBe('<span>');
    expect(targetLabel(initialModel('vscode'))).toBe('Component');
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @retune/webview test` — expected: FAIL.
- [ ] **Step 3: Implement** `demo.ts` (moved constants, plus `elements` and `EMPTY_STAGE_STATE`) and `stage-reducer.ts`; update `App.tsx` imports so it still compiles.
- [ ] **Step 4: Verify.** `pnpm --filter @retune/webview test` PASS; `pnpm --filter @retune/webview lint` exit 0.
- [ ] **Step 5: Commit** `feat(webview): pure stage reducer with dirty tracking and history, demo data module`.

---

### Task 11: `useStage` store and App shell

**Files:**
- Create: `packages/webview/src/state/use-stage.ts`, `packages/webview/src/hooks/use-is-dark.ts`
- Rewrite: `packages/webview/src/App.tsx`
- Create: `packages/webview/src/components/stage-header.tsx` (must not import `App.tsx` or Scalar)
- Modify: `packages/webview/src/components/sidebar/sidebar-view.tsx` and `packages/webview/src/components/stage/viewport-frame.tsx` only as far as needed to compile against the new call sites (their rewrites are Tasks 12–13)
- Delete: `packages/webview/src/hooks/use-theme-sync.ts`, `packages/webview/src/hooks/use-vscode-bridge.ts`
- Create: `packages/webview/src/__tests__/app-shell.test.tsx`

**Interfaces:**
- Consumes: Task 6 `getHost`, `matchShortcut`; Task 9 `Toast`, `ToastState`, `ToastTone`, `EmptyState`, `ViewportSwitch`, `ElementRef`; Task 10 reducer API; Task 8 `Button`, `IconButton`, `Segmented`.
- Produces:

```ts
// use-stage.ts
export interface StageStore {
  hostKind: 'vscode' | 'standalone';
  meta: ComponentMetadata | null; config: RetuneExtensionConfig; stage: StageState;
  dirty: boolean; canUndo: boolean; canRedo: boolean; toast: ToastState | null;
  targetLabel: string; previewClass: string; baselinePreviewClass: string;
  setClasses(next: string): void; undo(): void; redo(): void; discard(): void; sync(): void;
  selectVariant(group: string, value: string): void; commitVariant(group: string, value: string): void;
  setProp(name: string, value: string | boolean | number): void;
  patchStage(patch: Partial<StageState>): void; patchConfig(patch: Partial<RetuneExtensionConfig>): void;
  selectElement(ref: ElementRef | null): void;
  openStage(openMode?: StageOpenMode, tab?: StageTabId): void;
  notify(message: string, tone?: ToastTone): void;
}
export function useStage(): StageStore;
// components/stage-header.tsx
export function StageHeader(p: { store: StageStore; tone: 'dark' | 'light'; onToggleTone: () => void; onCompare: (on: boolean) => void }): JSX.Element;
// App.tsx
export function App(): JSX.Element;
// use-is-dark.ts
export function useIsDark(): boolean;   // false when document.body has class 'vscode-light'; observes class changes
```

Behaviour of `useStage`:
- `useReducer(reduce, getHost().kind, initialModel)`. On mount: subscribe to the host, dispatch `{ type: 'host', message, now: Date.now() }`, then `post({ type: 'READY' })`; unsubscribe on unmount. A `MUTATION_RESULT` also calls `notify(payload.message, payload.ok ? 'success' : 'error')`.
- Every host post happens in the event handler, never inside a state updater.
- `setClasses(next)` → dispatch `setClasses`, post `UPDATE_STAGE_STATE { harmonicsClass: next }`. `undo`/`redo` → dispatch, then post `UPDATE_STAGE_STATE` with the resulting class (compute it from the session before dispatching). `discard` → `setClasses(stage.baselineClass)`.
- `sync` → `vscode`: post `MUTATE_CLASSES { className: stage.harmonicsClass }`. `standalone`: dispatch `markSynced`, `notify('Synced (demo)', 'success')`, and best-effort `fetch` `POST http://127.0.0.1:${config.daemonPort}/v1/components/mutate` as today, ignoring failures.
- `selectVariant` → `patchStage({ selectedVariants: {...} })`. `commitVariant` → select, then post `MUTATE_VARIANT`. `setProp` → dispatch `patchStage` with merged `propValues` and post `UPDATE_PROP_VALUE`. `patchStage` → dispatch + post `UPDATE_STAGE_STATE`. `patchConfig` → dispatch + post `UPDATE_CONFIG`. `selectElement` → post `SELECT_ELEMENT`; when standalone also `patchStage({ targetElement: ref?.name, targetIndex: ref?.index })`. `openStage` → optional `patchStage({ activeTab })`, post `OPEN_STAGE_TAB`.
- `notify` sets the toast and clears it after 1500 ms (`success`/`info`) or 4000 ms (`error`); a new toast cancels the previous timer.
- `baselinePreviewClass = computePreviewClass(model, stage.baselineClass)`.

Behaviour of `App`:
- One `window` `keydown` listener using `matchShortcut(e, target is input/textarea/contentEditable)`; on a match `preventDefault()` and call `sync`/`undo`/`redo`.
- `window.RETUNE_VIEW_MODE === 'sidebar'` (or `?mode=sidebar`) → `<SidebarView …/>` plus `<Toast>`.
- Otherwise the shell: optional embedded sidebar (`aside`, 288px) only when `hostKind === 'standalone'`; `<StageHeader>`; main area by `stage.activeTab` — `stage`: `<EmptyState title="No component selected" hint="Open a .tsx or .jsx file to start tuning." />` when `meta` is null, else the existing `ViewportFrame` fed from the store (preview class = `baselinePreviewClass` while Compare is held); `ast`: the two-pane code view using token classes; `api`: Scalar with `darkMode={useIsDark()}`; `<Toast toast={store.toast} />`.
- `StageHeader` (36px, `bg-panel border-b border-line`), left to right: `Segmented` tabs `Stage | Code | API` (ids `stage`, `ast`, `api`, label `View`); target label in `font-mono` plus a `bg-warn` dot with `aria-label="Unsynced changes"` when dirty; spacer; `IconButton` Undo (`Undo2`, disabled when `!canUndo`), Redo (`Redo2`); `Button` `Compare` (ghost; `onPointerDown` → `onCompare(true)`, `onPointerUp`/`onPointerLeave` → `onCompare(false)`; disabled when clean); `Button` `Discard` (ghost, disabled when clean); `Button` `Sync` (primary, `title="Sync to code (Ctrl+S)"`, disabled when clean); `ViewportSwitch`; `IconButton` Grid (`Grid3x3`, `active={stage.showGrid}`); `IconButton` canvas tone (`Sun` when light / `Moon` when dark, label `Canvas tone`). Undo…Sync and the viewport/grid/tone controls render only on the `stage` tab.

- [ ] **Step 1: Write the failing test** (`StageHeader` is pure given a store object)

```tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StageHeader } from '../components/stage-header';
import type { StageStore } from '../state/use-stage';
import { DEFAULT_CONFIG, DEFAULT_STAGE_STATE, DEMO_META } from '../state/demo';

const noop = () => {};
const store = (over: Partial<StageStore> = {}): StageStore => ({
  hostKind: 'standalone', meta: DEMO_META, config: DEFAULT_CONFIG, stage: DEFAULT_STAGE_STATE,
  dirty: false, canUndo: false, canRedo: false, toast: null, targetLabel: 'buttonVariants', previewClass: '', baselinePreviewClass: '',
  setClasses: noop, undo: noop, redo: noop, discard: noop, sync: noop, selectVariant: noop, commitVariant: noop, setProp: noop,
  patchStage: noop, patchConfig: noop, selectElement: noop, openStage: noop, notify: noop, ...over,
});
const render = (s: StageStore) => renderToStaticMarkup(<StageHeader store={s} tone="dark" onToggleTone={noop} onCompare={noop} />);

describe('StageHeader', () => {
  it('has exactly one Sync, disabled while clean', () => {
    const out = render(store());
    expect(out.match(/>Sync</g)?.length).toBe(1);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*title="Sync to code \(Ctrl\+S\)"|<button[^>]*title="Sync to code \(Ctrl\+S\)"[^>]*disabled=""/);
    expect(out).not.toContain('Unsynced changes');
    expect(out).toContain('buttonVariants');
  });
  it('enables the actions and shows the dirty dot when dirty', () => {
    const out = render(store({ dirty: true, canUndo: true }));
    expect(out).toContain('aria-label="Unsynced changes"');
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*title="Sync to code/);
    expect(out).toMatch(/aria-label="Undo"/); expect(out).toMatch(/aria-label="Redo"[^>]*disabled=""|disabled=""[^>]*aria-label="Redo"/);
  });
  it('offers the three views and hides edit actions off the stage tab', () => {
    expect(render(store())).toMatch(/aria-checked="true"[^>]*>Stage</);
    const out = render(store({ stage: { ...DEFAULT_STAGE_STATE, activeTab: 'ast' } }));
    expect(out).toMatch(/aria-checked="true"[^>]*>Code</); expect(out).not.toContain('>Sync<'); expect(out).not.toContain('aria-label="Undo"');
  });
  it('uses only token colours', () => {
    expect(render(store({ dirty: true }))).not.toMatch(/zinc-|indigo-|rose-|emerald-|amber-|#[0-9a-f]{6}/i);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @retune/webview test` — expected: FAIL.
- [ ] **Step 3: Implement** `use-is-dark.ts`, `use-stage.ts`, and rewrite `App.tsx` (keep the Scalar imports; drop the `declare const vscode`, `isDark` state and all inline handler logic). Adapt the props passed to the existing `SidebarView`/`ViewportFrame` from the store so both still compile; delete the two dead hooks.
- [ ] **Step 4: Verify.** `pnpm --filter @retune/webview test` PASS; `pnpm --filter @retune/webview build` exits 0; `git grep -n "declare const vscode" -- packages/webview/src` prints nothing.
- [ ] **Step 5: Commit** `feat(webview): store-driven app shell with single sync, undo/redo, shortcuts and empty state`.

---

### Task 12: Stage — canvas, selection toolbar, edit popover, context menu

**Files:**
- Create: `packages/webview/src/components/stage/stage.tsx`, `selection-toolbar.tsx`, `edit-panels.tsx`, `context-menu.tsx`
- Delete: `packages/webview/src/components/stage/viewport-frame.tsx`
- Modify: `packages/webview/src/App.tsx` (render `<Stage>` instead of `<ViewportFrame>`)
- Create: `packages/webview/src/__tests__/stage.test.tsx`

**Interfaces:**
- Consumes: `StageStore` (Task 11); `Popover`, `IconButton`, `Button`, `Row`, `Segmented` (Tasks 8–9); `VariantPicker`, `ClassChips`, `VIEWPORTS` (Task 9); `createClassEditor` + presets (Task 8); `placePopover`, `clampMenu`, `Rect`, `Size` (Task 7); `previewTag` (Task 7); `parseArbitraryStyle` (`lib/arbitrary-style`).
- Produces:

```ts
// edit-panels.tsx
export type PanelKind = 'text' | 'fill' | 'type' | 'spacing' | 'shape' | 'variants' | 'classes';
export const PANELS: { kind: PanelKind; label: string; title: string }[];
//  text/Text/'Text', fill/Fill/'Fill & Border', type/Type/'Typography', spacing/Space/'Spacing & Size', shape/Shape/'Shape & Effects', variants/Variants/'Variants', classes/Classes/'Classes'
export function availablePanels(hasVariants: boolean): typeof PANELS;      // drops 'variants' when false
export function EditPanel(p: { kind: PanelKind; store: StageStore; onDone: () => void }): JSX.Element;
// selection-toolbar.tsx
export function SelectionToolbar(p: { panels: typeof PANELS; style: React.CSSProperties; onOpen: (kind: PanelKind) => void }): JSX.Element;   // role="toolbar" aria-label="Edit element"
// context-menu.tsx
export interface MenuEntry { id: string; label: string; hint?: string; danger?: boolean; disabled?: boolean; separatorBefore?: boolean; run: () => void }
export function buildMenu(a: { store: StageStore; panels: typeof PANELS; disabled: boolean; hasVariants: boolean; jsx: string; openPanel: (k: PanelKind) => void }): MenuEntry[];
export function ContextMenu(p: { entries: MenuEntry[]; point: { x: number; y: number }; title: string; onClose: () => void }): JSX.Element;
// stage.tsx
export function Stage(p: { store: StageStore; tone: 'dark' | 'light'; comparing: boolean }): JSX.Element;
```

Behaviour (spec §5 "Canvas", "Selection toolbar", "Edit popover", "Context menu" are authoritative):
- `EditPanel` bodies reuse the same controls as today's modal, built from `createClassEditor(store.stage.harmonicsClass, store.setClasses)` with `lenRow` for every numeric row: `text` (label input, autofocus, `Enter` → `onDone`; disabled toggle via `Segmented`), `fill` (fill colour, swatches, border width, stroke colour, opacity), `type` (size, weight, letter spacing, colour), `spacing` (pad X, pad Y, gap, width, height — same prefixes/ranges as today), `shape` (radius, radius presets, shadow presets), `variants` (`VariantPicker`, or `No cva() variants in this component.`), `classes` (`ClassChips` with `autoFocus`).
- `buildMenu` entry ids in order: one `panel:<kind>` per available panel (labels `Edit text…`, `Fill & border…`, `Typography…`, `Spacing & size…`, `Shape & effects…`, `Variants…`, `Edit classes…`); `toggle-disabled` (`Disable`/`Enable`, separator before); `sync` (`Sync to code`, hint `Ctrl+S`, disabled when `!store.dirty`); `undo` (hint `Ctrl+Z`, disabled when `!canUndo`); `redo` (hint `Ctrl+Shift+Z`, disabled when `!canRedo`); `copy-class` (`Copy className`, separator before); `copy-jsx` (`Copy JSX`); `reset-variants` (only when `hasVariants`; sets `selectedVariants` to the cva defaults); `discard` (`Discard changes`, danger, disabled when clean); `inspect` (`Inspect code`, separator before; `patchStage({ activeTab: 'ast' })`). Copy entries write to `navigator.clipboard` and call `store.notify('Copied className' | 'Copied JSX', 'info')`.
- `ContextMenu`: `role="menu"`, `position: fixed` at `clampMenu(point, measured size, window size)`; entries are `role="menuitem"` buttons (`aria-disabled` + no-op when disabled); first enabled entry focused on mount; `ArrowDown`/`ArrowUp` move focus over enabled entries (wrapping), `Enter` runs, `Escape` calls `onClose`; running an entry closes the menu.
- `Stage`: container `ref` measured for `Size`; backdrop `bg-stage-dark`/`bg-stage-light` by `tone`, dot grid when `store.stage.showGrid`; frame width from `VIEWPORTS`; preview element tag = `previewTag(store.stage.targetElement, store.meta?.componentName)`, classes = `comparing ? store.baselinePreviewClass : store.previewClass`, inline style from `parseArbitraryStyle` of the same string, `pointer-events: none`; wrapper handles hover/selected outlines (`outline-accent/50` 1px on hover, `outline-accent` 2px when selected), click → select, double-click → `text` panel, context menu → select + open menu. When selected: tag chip above (`` `<${tag}>` ``), `W × H` badge below (rounded integers from the measured rect), `SelectionToolbar` positioned with `placePopover(anchorRect, toolbarSize, containerSize, { prefer: 'above' })`, hidden while a panel is open. Open panel → `Popover` (title from `PANELS`, subtitle = `store.targetLabel`). `Escape`: menu → panel → selection. Caption under the frame: `Approximate preview — classes only` (`text-subtle text-[11px]`). No Sync button anywhere in this folder.

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PANELS, availablePanels, EditPanel } from '../components/stage/edit-panels';
import { SelectionToolbar } from '../components/stage/selection-toolbar';
import { buildMenu, ContextMenu } from '../components/stage/context-menu';
import { Stage } from '../components/stage/stage';
import type { StageStore } from '../state/use-stage';
import { DEFAULT_CONFIG, DEFAULT_STAGE_STATE, DEMO_META } from '../state/demo';

const noop = () => {};
const store = (over: Partial<StageStore> = {}): StageStore => ({
  hostKind: 'standalone', meta: DEMO_META, config: DEFAULT_CONFIG, stage: DEFAULT_STAGE_STATE,
  dirty: false, canUndo: false, canRedo: false, toast: null, targetLabel: 'buttonVariants',
  previewClass: 'px-4 current', baselinePreviewClass: 'px-2 baseline',
  setClasses: noop, undo: noop, redo: noop, discard: noop, sync: noop, selectVariant: noop, commitVariant: noop, setProp: noop,
  patchStage: noop, patchConfig: noop, selectElement: noop, openStage: noop, notify: noop, ...over,
});
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('stage pieces', () => {
  it('offers the variants panel only when there are variants', () => {
    expect(PANELS.map((p) => p.label)).toEqual(['Text', 'Fill', 'Type', 'Space', 'Shape', 'Variants', 'Classes']);
    expect(availablePanels(false).map((p) => p.kind)).not.toContain('variants');
  });
  it('renders a labelled toolbar without a sync button', () => {
    const out = html(<SelectionToolbar panels={availablePanels(true)} style={{}} onOpen={noop} />);
    expect(out).toContain('role="toolbar"'); expect(out).toContain('aria-label="Edit element"');
    expect(out).toContain('>Variants<'); expect(out).not.toMatch(/>Sync/);
  });
  it('renders each panel body', () => {
    expect(html(<EditPanel kind="spacing" store={store()} onDone={noop} />)).toContain('pad X');
    expect(html(<EditPanel kind="classes" store={store()} onDone={noop} />)).toContain('aria-label="Remove gap-2"');
    expect(html(<EditPanel kind="variants" store={store({ meta: { ...DEMO_META, cva: { ...DEMO_META.cva, hasCva: false, variants: {} } } })} onDone={noop} />))
      .toContain('No cva() variants in this component.');
  });
  it('builds the menu in order with correct enabled state', () => {
    const sync = vi.fn();
    const args = { panels: availablePanels(true), disabled: false, hasVariants: true, jsx: '<button/>', openPanel: noop };
    const clean = buildMenu({ ...args, store: store({ sync }) });
    expect(clean.map((e) => e.id)).toEqual([
      'panel:text', 'panel:fill', 'panel:type', 'panel:spacing', 'panel:shape', 'panel:variants', 'panel:classes',
      'toggle-disabled', 'sync', 'undo', 'redo', 'copy-class', 'copy-jsx', 'reset-variants', 'discard', 'inspect',
    ]);
    expect(clean.find((e) => e.id === 'sync')?.disabled).toBe(true);
    expect(clean.find((e) => e.id === 'discard')).toMatchObject({ danger: true, disabled: true });
    const dirty = buildMenu({ ...args, hasVariants: false, store: store({ sync, dirty: true, canUndo: true }) });
    expect(dirty.map((e) => e.id)).not.toContain('reset-variants');
    dirty.find((e) => e.id === 'sync')!.run(); expect(sync).toHaveBeenCalledTimes(1);
    expect(dirty.find((e) => e.id === 'undo')?.disabled).toBeFalsy();
    expect(buildMenu({ ...args, disabled: true, store: store() }).find((e) => e.id === 'toggle-disabled')?.label).toBe('Enable');
  });
  it('renders an accessible menu', () => {
    const out = html(<ContextMenu title="<button>" point={{ x: 10, y: 10 }} onClose={noop}
      entries={[{ id: 'a', label: 'Alpha', run: noop }, { id: 'b', label: 'Beta', disabled: true, hint: 'Ctrl+S', run: noop }]} />);
    expect(out).toContain('role="menu"'); expect(out.match(/role="menuitem"/g)?.length).toBe(2);
    expect(out).toMatch(/aria-disabled="true"[^>]*>(<[^>]+>)*Beta/); expect(out).toContain('Ctrl+S');
  });
  it('renders the preview with current or baseline classes and the caption', () => {
    const live = html(<Stage store={store()} tone="dark" comparing={false} />);
    expect(live).toContain('px-4 current'); expect(live).toContain('Approximate preview — classes only');
    expect(live).not.toMatch(/>Sync/);
    expect(html(<Stage store={store()} tone="light" comparing />)).toContain('px-2 baseline');
    expect(html(<Stage store={store({ stage: { ...DEFAULT_STAGE_STATE, targetElement: 'span' } })} tone="dark" comparing={false} />)).toMatch(/<span[^>]*px-4 current/);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @retune/webview test` — expected: FAIL.
- [ ] **Step 3: Implement** the four files; switch `App.tsx` to `<Stage store={store} tone={tone} comparing={comparing} />`; delete `viewport-frame.tsx`.
- [ ] **Step 4: Verify.** `pnpm --filter @retune/webview test` PASS; `pnpm --filter @retune/webview build` exits 0; `git grep -nE "zinc-|indigo-|rose-|emerald-|amber-|#[0-9a-fA-F]{6}" -- packages/webview/src/components/stage` prints nothing.
- [ ] **Step 5: Commit** `feat(webview): stage canvas with selection toolbar, clamped edit popover and keyboard context menu`.

---

### Task 13: Sidebar rewrite

**Files:**
- Rewrite: `packages/webview/src/components/sidebar/sidebar-view.tsx`
- Modify: `packages/webview/src/App.tsx` (call sites)
- Create: `packages/webview/src/__tests__/sidebar.test.tsx`

**Interfaces:**
- Consumes: `StageStore`; `Section`, `Row`, `Segmented`, `Button`, `EmptyState`, `fieldClass`; `VariantPicker`, `ClassChips`, `ViewportSwitch`, `ElementList`; `createClassEditor` + presets.
- Produces: `export function SidebarView(p: { store: StageStore; embedded?: boolean }): JSX.Element`.

Behaviour (spec §5 "Sidebar"):
- Root `flex flex-col h-screen bg-panel text-fg text-xs`.
- Header (hidden when `embedded`): target label (`font-mono`), dirty dot (`aria-label="Unsynced changes"`), sub-line `cva` or `jsx` + ` · ` + file base name; `Button` `Stage` (`store.openStage(store.config.openMode, 'stage')`); `Button` `Sync` (primary, disabled when clean, `title="Sync to code (Ctrl+S)"`).
- `meta === null` → header + `EmptyState` (same copy as the stage) and nothing else.
- Sections in order: **Element** (`ElementList` with `elements = meta.elements ?? []`, `rootLabel` = `meta.cva.cvaIdentifier ?? meta.componentName`, `onSelect = store.selectElement`); **Content** (text input for `label`; one row per other prop — boolean → `Segmented` false/true, number/string → input; a `disabled` row when the component has no `disabled` prop); **Variants** (only with cva; `VariantPicker`); **Layout**, **Typography**, **Appearance** (same rows, prefixes and ranges as today, via `lenRow`); **Classes** (`Section` `count` = number of classes; `ClassChips` with placeholder `Add classes · Enter  (e.g. hover:bg-indigo-500 w-[220px])`; `Reset to base` → `store.discard()`, relabelled `Discard changes`; `Copy` → clipboard + `store.notify('Copied className', 'info')`); **Workspace** (closed by default: open mode, `ViewportSwitch` that also patches `defaultViewport`, grid, auto-sync, port).

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SidebarView } from '../components/sidebar/sidebar-view';
import type { StageStore } from '../state/use-stage';
import { DEFAULT_CONFIG, DEFAULT_STAGE_STATE, DEMO_META } from '../state/demo';

const noop = () => {};
const store = (over: Partial<StageStore> = {}): StageStore => ({
  hostKind: 'vscode', meta: DEMO_META, config: DEFAULT_CONFIG, stage: DEFAULT_STAGE_STATE,
  dirty: false, canUndo: false, canRedo: false, toast: null, targetLabel: 'buttonVariants', previewClass: '', baselinePreviewClass: '',
  setClasses: noop, undo: noop, redo: noop, discard: noop, sync: noop, selectVariant: noop, commitVariant: noop, setProp: noop,
  patchStage: noop, patchConfig: noop, selectElement: noop, openStage: noop, notify: noop, ...over,
});
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('SidebarView', () => {
  it('renders the sections in order with one disabled Sync while clean', () => {
    const out = html(<SidebarView store={store()} />);
    const order = ['Element', 'Content', 'Variants', 'Layout', 'Typography', 'Appearance', 'Classes', 'Workspace'].map((t) => out.indexOf(`>${t}<`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(out.match(/>Sync</g)?.length).toBe(1);
    expect(out).toMatch(/disabled=""[^>]*title="Sync to code \(Ctrl\+S\)"|title="Sync to code \(Ctrl\+S\)"[^>]*disabled=""/);
    expect(out).toContain('role="listbox"');
  });
  it('shows the dirty dot and hides the header when embedded', () => {
    expect(html(<SidebarView store={store({ dirty: true })} />)).toContain('aria-label="Unsynced changes"');
    const embedded = html(<SidebarView store={store({ dirty: true })} embedded />);
    expect(embedded).not.toContain('>Sync<'); expect(embedded).toContain('>Layout<');
  });
  it('shows the empty state without a component and omits Variants without cva', () => {
    const empty = html(<SidebarView store={store({ meta: null })} />);
    expect(empty).toContain('No component selected'); expect(empty).not.toContain('>Layout<');
    const plain = html(<SidebarView store={store({ meta: { ...DEMO_META, cva: { ...DEMO_META.cva, hasCva: false, variants: {} } } })} />);
    expect(plain).not.toContain('>Variants<');
  });
  it('uses only token colours', () => {
    const out = html(<SidebarView store={store({ dirty: true })} />).replace(/placeholder="[^"]*"/g, '').replace(/style="[^"]*"/g, '').replace(/value="[^"]*"/g, '');
    expect(out).not.toMatch(/zinc-|indigo-|rose-|emerald-|amber-|#[0-9a-f]{6}/i);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @retune/webview test` — expected: FAIL.
- [ ] **Step 3: Implement** the rewrite; update `App.tsx` to `<SidebarView store={store} />` (sidebar mode) and `<SidebarView store={store} embedded />` (standalone split).
- [ ] **Step 4: Verify.** `pnpm --filter @retune/webview test` PASS; `pnpm --filter @retune/webview build` exits 0.
- [ ] **Step 5: Commit** `feat(webview): sidebar on shared components with element list and host-owned dirty state`.

---

### Task 14: Cleanup, palette sweep, docs

**Files:**
- Modify: `packages/core/src/types/index.ts` (remove `SWITCH_TAB`, `THEME_CHANGED`, `MUTATION_SUCCESS`; make `MUTATE_CLASSES` payload `{ className: string }`)
- Modify: `packages/webview/src/components/controls.tsx` (drop the `Slider` and `field` aliases if unused; remove exports nothing imports)
- Modify: any remaining file under `packages/webview/src` that fails the sweep below
- Modify: `README.md`, `CHANGELOG.md`
- Create: `packages/webview/src/__tests__/palette-sweep.test.ts`

- [ ] **Step 1: Write the failing test** — a sweep that walks `packages/webview/src` (excluding `__tests__`, `components/controls.tsx`, `components/ui/color-field.tsx`, `state/demo.ts`, `styles.css`) and asserts no `.ts`/`.tsx` file matches `/\b(zinc|indigo|rose|emerald|amber|sky|violet)-\d|#[0-9a-fA-F]{6}\b|text-\[(?:[0-9]|10)px\]/`, reporting offending `file:line` entries in the assertion message; and a second test asserting `packages/webview/src/hooks` contains only `use-is-dark.ts` and that `viewport-frame.tsx` does not exist.
- [ ] **Step 2: Run** `pnpm --filter @retune/webview test` — note every reported offender.
- [ ] **Step 3: Fix** each offender with token utilities (placeholder example text that merely mentions a class name, such as `hover:bg-indigo-500` in the Classes placeholder, must be reworded to `hover:bg-accent-hover w-[220px]`).
- [ ] **Step 4: Remove the dead message types**, rebuild core (`pnpm --filter @retune/core build`), and fix any compile error by deleting the dead handling code (not by re-adding the type).
- [ ] **Step 5: Docs.** `README.md`: replace the "Harmonics Bar"/"Tone Matrix" stage description with the header/selection/popover model, document the shortcuts (`Ctrl/Cmd+S`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`), the Element list, and that the preview is approximate. `CHANGELOG.md`: add an `Unreleased` section listing: targeted edits (cva base, Nth element), real sync results, undo/redo, single Sync, theme tokens, CSP + offline Tailwind, element list, accessible controls.
- [ ] **Step 6: Verify everything.** `pnpm --filter @retune/core test`; `pnpm --filter @retune/core build`; `pnpm --filter @retune/webview test`; `pnpm --filter @retune/webview build`; `pnpm --filter retune-vscode lint`; `node packages/vscode-extension/scripts/bundle.mjs`; `pnpm --filter retune-vscode test`; `pnpm --filter @retune/engine test`; `pnpm --filter @retune/mcp test` — all exit 0.
- [ ] **Step 7: Commit** `chore: remove dead protocol messages, enforce token palette, update docs`.
