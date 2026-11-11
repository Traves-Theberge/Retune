# Changelog

All notable changes to the **Retune** monorepo and VS Code extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Targeted edits**: Edits go to the selected element (the Nth JSX element with an exact name) or to the component root (the `cva()` base classes when present). Class changes are written as a minimal text edit.
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

