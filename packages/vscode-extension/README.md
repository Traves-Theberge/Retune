# Retune for VS Code

<p align="center">
  <img src="./resources/retune-logo.svg" alt="Retune Logo" width="84" />
</p>

**Visually edit your React and Tailwind CSS components right inside VS Code and Antigravity IDE, and save changes straight to your code.**

## What It Does

- **Edit directly on the canvas**: Open any `.tsx` or `.jsx` component or page beside your code or in a full tab. Click elements to select them, drag handles to resize width and height, double-click text to edit labels in place, and preview mobile, tablet, or desktop sizes.
- **Fine-tune styles, states & variants**: Adjust spacing, layout, typography, colors, borders, and shadows from quick popovers or the Activity Bar inspector. Toggle `:hover`, `:focus`, and `:active` states live, edit or create `cva()` variants, compare every variant side by side in the Variant Matrix, and view live contrast checks.
- **Save clean diffs**: Undo and redo up to 100 edits, hold to compare against your saved file, and press `Ctrl+S` (`Cmd+S`) to save. Only the class strings you edited change—your comments, imports, formatting, and `cn()` / `clsx()` helpers stay intact.
- **Launch from anywhere in your code**: Jump straight to any element with cursor sync, click inline links above components and `cva()` calls, or right-click in the editor.

## How to Use It

1. Open any `.tsx` or `.jsx` file.
2. Press **`Ctrl+Shift+R`** (`Cmd+Shift+R` on macOS), right-click a component and pick **Retune: Tune Component in Stage**, or click the **Retune** icon in the Activity Bar.
3. Click elements on the canvas or in the sidebar to tune their styles, then press **`Ctrl+S`** (`Cmd+S`) to save back to your file.

## Commands

| Command | Shortcut | Description |
| :--- | :--- | :--- |
| `Retune: Open Visual Stage` | `Ctrl+Shift+R` / `Cmd+Shift+R` | Opens the visual canvas using your preferred layout (`split` or `tab`). |
| `Retune: Tune Component in Stage` | Editor Right-Click / CodeLens | Opens the canvas focused on the component or element under your cursor. |
| `Retune: Open Visual Stage in Editor Tab` | Editor Title Bar | Opens the visual canvas in a full editor tab. |
| `Retune: Open Visual Stage in Split Editor` | Context Submenu / Palette | Opens the visual canvas beside your active code file. |
| `Retune: Inspect Component AST & Props` | Context Submenu / CodeLens | Opens the component props, variants, and source inspection tab. |
| `Retune: Open Scalar API Console Tab` | Context Submenu / Palette | Opens the built-in local API reference console. |

## License

[MIT](../../LICENSE)
