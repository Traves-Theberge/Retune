# Retune

> **Zero-config visual component tuner, non-lossy AST engine, and Scalar-powered OpenAPI console for VS Code & AI Agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Latest-3178C6.svg)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo%20%2B%20pnpm-EF4444.svg)](https://turbo.build/)
[![MCP Ready](https://img.shields.io/badge/MCP-Stdio%20Server-10B981.svg)](https://modelcontextprotocol.io/)

**Retune** bridges the gap between React UI code (`shadcn/ui`, `class-variance-authority`, Tailwind CSS) and live visual iteration directly inside VS Code's **Editor Tab System** and **Primary Sidebar**. Every visual adjustment—whether toggling CVA variants, tweaking component props, or fine-tuning Tailwind utility tokens in the Stage's **selection toolbar** and **edit popover**—is written back to your `.tsx` source code using minimal text edits computed with `@babel/parser` that never strip your comments or formatting.

---

## Key Capabilities

### 1. Native VS Code Editor Tab & Split Stage (`The Stage`)
- **Editor Tab System Integration**: Launch Retune directly from the editor tab title bar (`$(symbol-color)`), CodeLens above `cva(...)` definitions, or `Ctrl+Shift+R` (`Cmd+Shift+R` on macOS).
- **Multi-Tab Workspace**:
  - **The Stage**: Interactive canvas with fluid/preset viewports (`Responsive`, `Mobile 375px`, `Tablet 768px`, `Desktop 1024px`) and a dot-grid alignment overlay. The one-row header holds the target label (with a dirty dot), Undo, Redo, Compare, Discard, a single **Sync** button, viewport, grid and canvas tone (light/dark) controls.
  - **Targeted edits**: Edits go to the element you select, or to the component root when nothing is selected. The root is the `cva()` base classes when the file has one. Sync writes a minimal text edit to that element and reports the real result.
  - **Select, then edit**: Hover outlines an element; click selects it (tag chip and `W × H` badge); double-click opens its Text panel. A floating selection toolbar offers Text, Fill, Type, Space, Shape and Classes, plus Variants when the component has cva variants. Each opens a 280px edit popover that stays inside the stage and flips above the element when there is no room below.
  - **Approximate preview**: The canvas applies the classes to a stand-in tag, not the real rendered component. A caption under the canvas reads `Approximate preview — classes only`.
  - **Shortcuts**: `Ctrl/Cmd+S` sync, `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` (or `Ctrl/Cmd+Y`) redo. `Esc` closes the innermost layer: context menu, then popover, then selection. Undo and redo stay with the browser while focus is in a text field.
  - **AST & Props Inspector**: Real-time breakdown of extracted `cva` variant groups, `defaultVariants`, TypeScript `*Props` interfaces, and live `.tsx` source.
  - **Scalar API Console**: Embedded `@scalar/api-reference-react` interactive OpenAPI 3.1 console connected to the local Retune HTTP daemon.

### 2. Dedicated Activity Bar Sidebar (`Params & Configuration`)
- **Params & Elements**:
  - Inspect and switch active **CVA Variants** (`variant`, `size`, `intent`, etc.) and commit any option as the new `defaultVariants` in your `.tsx` AST.
  - Live **Component Props** controls generated automatically from your TypeScript `interface *Props` definitions (`string`, `boolean`, `number`).
  - **Element list**: The component root plus every JSX element, with its name, line number and class count. Selecting one makes it the edit target and reveals its line in the editor.
  - **Class editing** in sections (Element, Content, Variants, Layout, Typography, Appearance, Classes, Workspace). Numeric controls scrub by dragging the row label; in the number field `↑/↓` nudge one step, `Shift` ×10, `Alt` ×0.1.
- **Configuration Tab**:
  - Real-time synchronization with VS Code settings (`retune.stage.openMode`, `retune.stage.defaultViewport`, `retune.stage.showGrid`, `retune.autoSyncActiveEditor`, `retune.daemon.port`, `retune.scalar.layout`).

### 3. Non-Lossy AST Engine (`@retune/core`)
- Powered by `@babel/parser`, `@babel/traverse`, and `@babel/types`.
- Extracts `cva(...)` base classes, variant option maps, variant class strings, and default variants.
- Mutates `className` attributes and `defaultVariants` objects as minimal text splices (no reprinting) while preserving surrounding comments, imports, and indentation.

### 4. Headless MCP Server for AI Agents (`@retune/mcp`)
- Exposes `retune_inspect_component` and `retune_fine_tune_classes` over the Model Context Protocol (`@modelcontextprotocol/sdk`) stdio transport so coding agents can inspect CVA schemas and apply non-lossy Tailwind mutations programmatically.

---

## Architecture & Monorepo Layout

```text
retune/
├── packages/
│   ├── core/                # @retune/core — Babel AST Engine & OpenAPI 3.1 Spec
│   ├── engine/              # @retune/engine — Ephemeral Vite Sandbox & Local HTTP Daemon (:49221)
│   ├── webview/             # @retune/webview — React 19 + Tailwind + Scalar UI (Editor Tab & Sidebar)
│   ├── mcp/                 # @retune/mcp — Model Context Protocol (MCP) stdio Server
│   └── vscode-extension/    # retune-vscode — VS Code Extension Host, Sidebar & Editor Tab Providers
├── Spec.md                  # Engineering Architecture & Implementation Blueprint
├── turbo.json               # Turborepo task pipeline
└── pnpm-workspace.yaml      # pnpm workspace configuration
```

| Package | Description |
| :--- | :--- |
| [`@retune/core`](./packages/core) | AST analyzers (`extractCvaMetadata`, `analyzeProps`), non-lossy mutators (`mutateClassName`, `mutateDefaultVariant`), shared TypeScript contracts, and OpenAPI 3.1 specification. |
| [`@retune/engine`](./packages/engine) | Local HTTP daemon (`127.0.0.1:49221`) serving `/v1/openapi.json`, `/v1/components/inspect`, and `/v1/components/mutate`, plus programmatic Vite sandbox resolver. |
| [`@retune/webview`](./packages/webview) | Dual-mode React application rendering **The Stage** (Editor Tab) and **Params & Configuration** (Activity Bar Sidebar), with embedded `@scalar/api-reference-react`. |
| [`@retune/mcp`](./packages/mcp) | Model Context Protocol server exposing AST inspection and class mutation tools over stdio. |
| [`retune-vscode`](./packages/vscode-extension) | VS Code extension integrating Activity Bar views, Editor Title Tab actions, CodeLens, and bidirectional state synchronization. |

---

## Quick Start

### Prerequisites
- **Node.js** `>= 20.0.0`
- **pnpm** `>= 9.0.0`
- **VS Code** `>= 1.90.0`

### 1. Install & Build
```bash
# Install dependencies across all workspace packages
pnpm install

# Build all packages via Turborepo
pnpm build

# Run the Vitest unit & integration test suite
pnpm test
```

### 2. Launch in VS Code Extension Development Host
1. Open the repository root in VS Code.
2. Optionally start the Webview HMR server for live UI development:
   ```bash
   pnpm --filter @retune/webview dev
   ```
3. Press **`F5`** (or select **Run Extension** in the Run & Debug panel).
4. In the Extension Development Host window, open any `.tsx` component (e.g., `Button.tsx`).
5. Click the **Retune** icon in the Activity Bar to use the **Params & Configuration Sidebar**, or press **`Ctrl+Shift+R`** (`Cmd+Shift+R`) / click **Retune: Open Visual Stage** in the editor tab bar.

---

## VS Code Extension Configuration

All settings can be configured in VS Code `settings.json` or live via the **Retune Sidebar → Configuration** tab:

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `retune.stage.openMode` | `"split" \| "tab"` | `"split"` | Open Retune Stage beside the active editor (`"split"`) or as a full tab in the active group (`"tab"`). |
| `retune.stage.defaultViewport` | `"responsive" \| "mobile" \| "tablet" \| "desktop"` | `"responsive"` | Default viewport dimension preset on The Stage canvas. |
| `retune.stage.showGrid` | `boolean` | `true` | Render a dot-matrix alignment grid behind the component preview. |
| `retune.autoSyncActiveEditor` | `boolean` | `true` | Automatically sync the Stage Tab and Sidebar when switching active `.tsx` editors. |
| `retune.daemon.port` | `number` | `49221` | Local port for the Retune HTTP AST & OpenAPI daemon. |
| `retune.sandbox.port` | `number` | `5173` | Local port for the Vite Webview HMR server. |
| `retune.scalar.layout` | `"modern" \| "classic"` | `"modern"` | Layout theme for the embedded Scalar API Reference console. |

---

## HTTP Daemon & MCP Server Reference

### Local HTTP Daemon (`127.0.0.1:49221`)
- `GET /v1/openapi.json` — Returns the OpenAPI 3.1 specification consumed by Scalar.
- `POST /v1/components/inspect` — Accepts `{ "fileContent": "..." }` and returns extracted CVA metadata.
- `POST /v1/components/mutate` — Accepts `{ "fileContent": "...", "componentName": "Button", "className": "..." }` and returns non-lossy mutated code.

### MCP Server (`@retune/mcp`)
Add Retune to your MCP client configuration:
```json
{
  "mcpServers": {
    "retune": {
      "command": "node",
      "args": ["/absolute/path/to/retune/packages/mcp/dist/index.js"]
    }
  }
}
```
Available MCP Tools:
- `retune_inspect_component({ filePath })`
- `retune_fine_tune_classes({ filePath, componentName, newClasses })`

---

## License

Released under the [MIT License](./LICENSE).

