import * as fs from 'node:fs/promises';
import { extractCvaMetadata, CvaMetadata } from '@retune/core';

export async function inspectComponentTool(filePath: string): Promise<CvaMetadata> {
  const content = await fs.readFile(filePath, 'utf-8');
  return extractCvaMetadata(content);
}

