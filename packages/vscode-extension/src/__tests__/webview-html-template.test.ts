import { describe, it, expect } from 'vitest';
import { buildCsp, renderWebviewHtml } from '../providers/webview-html-template';

const base = { cspSource: 'vscode-webview://x', nonce: 'N0NCE', viewMode: 'sidebar' as const, scriptSrc: 'vscode-webview://x/app.js' };

describe('webview html', () => {
  it('builds the exact CSP', () => {
    expect(buildCsp(base)).toBe(
      "default-src 'none'; img-src vscode-webview://x https: data:; font-src vscode-webview://x https: data:; " +
      "style-src vscode-webview://x 'unsafe-inline'; script-src 'nonce-N0NCE' vscode-webview://x; " +
      'connect-src http://127.0.0.1:* http://localhost:* ws://localhost:*; worker-src blob:'
    );
    expect(buildCsp({ ...base, devOrigin: 'http://localhost:5173' })).toContain("script-src 'nonce-N0NCE' vscode-webview://x http://localhost:5173;");
  });
  it('renders nonce-tagged scripts and no CDN', () => {
    const html = renderWebviewHtml({ ...base, styleHref: 'vscode-webview://x/app.css', baseHref: 'vscode-webview://x/' });
    expect(html).toContain('window.RETUNE_VIEW_MODE = "sidebar"');
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).not.toContain('cdn.tailwindcss.com');
    expect(html).toContain('<body>');
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBe(2);
    for (const s of scripts) expect(s).toContain('nonce="N0NCE"');
  });
});
