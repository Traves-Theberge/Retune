<p align="center">
  <img src="./docs/assets/retune-banner.png" alt="Retune" width="100%" />
</p>

<p align="center">
  <strong>Edit React and Tailwind CSS components visually, and save clean changes straight back to your code.</strong>
</p>

<p align="center">
  <a href="https://github.com/Traves-Theberge/Retune/actions/workflows/ci.yml"><img src="https://github.com/Traves-Theberge/Retune/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-4f46e5.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/TypeScript-7.x-3178C6.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/VS%20Code-%5E1.90.0-007ACC.svg" alt="VS Code" />
  <img src="https://img.shields.io/badge/Orca%20Plugin-Format%202-8B5CF6.svg" alt="Orca Plugin" />
  <img src="https://img.shields.io/badge/MCP-Stdio%20Server-10B981.svg" alt="MCP Server" />
</p>

<p align="center">
  <code>react</code> · <code>tailwind-css</code> · <code>shadcn-ui</code> · <code>cva</code> · <code>visual-editor</code> · <code>vscode-extension</code> · <code>orca-plugin</code> · <code>mcp-server</code>
</p>

---

Tuning Tailwind CSS styles by hand means switching between your code editor and the browser until spacing, colors, and states feel right. Visual page builders often make you keep separate preview files or reformat your code when they save.

**Retune** opens your `.tsx` and `.jsx` components directly on an interactive canvas inside VS Code, Antigravity IDE, Orca, or your browser. Click any element to adjust spacing, layout, typography, colors, `:hover` / `:focus` / `:active` states, or `cva()` variants. When you save, Retune changes only the class strings you edited—your comments, imports, indentation, and helpers like `cn()` or `clsx()` stay untouched.

---

## What It Does

### Visual Canvas (`Stage`)
- **Click to select elements**: Inspect nested JSX elements inside your component, see their tag and line number, and focus any child directly on the canvas.
- **Drag to resize & inline editing**: Drag width and height handles on the selected element, double-click text to edit labels in place, or right-click to open quick actions.
- **Popovers right where you work**: Open **Text**, **Fill**, **Type**, **Space**, **Shape**, **Variants**, and **Classes** popovers directly from the selected element without leaving the canvas.
- **Viewport & backdrop presets**: Switch between **Fluid**, **Mobile (`375px`)**, **Tablet (`768px`)**, and **Desktop (`1024px`)**, toggle the background dot grid, and switch between dark and light canvas backdrops.

### Inspector Sidebar & Variant Matrix
- **Structured style controls**: Fine-tune **Element**, **Content**, **Variants**, **Layout**, **Typography**, **Appearance**, **Classes**, and **Workspace** from the sidebar.
- **Edit and add `cva()` variants**: Switch variant options live, edit variant class lists in place, create brand-new named variants with **`+`**, set default variants, or toggle **Variant Matrix** to preview all variant combinations side by side.
- **Preview interactive states**: Toggle **Base**, **:hover**, **:focus**, and **:active** in the dock or sidebar to preview and edit state styles (`hover:*`, `focus-visible:*`, `active:*`) without holding your mouse down.
- **Live contrast & touch-target checks**: See calculated WCAG contrast grades (`AAA`, `AA`, `AA Large`, `Low`) and `< 44px` touch-target warnings as you adjust styles.

### Safe Code Updates & History
- **Follows your cursor**: Moving your cursor inside a JSX element in code selects it on the canvas; clicking an element in the sidebar highlights its source line.
- **100-step Undo / Redo**: Step backward or forward with `Ctrl+Z` / `Ctrl+Shift+Z`, hold to compare against the saved file, discard unsaved edits, and press **`Ctrl+S`** (`Cmd+S`) or click **Sync** to save.
- **Targeted source edits**: Updates only the `className` and `cva()` strings you changed instead of reprinting the file.

