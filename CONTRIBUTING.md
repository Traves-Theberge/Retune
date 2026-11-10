# Contributing to Retune

Thank you for contributing to **Retune**! This document outlines the workspace setup, architecture conventions, and verification workflow.

## Workspace Setup

1. Ensure you have **Node.js >= 20** and **pnpm >= 9** installed.
2. Install all dependencies from the monorepo root:
   ```bash
   pnpm install
   ```
3. Build all packages:
   ```bash
   pnpm build
   ```
4. Run unit and integration tests across all packages:
   ```bash
   pnpm test
   ```

## Package Responsibilities

- **`packages/core` (`@retune/core`)**: Keep this package free of VS Code or browser DOM dependencies so it can be shared cleanly across the HTTP daemon, MCP server, Webview, and Extension Host.
- **`packages/engine` (`@retune/engine`)**: Houses the local HTTP daemon (`createRetuneDaemon`) and programmatic Vite sandbox server.
- **`packages/webview` (`@retune/webview`)**: Houses the React 19 UI for both the **Editor Tab (`editor-tab`)** and **Activity Bar Sidebar (`sidebar`)** modes.
- **`packages/mcp` (`@retune/mcp`)**: Houses the Model Context Protocol stdio server and tool handlers.
- **`packages/vscode-extension` (`retune-vscode`)**: Houses the VS Code Extension Host activation logic, `StagePanel`, `RetuneSidebarProvider`, and `RetuneCodeLensProvider`.

## Submitting Changes

1. Add or update unit tests in `src/__tests__/` for any AST, daemon, or MCP change.
2. Verify that `pnpm build`, `pnpm test`, and `pnpm lint` pass with zero errors.
3. Document user-facing changes in `CHANGELOG.md`.

