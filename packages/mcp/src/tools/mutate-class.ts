import * as fs from 'node:fs/promises';
import { mutateClassName } from '@retune/core';

export async function mutateClassTool(
  filePath: string,
  componentName: string,
  newClasses: string
): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  const updated = mutateClassName(content, componentName, newClasses);
  await fs.writeFile(filePath, updated, 'utf-8');
  return updated;
}

