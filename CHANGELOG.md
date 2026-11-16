# Changelog

All notable changes to the **Retune** monorepo and VS Code extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Targeted edits**: Edits go to the selected element (the Nth JSX element with an exact name), to the component root (the `cva()` base classes when present), or directly inside any named `cva().variants[group][key]` entry (`computeCvaVariantEdit`). Class changes are written as minimal text splices (`TextEdit`).
- **New Variant extraction (`+` in `VariantPicker`)**: Save tuned Stage/Sidebar classes directly into `cva().variants[group]` as a brand-new named variant key (`MUTATE_CVA_VARIANT`) or switch between base and variant editing (`SELECT_CVA_TARGET`).
- **Multi-element `PreviewNode` tree**: `extractPreviewTree` parses the component's returned JSX hierarchy so nested child elements render interactively on the Stage and select directly on click.
- **Box-model drag handles & live a11y HUD**: Selecting an element on the Stage shows direct horizontal/vertical resize handles (`w-[Npx]`, `h-[Npx]`) and computes real WCAG contrast (`AAA` / `AA` / `AA Large` / `Low`) plus `44px` touch-target checks from resolved styles.
- **Pseudo-state simulator & Variant Matrix**: Simulate `:hover`, `:focus-visible`, and `:active` in the Canvas Dock and Sidebar (applying state-prefixed classes), or toggle the Variant Matrix view to inspect every CVA combination in an interactive grid.
- **Bidirectional Editor ↔ Stage cursor sync**: Moving the cursor in a `.tsx`/`.jsx` editor automatically highlights the innermost JSX element on the Stage (when no unsynced edits exist).
- **MCP & Daemon parity**: `@retune/engine`, `openapi.json`, and `@retune/mcp` now expose `props`, `elements`, `previewTree`, `targetIndex`-targeted class mutations, `cvaBase`, and `retune_mutate_cva_variant`.
- **Lazy-loaded Scalar console**: `@scalar/api-reference-react` is deferred via `React.lazy` until switching to the API view.
- **Real sync results**: Sync reports success or a specific failure (for example `No <span> element found`) from the host. Syncing with nothing changed reports `Already up to date`.
- **Undo/redo**: Per-webview history (100 steps). Changes within 400 ms coalesce into one step. Shortcuts `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y`.
- **Single Sync**: One primary Sync button (`Ctrl/Cmd+S`), enabled only when the classes are dirty. The host tracks the dirty state.
- **Element list**: The sidebar lists the component root and every JSX element. Selecting one makes it the edit target and reveals its line in the editor.
- **Selection stage**: Hover, click and double-click selection on the canvas, a selection toolbar, and a clamped 280px edit popover. `Esc` closes the innermost layer.
- **Empty state**: With no active component, the webview shows `No component selected` instead of demo data. The demo Button is used only in the standalone browser.
- **Accessible controls**: Visible focus rings, `aria-label` and `title` on icon-only buttons, `lucide-react` icons at 14px, and scrubbable numeric controls with keyboard nudging.

### Changed
- **Theme tokens**: All UI colours come from `--rt-*` tokens mapped to `--vscode-*` variables, so the stage and sidebar follow the host theme.
- **Content Security Policy and offline Tailwind**: The webview has a nonce-based CSP. `@tailwindcss/browser` is bundled, so arbitrary classes render offline and the CDN script is removed.
- **Approximate preview**: The stage is labelled as an approximate, classes-only preview.

### Fixed
- Exact element targeting: an offset at the start of a tag no longer matches the tag that ends right before it.
- Consistent `cva()` handling: the first `cva()` call is read and written, and template-literal base classes are read.
- Dynamic `className`: interpolated templates and the `[...].filter(Boolean).join(" ")` wrapper are read exactly as they are written, and Sync no longer nests wrappers.
- Classes containing quotes no longer corrupt JSX attribute strings; generic components get `className` after their type arguments.
- Undo history is clean after first load and after switching files.
- Re-selecting the current element keeps unsynced edits; a successful Sync no longer overwrites newer edits.
- Numeric fields can be typed (committed on blur or Enter); Ctrl/Cmd+Z and Y work after using sliders or colour pickers; AltGr combinations no longer trigger shortcuts.
- A syntax error in the active file no longer throws out of the extension host.

### Removed
- Protocol messages `SWITCH_TAB`, `THEME_CHANGED` and `MUTATION_SUCCESS`. `MUTATE_CLASSES` no longer carries `componentName`.

## [1.0.0] - 2026-11-09

### Added
- **`@retune/core` (Non-Lossy AST Engine)**:
  - `extractCvaMetadata`: Extracts `cva(...)` identifier, base classes, variant groups, per-variant Tailwind class maps (`variantClasses`), and `defaultVariants` using `@babel/parser` and `@babel/traverse`.
  - `analyzeProps`: Parses TypeScript `*Props` interfaces into structured `PropDefinition` metadata (`name`, `type`, `optional`).
  - `mutateClassName` & `mutateDefaultVariant`: Performs format-preserving JSX `className` and `defaultVariants` AST mutations powered by `recast`.
  - Bundled OpenAPI 3.1 specification (`src/spec/openapi.json`) for the Retune Engine API.
- **`@retune/engine` (Local HTTP Daemon & Vite Sandbox)**:
  - `createRetuneDaemon`: Zero-dependency Node HTTP server on `127.0.0.1:49221` with full CORS support serving `GET /v1/openapi.json`, `POST /v1/components/inspect`, and `POST /v1/components/mutate`.
  - `createSandboxViteServer` & `resolveWorkspaceAlias`: Programmatic Vite server with `@/` workspace alias resolution.
- **`@retune/webview` (Editor Tab & Sidebar UI)**:
  - Dual-mode React 19 UI supporting both the **VS Code Editor Tab System** (`editor-tab` mode) and **Activity Bar Sidebar** (`sidebar` mode).
  - **The Stage**: Interactive component preview with `Responsive`, `Mobile (375px)`, `Tablet (768px)`, and `Desktop (1024px)` viewport frames, toggleable alignment dot-grid, **Tone Matrix** pill bar, and **Harmonics Bar** with quick Tailwind utility token chips.
  - **AST & Props Inspector Tab**: Side-by-side live inspection of extracted CVA metadata, TypeScript prop definitions, and raw `.tsx` source code.
  - **Scalar API Console Tab**: Embedded `@scalar/api-reference-react` interactive OpenAPI reference connected to the local Retune daemon.
- **`@retune/mcp` (Model Context Protocol Server)**:
  - Headless MCP stdio server exposing `retune_inspect_component` and `retune_fine_tune_classes` for autonomous coding agents.
- **`retune-vscode` (VS Code Extension)**:
  - Registered Activity Bar container (`retune-sidebar`) and `RetuneSidebarProvider` (`retune.sidebarView`) with **Params & Tone** and **Configuration** tabs.
  - Registered Editor Tab commands (`retune.openStage`, `retune.openStageTab`, `retune.openStageSplit`, `retune.openScalarApi`), Editor Title Bar icons, Context Menu actions, and `Ctrl+Shift+R` (`Cmd+Shift+R`) keybinding.
  - Registered `RetuneCodeLensProvider` above `cva(...)` definitions in `.tsx` and `.jsx` files.
  - Full VS Code settings schema (`retune.daemon.port`, `retune.sandbox.port`, `retune.stage.openMode`, `retune.stage.defaultViewport`, `retune.stage.showGrid`, `retune.autoSyncActiveEditor`, `retune.scalar.layout`).

