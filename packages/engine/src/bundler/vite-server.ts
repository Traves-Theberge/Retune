import { createServer, ViteDevServer } from 'vite';
import { resolveWorkspaceAlias } from './module-resolver';

export interface SandboxServerOptions {
  workspaceRoot: string;
  port?: number;
}

export async function createSandboxViteServer(
  options: SandboxServerOptions
): Promise<ViteDevServer> {
  const { workspaceRoot, port = 5174 } = options;

  const server = await createServer({
    root: workspaceRoot,
    server: {
      port,
      host: '127.0.0.1',
      hmr: true,
    },
    plugins: [
      {
        name: 'retune-workspace-resolver',
        resolveId(source) {
          const resolved = resolveWorkspaceAlias(source, workspaceRoot);
          return resolved ? resolved.resolvedPath : null;
        },
      },
    ],
  });

  return server;
}

