import { createRetuneDaemon } from './server/daemon';

const port = Number(process.env.RETUNE_PORT || 49221);
const server = createRetuneDaemon(port);

server.on('listening', () => {
  console.log(`[Retune Daemon] Listening on http://127.0.0.1:${port}`);
  console.log(`[Retune Daemon] OpenAPI Spec: http://127.0.0.1:${port}/v1/openapi.json`);
});

