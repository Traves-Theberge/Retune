import http from 'node:http';
import { extractCvaMetadata, mutateClassName, openApiSpec } from '@retune/core';

export function createRetuneDaemon(port = 49221) {
  const server = http.createServer((req, res) => {
    // CORS headers for Webview & local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

    // GET /v1/openapi.json -> Returns spec to Scalar
    if (req.method === 'GET' && url.pathname === '/v1/openapi.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(openApiSpec));
      return;
    }

    // POST /v1/components/inspect
    if (req.method === 'POST' && url.pathname === '/v1/components/inspect') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const { fileContent } = JSON.parse(body);
          const cvaMeta = extractCvaMetadata(fileContent);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ cva: cvaMeta }));
        } catch (err: any) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // POST /v1/components/mutate
    if (req.method === 'POST' && url.pathname === '/v1/components/mutate') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const { fileContent, componentName, className } = JSON.parse(body);
          const updated = mutateClassName(fileContent, componentName, className);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ updatedContent: updated, success: true }));
        } catch (err: any) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, '127.0.0.1');
  return server;
}

