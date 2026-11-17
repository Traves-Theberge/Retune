import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const pluginRoot = path.resolve(__dirname, '..', '..');

describe('@retune/orca-plugin manifest & bundle', () => {
  it('has a valid Format 2 orca-plugin.json manifest with required contributions', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, 'orca-plugin.json'), 'utf8')
    );
    expect(manifest.manifestVersion).toBe(2);
    expect(manifest.id).toBe('retune');
    expect(manifest.execution).toBe('sandboxed-ui');
    expect(manifest.contributes.customEditors[0].extensions).toEqual(['.tsx', '.jsx']);
    expect(manifest.contributes.panels[0].id).toBe('retune-inspector');
    expect(manifest.capabilities).toEqual([
      { kind: 'settings:own' },
      { kind: 'storage:own' },
    ]);
  });

  it('generates offline stage.html and inspector.html with relative local assets and no CDN/base tags', () => {
    const stageHtml = fs.readFileSync(path.join(pluginRoot, 'webview', 'stage.html'), 'utf8');
    const inspectorHtml = fs.readFileSync(path.join(pluginRoot, 'webview', 'inspector.html'), 'utf8');

    expect(stageHtml).toContain('window.RETUNE_VIEW_MODE = "editor-tab"');
    expect(inspectorHtml).toContain('window.RETUNE_VIEW_MODE = "sidebar"');

    for (const html of [stageHtml, inspectorHtml]) {
      expect(html).not.toContain('cdn.tailwindcss.com');
      expect(html).not.toContain('<base ');
      expect(html).toContain('./assets/index-');
    }

    const assetFiles = fs.readdirSync(path.join(pluginRoot, 'webview', 'assets'));
    expect(assetFiles.some((f) => f.endsWith('.js'))).toBe(true);
    expect(assetFiles.some((f) => f.endsWith('.css'))).toBe(true);
  });
});
