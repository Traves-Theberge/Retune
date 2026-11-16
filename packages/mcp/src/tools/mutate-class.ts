import * as fs from 'node:fs/promises';
import {
  listElements,
  mutateClassName,
  mutateCvaBase,
  mutateCvaVariant,
  mutateDefaultVariant,
} from '@retune/core';

export interface MutateClassOptions {
  targetIndex?: number;
  cvaBase?: boolean;
  cvaVariant?: { group: string; key: string };
}

export async function mutateClassTool(
  filePath: string,
  componentName: string,
  newClasses: string,
  options: MutateClassOptions = {}
): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  let updated: string;
  if (options.cvaVariant) {
    updated = mutateCvaVariant(content, options.cvaVariant.group, options.cvaVariant.key, newClasses);
  } else if (options.cvaBase) {
    updated = mutateCvaBase(content, newClasses);
  } else if (typeof options.targetIndex === 'number' && componentName) {
    const matches = listElements(content).filter((el) => el.name === componentName);
    const target = matches[options.targetIndex];
    updated = mutateClassName(content, componentName, newClasses, target?.start);
  } else {
    updated = mutateClassName(content, componentName, newClasses);
  }
  await fs.writeFile(filePath, updated, 'utf-8');
  return updated;
}

export async function mutateCvaVariantTool(
  filePath: string,
  variantGroup: string,
  variantKey: string,
  options: { newClasses?: string; setAsDefault?: boolean } = {}
): Promise<string> {
  let content = await fs.readFile(filePath, 'utf-8');
  if (typeof options.newClasses === 'string') {
    content = mutateCvaVariant(content, variantGroup, variantKey, options.newClasses);
  }
  if (options.setAsDefault) {
    content = mutateDefaultVariant(content, variantGroup, variantKey);
  }
  await fs.writeFile(filePath, content, 'utf-8');
  return content;
}
