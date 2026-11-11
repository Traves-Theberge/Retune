# Retune Stage: Interaction & Polish — Design Spec

Date: 2026-11-11 · Branch: `feat/stage-interaction-polish` · Status: approved for implementation (Plan A)

## 1. Problem

The visual editor works as a concept but is rough to use:

- **Edits can land in the wrong place.** With no explicit target, the cva base classes are written onto the first JSX element's `className` instead of into the `cva()` call. Targets are matched loosely by name (case-insensitive, first match, fallback to the first element).
- **Sync feedback is fake.** "Synced" is shown without knowing whether anything was written. The host never replies. Five different Sync buttons exist.
- **State is duplicated and echoes.** Dirty tracking lives only in the sidebar. Every edit is posted to the host and sent straight back to the sender. `SYNC_COMPONENT` resets the class string in the webview on every keystroke in the document.
- **No undo, no keyboard, no accessibility.** No history, no shortcuts, no focus rings, no aria roles; glyphs (`↺ ✕ − +`) stand in for icons.
- **It ignores the host theme.** Colours are hardcoded hex/zinc values; most text is 10px mono at low contrast.
- **Popovers overflow.** The edit modal and context menu are not clamped to the panel.
- **The webview has no CSP and loads `cdn.tailwindcss.com`**, so the preview only renders arbitrary user classes when online.
- **Demo data masquerades as real data** when no component is active.
- **Controls are duplicated** between the sidebar, the modal and the context menu (variants, class chips, viewport pickers).

## 2. Goals / non-goals

Goals (Plan A, this spec):

1. Edits always go to the element the user picked, and the UI reports the real outcome.
2. One source of truth for "what is being edited" and "is it dirty" (the host), with per-webview undo/redo.
3. A selection → toolbar → popover flow that never overflows, is keyboard reachable, and has one Sync.
4. The UI adopts the host theme through a token layer that is not VS Code specific (so an Orca host can map the same tokens — see §9).
5. Offline, CSP-protected webview.

Non-goals (separate plans):

