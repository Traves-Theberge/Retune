import http from 'node:http';
import {
  applyEdits,
  computeClassNameEdit,
  computeTextEdit,
  listElements,
  mutateCvaBase,
  mutateCvaVariant,
  mutateDefaultVariant,
  openApiSpec,
} from '@retune/core';
import { inspectComponentFile } from '../bundler/project-resolver';

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
          const { fileContent, filePath = '' } = JSON.parse(body);
          const inspected = inspectComponentFile(fileContent, filePath);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              cva: inspected.cva,
              props: inspected.props,
              elements: inspected.elements,
              previewTree: inspected.previewTree,
              ...(inspected.workspaceCss ? { workspaceCss: inspected.workspaceCss } : {}),
            })
          );
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
          const {
            fileContent,
            componentName = '',
            targetIndex,
            cvaBase,
            cvaVariant,
            defaultVariant,
            className,
            text,
          } = JSON.parse(body);
          let updated: string;
          if (defaultVariant?.group && defaultVariant?.value !== undefined) {
            updated = mutateDefaultVariant(fileContent, defaultVariant.group, defaultVariant.value);
          } else if (cvaVariant?.group && cvaVariant?.key) {
            updated = mutateCvaVariant(fileContent, cvaVariant.group, cvaVariant.key, className ?? '');
          } else if (cvaBase) {
            updated = mutateCvaBase(fileContent, className ?? '');
          } else {
            const target =
              typeof targetIndex === 'number' && componentName
                ? { offset: listElements(fileContent).filter((el) => el.name === componentName)[targetIndex]?.start }
                : { name: componentName };
            let next = fileContent;
            if (typeof className === 'string') {
              next = applyEdits(next, computeClassNameEdit(next, target, className));
            }
            if (typeof text === 'string') {
              const textTarget =
                typeof targetIndex === 'number' && componentName
                  ? { offset: listElements(next).filter((el) => el.name === componentName)[targetIndex]?.start }
                  : { name: componentName };
              next = applyEdits(next, computeTextEdit(next, textTarget, text));
            }
            updated = next;
          }
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

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Retune Daemon] Port ${port} is already in use; reusing existing daemon.`);
    } else {
      console.warn('[Retune Daemon] Server error:', err.message);
    }
  });

  server.listen(port, '127.0.0.1');
  return server;
}

