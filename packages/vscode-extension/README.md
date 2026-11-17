# Retune for VS Code

<p align="center">
  <img src="../../docs/assets/retune-logo.svg" alt="Retune Logo" width="84" />
</p>

Visually edit React, Tailwind CSS, and `cva()` components right inside VS Code and Antigravity IDE, and write clean updates back to your `.tsx` and `.jsx` files.

## Features

- **Visual Stage (Split View or Editor Tab)**: Click elements in your component tree, drag width and height handles, edit text inline, preview `:hover` / `:focus` / `:active` states, compare `cva()` combinations in the Variant Matrix, and check WCAG contrast and touch-target sizes.
- **Inspector Sidebar**: Stay synced with your cursor in code, adjust layout, spacing, typography, colors, and shadows, edit or add `cva()` variants, undo/redo up to 100 steps, and press `Ctrl+S` (`Cmd+S`) to save.
- **Minimal Source Edits**: Updates only the exact Tailwind `className` and `cva()` strings you changed so comments, imports, formatting, and helpers like `cn()` or `clsx()` stay untouched.
- **Inline CodeLenses & Context Menus**: Open the Stage from right-click menus or click **Retune: Tune `<Component />` in Stage** directly above your components and `cva()` calls.

## Commands

| Command | Shortcut | Description |
| :--- | :--- | :--- |
| `Retune: Open Visual Stage` | `Ctrl+Shift+R` / `Cmd+Shift+R` | Opens The Stage using your `retune.stage.openMode` setting. |
| `Retune: Tune Component in Stage` | Editor Right-Click / CodeLens | Opens The Stage focused on the component or element under your cursor. |
| `Retune: Open Visual Stage in Editor Tab` | Editor Title Bar | Opens The Stage in a full editor tab. |
| `Retune: Open Visual Stage in Split Editor` | Context Submenu / Palette | Opens The Stage beside your active `.tsx` or `.jsx` file. |
| `Retune: Inspect Component AST & Props` | Context Submenu / CodeLens | Opens the extracted `cva()` variants and TypeScript props view. |
| `Retune: Open Scalar API Console Tab` | Context Submenu / Palette | Opens the local Scalar OpenAPI reference tab. |

## License

[MIT](../../LICENSE)
