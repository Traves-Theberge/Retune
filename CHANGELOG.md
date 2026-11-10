# Changelog

All notable changes to the **Retune** monorepo and VS Code extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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

