# Retune for VS Code

<p align="center">
  <img src="../../docs/assets/retune-logo.svg" alt="Retune Logo" width="84" />
</p>

**Retune** is a zero-config visual component tuner, CVA variant inspector, and Scalar-powered OpenAPI console built for React & Tailwind CSS workflows in VS Code and Antigravity IDE.

## Features

- **The Stage (Editor Tab & Split View)**: Inspect multi-element JSX hierarchies (`PreviewNode`), drag box-model width/height resize handles, simulate `:hover` / `:focus` / `:active` states, compare all `cva` variant combinations in the Variant Matrix, and view live WCAG contrast & touch-target badges.
- **Activity Bar Inspector Sidebar**: Pick any element from the Component/JSX element list (synced bidirectionally with your editor cursor), scrub numeric layout/typography tokens, edit or add new `cva()` variants, undo/redo up to 100 steps, and click **Sync** (`Ctrl/Cmd+S`).
- **Non-Lossy Minimal Splices (`@retune/core`)**: Computed with `@babel/parser` and applied as targeted `WorkspaceEdit` splices so comments, formatting, imports, and dynamic `cn()`/`clsx()` arguments remain untouched.
- **Inline CodeLenses & Context Menus**: Right-click any JSX file/component or click **Retune: Tune `<Component />` in Stage** directly above exported components and `cva(...)` calls.

## Commands

| Command | Shortcut | Description |
| :--- | :--- | :--- |
| `Retune: Open Visual Stage` | `Ctrl+Shift+R` / `Cmd+Shift+R` | Opens The Stage using your configured `retune.stage.openMode`. |
| `Retune: Tune Component in Stage` | Editor Right-Click / CodeLens | Targets the component or JSX element under your cursor in The Stage. |
| `Retune: Open Visual Stage in Editor Tab` | Editor Title Bar | Opens The Stage as an active Editor Tab. |
| `Retune: Open Visual Stage in Split Editor` | Context Submenu / Palette | Opens The Stage beside the active `.tsx` editor. |
| `Retune: Inspect Component AST & Props` | Context Submenu / CodeLens | Opens the extracted CVA AST, TypeScript props, and source view. |
| `Retune: Open Scalar API Console Tab` | Context Submenu / Palette | Opens the embedded Scalar OpenAPI 3.1 console tab. |

## License

[MIT](../../LICENSE)
