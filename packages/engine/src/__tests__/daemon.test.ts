import { describe, it, expect, afterAll } from 'vitest';
import { createRetuneDaemon } from '../server/daemon';
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

  it('inspects CVA components via POST /v1/components/inspect', async () => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/v1/components/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileContent: `const badgeVariants = cva("inline-flex", { variants: { tone: { info: "bg-blue-500" } }, defaultVariants: { tone: "info" } });`,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cva.hasCva).toBe(true);
    expect(data.cva.baseClasses).toBe('inline-flex');
    expect(data.cva.variants.tone).toEqual(['info']);
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
});

