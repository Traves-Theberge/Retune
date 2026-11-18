import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRetuneDaemon } from '../server/daemon';
import { inspectComponentFile, scopePreviewCss } from '../bundler/project-resolver';
import type { AddressInfo } from 'node:net';

describe('@retune/engine HTTP Daemon', () => {
  const server = createRetuneDaemon(0);

  afterAll(() => {
    server.close();
  });

  const getBaseUrl = async () => {
    if (!server.listening) {
      await new Promise<void>((resolve) => server.once('listening', resolve));
    }
    const addr = server.address() as AddressInfo;
    return `http://127.0.0.1:${addr.port}`;
  };

  it('serves /v1/openapi.json', async () => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/v1/openapi.json`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.openapi).toBe('3.1.0');
    expect(json.info.title).toBe('Retune Engine API');
  });

  it('inspects CVA components, props, elements, and previewTree via POST /v1/components/inspect', async () => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/v1/components/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileContent: `const badgeVariants = cva("inline-flex", { variants: { tone: { info: "bg-blue-500" } }, defaultVariants: { tone: "info" } });
export interface BadgeProps { label: string; }
export function Badge({ label }: BadgeProps) { return <div className="p-1"><span className="text-xs">{label}</span></div>; }`,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cva.hasCva).toBe(true);
    expect(data.cva.baseClasses).toBe('inline-flex');
    expect(data.cva.variants.tone).toEqual(['info']);
    expect(data.props).toEqual([{ name: 'label', type: 'string', optional: false }]);
    expect(data.elements.length).toBe(2);
    expect(data.previewTree?.tag).toBe('div');
    expect(data.previewTree?.children[0]?.tag).toBe('span');
  });

  it('mutates JSX classes via POST /v1/components/mutate', async () => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/v1/components/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileContent: `export function Box() { return <div className="p-2">Hi</div>; }`,
        componentName: 'Box',
        className: 'p-4 shadow-xl',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.updatedContent).toContain('className="p-4 shadow-xl"');
  });

  it('mutates CVA variants via POST /v1/components/mutate', async () => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/v1/components/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileContent: `const v = cva("inline-flex", { variants: { tone: { info: "bg-blue-500" } } });`,
        cvaVariant: { group: 'tone', key: 'brand' },
        className: 'bg-purple-600 text-white',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.updatedContent).toContain('brand: "bg-purple-600 text-white"');
  });

  it('scopes project CSS unlayered and rewrites width media queries for retune-stage container queries', () => {
    const scoped = scopePreviewCss(
      ':root { --ink: #203b30; } body { margin: 0; } .hero-panel { min-height: 100dvh; } @media (max-width: 900px) { .app-shell { display: block; } } @media (prefers-reduced-motion: reduce) { .hero-panel { animation: none; } }'
    );
    expect(scoped).not.toContain('@layer components');
    expect(scoped).toContain('.retune-preview-scope{');
    expect(scoped).toContain('.retune-preview-scope .hero-panel');
    expect(scoped).toContain('@container retune-stage (max-width: 900px){.retune-preview-scope .app-shell');
    expect(scoped).toContain('@media (prefers-reduced-motion: reduce)');
    expect(scoped).toContain('100%');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retune-proj-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'styles.css'), '.panel-box { border-radius: 16px; }');
      fs.writeFileSync(path.join(tmpDir, 'Inner.tsx'), 'export function Inner() { return <section className="panel-box"><h2>Inner Page</h2></section>; }');
      const barrelPath = path.join(tmpDir, 'Index.tsx');
      const barrelSrc = `export { Inner as Page } from './Inner';`;
      fs.writeFileSync(barrelPath, barrelSrc);

      const meta = inspectComponentFile(barrelSrc, barrelPath, 'Index');
      expect(meta.previewTree?.tag).toBe('section');
      expect(meta.previewTree?.className).toBe('panel-box');
      expect(meta.workspaceCss).toContain('.retune-preview-scope .panel-box');
      expect(meta.workspaceCss).toContain('.retune-preview-scope > .tasks-page');
      expect(meta.workspaceCss).toContain('padding: 48px 40px');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

