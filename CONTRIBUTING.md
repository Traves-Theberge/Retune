# Contributing to Retune

Thank you for contributing to **Retune**! This document outlines the workspace setup, architecture conventions, and verification workflow.

## Workspace Setup

1. Ensure you have **Node.js >= 20** and **pnpm >= 9** installed.
2. Install all dependencies from the monorepo root:
   ```bash
   pnpm install
   ```
3. Build all 6 packages:
   ```bash
   pnpm build
   ```
4. Run unit and integration tests and typecheck across all packages:
   ```bash
   pnpm test && pnpm lint
   ```

## Package Responsibilities

- **`packages/core` (`@retune/core`)**: Keep AST analyzers and splicers (`src/ast/*`) free of VS Code, Node `fs`, or browser DOM dependencies so they run cleanly in the HTTP daemon, MCP server, Extension Host, and Orca's in-frame browser bundle.
- **`packages/engine` (`@retune/engine`)**: Houses the local HTTP daemon (`createRetuneDaemon`) and programmatic Vite sandbox resolver.
- **`packages/webview` (`@retune/webview`)**: Houses the React 19 UI, Stage canvas, Inspector sidebar, host adapters (`vscode`, `orca`, `standalone`), and lazy-loaded Scalar API console. UI components must use semantic `--rt-*` token classes (`bg-panel`, `text-fg`, `border-line`, `bg-accent`) and font sizes `>= 11px` (enforced by `palette-sweep.test.ts`).
- **`packages/mcp` (`@retune/mcp`)**: Houses the Model Context Protocol stdio server and AST tool handlers.
- **`packages/orca-plugin` (`@retune/orca-plugin`)**: Format 2 (`sandboxed-ui`) Orca plugin manifest and offline HTML entry builder (`node scripts/build.mjs`). Keep this package free of local `node_modules` symlinks so `orca plugin inspect` and `orca plugin check` pass cleanly.
- **`packages/vscode-extension` (`retune-vscode`)**: Houses the VS Code Extension Host activation logic, `StagePanel`, `RetuneSidebarProvider`, `RetuneCodeLensProvider`, and local VSIX packaging.

## Submitting Changes

1. Add or update unit tests in `src/__tests__/` for any AST, daemon, MCP, Webview, or Extension Host change.
2. Verify that `pnpm build`, `pnpm test`, and `pnpm lint` pass with zero errors.
3. If modifying `packages/orca-plugin` or `@retune/webview`, also run `orca plugin validate packages/orca-plugin` and `orca plugin check packages/orca-plugin`.
4. Document user-facing changes in `CHANGELOG.md`.
