export interface WebviewHtmlOptions {
  cspSource: string;
  nonce: string;
  viewMode: 'editor-tab' | 'sidebar';
  scriptSrc: string;
  styleHref?: string;
  baseHref?: string;
  devOrigin?: string;
}

export function buildCsp(o: { cspSource: string; nonce: string; devOrigin?: string }): string {
  const devPart = o.devOrigin ? ` ${o.devOrigin}` : ``;
  return (
    `default-src 'none'; img-src ${o.cspSource} https: data:; font-src ${o.cspSource} https: data:; ` +
    `style-src ${o.cspSource} 'unsafe-inline'; script-src 'nonce-${o.nonce}' ${o.cspSource}${devPart}; ` +
    `connect-src http://127.0.0.1:* http://localhost:* ws://localhost:*; worker-src blob:`
  );
}

export function renderWebviewHtml(o: WebviewHtmlOptions): string {
  const csp = buildCsp({ cspSource: o.cspSource, nonce: o.nonce, devOrigin: o.devOrigin });
  const baseTag = o.baseHref ? `<base href="${o.baseHref}" />` : '';
  const styleTag = o.styleHref ? `<link rel="stylesheet" href="${o.styleHref}" />` : '';

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="Content-Security-Policy" content="${csp}" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      ${baseTag}
      <title>Retune</title>
      ${styleTag}
      <script nonce="${o.nonce}">
        window.RETUNE_VIEW_MODE = "${o.viewMode}";
        const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;
        window.vscode = vscode;
      </script>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" nonce="${o.nonce}" src="${o.scriptSrc}"></script>
    </body>
  </html>`;
}
