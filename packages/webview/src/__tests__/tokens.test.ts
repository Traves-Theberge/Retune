import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles.css'), 'utf8');
const TOKENS: Record<string, string> = {
  canvas: '--vscode-editor-background', panel: '--vscode-sideBar-background', raised: '--vscode-input-background',
  overlay: '--vscode-menu-background', line: '--vscode-panel-border', fg: '--vscode-foreground',
  muted: '--vscode-descriptionForeground', subtle: '--vscode-disabledForeground', accent: '--vscode-button-background',
  'accent-fg': '--vscode-button-foreground', 'accent-hover': '--vscode-button-hoverBackground', focus: '--vscode-focusBorder',
  hover: '--vscode-list-hoverBackground', active: '--vscode-list-activeSelectionBackground',
  'active-fg': '--vscode-list-activeSelectionForeground', danger: '--vscode-errorForeground',
  success: '--vscode-testing-iconPassed', warn: '--vscode-editorWarning-foreground',
};

describe('design tokens', () => {
  it('maps every --rt colour token from its VS Code variable with a fallback and exposes it to Tailwind', () => {
    for (const [name, source] of Object.entries(TOKENS)) {
      expect(css).toMatch(new RegExp(`--rt-${name}:\\s*var\\(${source},\\s*#[0-9a-fA-F]{6}\\)`));
      expect(css).toMatch(new RegExp(`--color-${name}:\\s*var\\(--rt-${name}\\)`));
    }
    expect(css).toMatch(/--rt-font:\s*var\(--vscode-font-family,/);
    expect(css).toMatch(/--rt-mono:\s*var\(--vscode-editor-font-family,/);
    expect(css).toContain('@theme inline');
  });
  it('no longer hardcodes the page colours', () => {
    expect(css).not.toMatch(/background-color:\s*#09090b/);
  });
});