- **Plan B — real component preview.** Rendering the user's actual component through the Vite sandbox. The stage keeps the approximate class-only preview and says so.
- **Plan C — Orca plugin (GitHub issue #1).** Researched in `2026-11-11-orca-plugin-research.md`; Plan A only keeps the webview host-agnostic.
- Splitting the 5 MB bundle (Scalar is bundled into both webviews; `codeSplitting: false` is deliberate). Forced hover/focus state preview. Drag handles on the canvas.

## 3. Editing model

**Target.** `StageState.targetElement?: string` plus new `targetIndex?: number` identify "the Nth JSX element with exactly this name, in document order" (0-based). No target means the **component root**: the `cva()` base string if the file has `cva()`, otherwise the first JSX element. Name matching is exact (case-sensitive). A requested name that matches no element (e.g. a CodeLens passing the component name `Button`) normalises to the root.

**Class string.** `StageState.harmonicsClass` is the working value. New `StageState.baselineClass` is what the file currently contains for the target. `dirty = harmonicsClass !== baselineClass`. Both are owned by the host and sent to every webview.

**Reconcile rule** (host, on every document change and target change): let `fileClass` be the target's classes read from the file. If the target changed or the state is clean, set both `harmonicsClass` and `baselineClass` to `fileClass`. If dirty, keep `harmonicsClass` and only update `baselineClass`. Unsynced edits are never thrown away by an external edit.

**Sync.** `MUTATE_CLASSES { className }` — the host resolves the target itself, computes a minimal `TextEdit`, applies it as a small `WorkspaceEdit` (not a whole-document replace), and broadcasts `MUTATION_RESULT { ok, kind, message }` to all webviews. Failure messages are specific (`No <span> element found`, `cva() base classes are not a plain string`, `No active component file`). A no-op is `ok: true, message: 'Already up to date'`.

**No echo.** `UPDATE_STAGE_STATE` / `UPDATE_PROP_VALUE` from one webview are forwarded to the *other* webview only. `SYNC_COMPONENT` carries metadata only; it never changes the class string in the webview. `SYNC_COMPONENT` payload is `null` when no `.tsx/.jsx` document is active.

**History.** Each webview keeps an undo stack of class strings (limit 100). Changes within 400 ms of the previous change coalesce into one entry, so a slider drag is one undo step. A class change arriving from the host is recorded like a local change; a target change starts a new stack.

## 4. Protocol changes (`@retune/core` types)

```ts
interface StageState { targetElement?: string; targetIndex?: number; baselineClass: string; /* existing fields unchanged */ }
interface ComponentMetadata { elements?: ElementInfo[]; /* existing fields unchanged */ }

type WebviewMessage =
  | { type: 'MUTATE_CLASSES'; payload: { className: string; componentName?: string } } // componentName ignored
  | { type: 'SELECT_ELEMENT'; payload: { name: string; index: number } | null }        // null = component root
  | /* READY, MUTATE_VARIANT, UPDATE_PROP_VALUE, UPDATE_STAGE_STATE, UPDATE_CONFIG, OPEN_STAGE_TAB unchanged */;
// removed: SWITCH_TAB

type HostMessage =
  | { type: 'SYNC_COMPONENT'; payload: ComponentMetadata | null }
  | { type: 'MUTATION_RESULT'; payload: { ok: boolean; kind: 'classes' | 'variant'; message: string } }
  | /* SYNC_STAGE_STATE, SYNC_CONFIG unchanged */;
// removed: THEME_CHANGED, MUTATION_SUCCESS
```

New core function: `computeCvaBaseEdit(source, newBase): TextEdit | null` (first `cva()` call, first argument a string literal or expression-free template literal; quote style preserved).

## 5. Interaction design

**Stage header** (one row, 36px): tab switch `Stage | Code | API`; target label (`<button>` or `buttonVariants`) with a dirty dot; Undo, Redo; Compare (hold to show the baseline classes in the preview; disabled when clean); Discard; **Sync** (the only primary button; disabled when clean; title shows `Ctrl+S`); viewport switch; grid toggle; canvas tone toggle (light/dark backdrop).

**Canvas.** Hover shows a 1px accent outline. Click selects: 2px accent outline, a tag chip above the element and a `W × H` badge below it. Double-click opens the Text panel. Click on empty canvas deselects. `Esc` closes the innermost layer: context menu → popover → selection. A caption under the canvas reads `Approximate preview — classes only`. The preview tag follows the target when it is a safe intrinsic element (`button a div span p label li h1–h6 section article nav header footer`), else `button` when the component name contains `button`/`btn`, else `div`.

**Selection toolbar.** Floats above the selected element (below if there is no room), clamped horizontally. Buttons: Text, Fill, Type, Space, Shape, Variants (only with cva variants), Classes. No Sync here.

**Edit popover.** 280px wide, placed below the element with an 8px gap; flips above when it does not fit; clamped to the container with an 8px margin; its max height is the free space on the chosen side (minimum 80px) and its body scrolls. Title + close button. No footer.

**Context menu.** `role="menu"`, clamped to the window, `↑/↓` move focus, `Enter` activates, `Esc` closes. Items: the seven panels · Disable/Enable · Sync to code (`Ctrl+S`) · Undo · Redo · Copy className · Copy JSX · Reset variants · Discard changes (danger) · Inspect code. The viewport grid and "Open inspector" items are removed.

**Sidebar.** Sections: Element (new), Content, Variants, Layout, Typography, Appearance, Classes, Workspace. The Element section lists the component root plus every JSX element (`<name>`, line number, class count); clicking one sends `SELECT_ELEMENT` and the host reveals that line in the editor. Header: target label, dirty dot, `Stage` button, `Sync` button. When the sidebar is embedded in the standalone browser view its header is hidden (the stage header owns the actions).

**Numeric controls.** Slider + number field + reset. Dragging the row label scrubs the value (1 step per 2px). In the number field `↑/↓` nudge by one step, `Shift` ×10, `Alt` ×0.1. Values are clamped to the control's range and rounded to its step. An unset control shows `–` and a dimmed slider.

**Shortcuts** (both webviews): `Ctrl/Cmd+S` sync; `Ctrl/Cmd+Z` undo; `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` redo. Undo/redo are left to the browser while focus is in a text field.

**Feedback.** One toast region (`role="status"`), bottom centre. Success 1.5 s, error 4 s. Driven by `MUTATION_RESULT` and by copy actions.

**Empty state.** With no active component (VS Code): icon, `No component selected`, `Open a .tsx or .jsx file to start tuning.` The demo Button is used only in the standalone browser.

## 6. Visual system

All UI colour comes from `--rt-*` custom properties defined once in `styles.css`, each mapped from a `--vscode-*` variable with a dark fallback, and exposed to Tailwind v4 through `@theme inline`:

| Token | Tailwind name | VS Code source | Fallback |
| :-- | :-- | :-- | :-- |
| `--rt-canvas` | `canvas` | `--vscode-editor-background` | `#09090b` |
| `--rt-panel` | `panel` | `--vscode-sideBar-background` | `#0e0e12` |
| `--rt-raised` | `raised` | `--vscode-input-background` | `#16161b` |
| `--rt-overlay` | `overlay` | `--vscode-menu-background` | `#111116` |
| `--rt-line` | `line` | `--vscode-panel-border` | `#27272a` |
| `--rt-fg` | `fg` | `--vscode-foreground` | `#e4e4e7` |
| `--rt-muted` | `muted` | `--vscode-descriptionForeground` | `#a1a1aa` |
| `--rt-subtle` | `subtle` | `--vscode-disabledForeground` | `#71717a` |
| `--rt-accent` | `accent` | `--vscode-button-background` | `#4f46e5` |
| `--rt-accent-fg` | `accent-fg` | `--vscode-button-foreground` | `#ffffff` |
| `--rt-accent-hover` | `accent-hover` | `--vscode-button-hoverBackground` | `#6366f1` |
| `--rt-focus` | `focus` | `--vscode-focusBorder` | `#6366f1` |
| `--rt-hover` | `hover` | `--vscode-list-hoverBackground` | `#27272a` |
| `--rt-active` | `active` | `--vscode-list-activeSelectionBackground` | `#3f3f46` |
| `--rt-active-fg` | `active-fg` | `--vscode-list-activeSelectionForeground` | `#ffffff` |
| `--rt-danger` | `danger` | `--vscode-errorForeground` | `#f43f5e` |
| `--rt-success` | `success` | `--vscode-testing-iconPassed` | `#10b981` |
| `--rt-warn` | `warn` | `--vscode-editorWarning-foreground` | `#f59e0b` |
| `--rt-font` | `font-sans` | `--vscode-font-family` | system UI stack |
| `--rt-mono` | `font-mono` | `--vscode-editor-font-family` | `ui-monospace, Consolas, monospace` |

Rules: no raw hex and no `zinc-/indigo-/rose-/emerald-/amber-/sky-/violet-` utility in `packages/webview/src` outside `components/controls.tsx` (preset data), `state/demo.ts`, and `styles.css`. Minimum font size 11px (`text-[11px]`); body text 12px (`text-xs`). Mono only for code-like values (class names, tags, numbers). Every interactive element has a visible `focus-visible` ring in `focus`. Icons come from `lucide-react` (already a dependency) at 14px; icon-only buttons carry `aria-label` and `title`. The canvas backdrop tone (light/dark) is independent of the host theme and uses two fixed colours defined in `styles.css`.

## 7. Security / offline

`buildWebviewHtml` emits a CSP meta tag with a per-load nonce:

```
default-src 'none'; img-src {cspSource} https: data:; font-src {cspSource} https: data:;
style-src {cspSource} 'unsafe-inline'; script-src 'nonce-{nonce}' {cspSource}[ {devOrigin}];
connect-src http://127.0.0.1:* http://localhost:* ws://localhost:*; worker-src blob:
```

The `cdn.tailwindcss.com` script is removed. `@tailwindcss/browser` (same 4.3.5 as the build) is bundled into the webview so arbitrary user classes render offline. `devOrigin` (`http://localhost:{sandboxPort}`) appears only when no built bundle exists.

## 8. Code structure (webview)

```
src/lib/        host.ts  edit-session.ts  shortcuts.ts  placement.ts  scrub.ts  preview.ts  arbitrary-style.ts
src/state/      demo.ts  stage-reducer.ts  use-stage.ts
src/hooks/      use-is-dark.ts
src/components/ui/      button.tsx segmented.tsx section.tsx row.tsx scrub-input.tsx color-field.tsx popover.tsx toast.tsx empty-state.tsx index.ts
src/components/shared/  viewports.ts variant-picker.tsx class-chips.tsx viewport-switch.tsx element-list.tsx
src/components/stage/   stage.tsx selection-toolbar.tsx edit-panels.tsx context-menu.tsx
src/components/sidebar/ sidebar-view.tsx
src/components/controls.tsx   (token presets + createClassEditor only)
src/App.tsx                   (shell: header, tabs, shortcuts, toast)
```

Logic lives in pure modules tested with vitest in node; components are tested with `react-dom/server` `renderToStaticMarkup` (no jsdom). The extension gets a pure `src/state/stage-state.ts` (target resolution, reconcile, mutation planning) and a pure `src/providers/webview-html-template.ts`; neither imports `vscode`.

## 9. Roadmap beyond Plan A

- **Plan B — real preview:** boot the engine's Vite sandbox against the workspace, render the target component in an iframe with the user's Tailwind config, map canvas selection to source elements. Removes the safelist, `parseArbitraryStyle` and the caption.
- **Plan C — Orca plugin (issue #1):** package the same webview and core for Orca. Plan A's contribution is the `HostBridge` (`kind`, `post`, `subscribe`) and the `--rt-*` token layer; an Orca host supplies its own bridge and token mapping. Details and task outline: `2026-11-11-orca-plugin-research.md`.

## 10. Manual checks after implementation (not automatable here)

1. In VS Code: open `examples/Button.tsx`, change padding, press `Ctrl+S` in the Stage → only the `cva()` base literal changes in the file; undo in the editor is one step.
2. Switch VS Code to a light theme → the Stage and sidebar follow it.
3. The API tab (Scalar) still loads under the CSP.
4. Offline: an arbitrary class such as `bg-teal-400` typed into Classes renders in the preview.
