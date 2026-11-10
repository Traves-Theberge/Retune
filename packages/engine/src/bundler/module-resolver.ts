import * as path from 'node:path';

export interface ResolvedModule {
  id: string;
  resolvedPath: string;
}

export function resolveWorkspaceAlias(importee: string, workspaceRoot: string): ResolvedModule | null {
  if (importee.startsWith('@/')) {
    const relativePath = importee.slice(2);
    return {
      id: importee,
      resolvedPath: path.resolve(workspaceRoot, 'src', relativePath),
    };
  }
  return null;
}