### Editor, Desktop & Agent Support
- **VS Code & Antigravity IDE (`retune-vscode`)**: Open beside code in a split pane or in a full tab, dock the Inspector in the Activity Bar, and launch directly from inline CodeLenses or right-click menus.
- **Orca (`@retune/orca-plugin`)**: Switch any `.tsx` or `.jsx` tab from **Source** to **Retune**, and toggle the synchronized **Retune Inspector** in the right sidebar with **`Mod+Shift+R`**.
- **Standalone browser & AI agents (`@retune/engine`, `@retune/mcp`)**: Run Retune in any browser tab, browse the local HTTP API (`http://127.0.0.1:49221`), or connect `@retune/mcp` over stdio so AI agents can inspect components and apply targeted class edits.

---

## How to Use It

### Prerequisites
- **Node.js** `>= 20.0.0`
- **pnpm** `>= 9.0.0`
- **VS Code** `>= 1.90.0` or **Antigravity IDE** (for the IDE extension)
- **Orca** `>= 1.4.248` (optional, for the Orca plugin)

### 1. Install, Build & Test

```bash
# Install dependencies across the workspace
pnpm install

# Build all 6 packages, Orca webviews, and the VS Code VSIX
pnpm build

# Run unit and integration tests
pnpm test

# Run TypeScript typechecking
pnpm lint
```

### 2. VS Code & Antigravity IDE
Building the workspace creates `packages/vscode-extension/retune-vscode-1.0.0.vsix` and installs it locally (or press **`F5`** in VS Code to open an Extension Development Host).

1. Open any `.tsx` or `.jsx` component (such as [`examples/Button.tsx`](./examples/Button.tsx)).
2. Press **`Ctrl+Shift+R`** (`Cmd+Shift+R` on macOS), right-click a component and choose **Retune: Tune Component in Stage**, click the inline **CodeLens** above a component or `cva()` call, or open **Retune** in the Activity Bar.
3. Adjust styles on the canvas or in the sidebar, then press **`Ctrl+S`** (`Cmd+S`) or click **Sync** to save changes back to your file.

<details>
<summary><strong>VS Code Extension Settings (<code>retune.*</code>)</strong></summary>

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `retune.stage.openMode` | `"split" \| "tab"` | `"split"` | Open the Stage beside the active editor or in a full tab. |
| `retune.stage.defaultViewport` | `"responsive" \| "mobile" \| "tablet" \| "desktop"` | `"responsive"` | Default width preset on the Stage canvas. |
| `retune.stage.showGrid` | `boolean` | `true` | Show the background dot grid on the canvas. |
| `retune.autoSyncActiveEditor` | `boolean` | `true` | Sync Stage and sidebar selection with the active `.tsx`/`.jsx` cursor. |
| `retune.daemon.port` | `number` | `49221` | Port for the local HTTP server. |
| `retune.sandbox.port` | `number` | `5173` | Port for the standalone Vite webview dev server. |
| `retune.scalar.layout` | `"modern" \| "classic"` | `"modern"` | Layout theme for the local Scalar API reference tab. |

</details>

### 3. Orca (`onorca.dev`)
1. Build the workspace and verify the Orca plugin bundle:
   ```bash
   pnpm build
   orca plugin validate packages/orca-plugin
   orca plugin check packages/orca-plugin
   ```
2. Open **Orca**, enable plugins under **Settings → Plugins**, and load the local plugin:
   ```bash
   orca plugin dev load packages/orca-plugin
   ```
3. Open any `.tsx` or `.jsx` file, switch the view toggle next to **Source** to **Retune**, and toggle **Retune Inspector** in the right sidebar with **`Mod+Shift+R`**.

### 4. Standalone Browser Mode
Start the local HTTP backend and Vite webview frontend:

```bash
pnpm --filter @retune/engine start
pnpm --filter @retune/webview dev
```

- **Canvas & Inspector UI**: `http://localhost:5173`
- **OpenAPI Spec**: `GET http://127.0.0.1:49221/v1/openapi.json`
- **Inspect Component**: `POST http://127.0.0.1:49221/v1/components/inspect` (`{ fileContent }`)
- **Update Component**: `POST http://127.0.0.1:49221/v1/components/mutate` (`{ fileContent, componentName, targetIndex, cvaBase, cvaVariant, defaultVariant, className }`)

