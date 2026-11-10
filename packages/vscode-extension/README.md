# Retune for VS Code

**Retune** is a zero-config visual component tuner, CVA variant inspector, and Scalar-powered OpenAPI console built for React & Tailwind CSS workflows in VS Code.

## Features

- **Editor Tab System (`The Stage`, `AST & Props`, `Scalar API`)**: Open the visual stage as a full Editor Tab (`Retune: Open Visual Stage in Editor Tab`) or split beside your code (`Retune: Open Visual Stage in Split Editor`).
- **Activity Bar Sidebar (`Params & Configuration`)**: Tune CVA variants (`Tone`), edit component TypeScript props in real time, toggle Tailwind utility tokens (`Harmonics`), and manage extension settings without leaving your editor.
- **Format-Preserving AST Mutations**: Powered by `recast` and `@babel/parser` so your comments, formatting, and imports remain untouched.
- **Inline CodeLens & Shortcuts**: Click `Retune: Open Visual Stage` directly above `cva(...)` declarations or press `Ctrl+Shift+R` (`Cmd+Shift+R` on macOS).

## Commands

| Command | Shortcut | Description |
| :--- | :--- | :--- |
| `Retune: Open Visual Stage` | `Ctrl+Shift+R` / `Cmd+Shift+R` | Opens The Stage using your configured `retune.stage.openMode`. |
| `Retune: Open Visual Stage in Editor Tab` | Editor Title Bar | Opens The Stage as an active Editor Tab. |
| `Retune: Open Visual Stage in Split Editor` | Command Palette | Opens The Stage beside the active `.tsx` editor. |
| `Retune: Open Scalar API Console Tab` | Context Menu | Opens the embedded Scalar OpenAPI 3.1 console tab. |

## License

[MIT](../../LICENSE)