### 5. AI Agents via MCP (`@retune/mcp`)
Register the built MCP server with Antigravity or any MCP client:

```bash
agy mcp add retune node "c:/path/to/Retune/packages/mcp/dist/index.js"
```

```json
{
  "mcpServers": {
    "retune": {
      "command": "node",
      "args": ["/absolute/path/to/Retune/packages/mcp/dist/index.js"]
    }
  }
}
```

| MCP Tool | Purpose |
| :--- | :--- |
| `retune_inspect_component` | Reads `cva()` variants, TypeScript props, JSX elements, and preview tree from a `.tsx` file. |
| `retune_fine_tune_classes` | Updates `className` on a component, Nth element (`targetIndex`), or `cvaBase`. |
| `retune_mutate_cva_variant` | Edits or adds a named variant under `cva().variants[group]` and optionally sets `defaultVariants`. |

---

## Project Layout

```text
Retune/
├── docs/assets/                  # Brand banner and icon assets (retune-banner.png, retune-logo.png, retune-logo.svg)
├── examples/                     # Sample React + Tailwind components (e.g., Button.tsx)
├── packages/
│   ├── core/                     # @retune/core — Source parser, targeted class edits, and OpenAPI schema
│   ├── engine/                   # @retune/engine — Local HTTP server (:49221) and Vite resolver
│   ├── webview/                  # @retune/webview — Stage canvas, Inspector sidebar, and host adapters
│   ├── mcp/                      # @retune/mcp — Model Context Protocol stdio server
│   ├── orca-plugin/              # @retune/orca-plugin — Orca Format 2 plugin
│   └── vscode-extension/         # retune-vscode — VS Code & Antigravity IDE extension
├── turbo.json                    # Turborepo task pipeline
└── pnpm-workspace.yaml           # pnpm workspace config
```

| Package | Role | Key Exports / Entrypoints |
| :--- | :--- | :--- |
| [`@retune/core`](./packages/core) | Source analysis & minimal edits | `extractCvaMetadata`, `analyzeProps`, `extractComponentName`, `extractPreviewTree`, `listElements`, `computeClassNameEdit`, `computeCvaBaseEdit`, `computeCvaVariantEdit`, `computeDefaultVariantEdit`, `openApiSpec` |
| [`@retune/engine`](./packages/engine) | Local HTTP server & Vite helpers | `createRetuneDaemon(port = 49221)`, `createSandboxViteServer`, `resolveWorkspaceAlias` |
| [`@retune/webview`](./packages/webview) | Stage & Inspector React UI | Dual-mode UI (`editor-tab` & `sidebar`), VS Code & Orca adapters, WCAG/a11y helpers, Scalar API view |
| [`@retune/mcp`](./packages/mcp) | AI agent MCP server | `retune_inspect_component`, `retune_fine_tune_classes`, `retune_mutate_cva_variant` |
| [`@retune/orca-plugin`](./packages/orca-plugin) | Orca (`onorca.dev`) plugin | `orca-plugin.json`, `retune-stage` editor, `retune-inspector` panel |
| [`retune-vscode`](./packages/vscode-extension) | VS Code / Antigravity extension | `StagePanel`, `RetuneSidebarProvider`, `RetuneCodeLensProvider`, VSIX local installer |

---

## How to Contribute

Contributions are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

1. Keep browser-shared modules under [`packages/core/src/ast/`](./packages/core/src/ast) free of Node `fs`/`path` or VS Code imports so they bundle cleanly into both Node tools and Orca's sandboxed iframe.
2. Use semantic color tokens (`bg-panel`, `text-fg`, `border-line`, `bg-accent`) inside [`packages/webview`](./packages/webview) instead of raw Tailwind scales (`zinc-*`, `indigo-*`) or hex values—verified automatically by `palette-sweep.test.ts`.
3. Run the full verification suite before pushing:
   ```bash
   pnpm build && pnpm test && pnpm lint
   orca plugin validate packages/orca-plugin && orca plugin check packages/orca-plugin
   ```

---

## Changelog & License

- See [CHANGELOG.md](./CHANGELOG.md) for release notes.
- Released under the [MIT License](./LICENSE).
