import * as fs from 'node:fs/promises';
import {
  analyzeProps,
  extractCvaMetadata,
  extractPreviewTree,
  listElements,
  type CvaMetadata,
  type ElementInfo,
  type PreviewNode,
  type PropDefinition,
} from '@retune/core';

export interface InspectedComponentResult extends CvaMetadata {
  props: PropDefinition[];
  elements: ElementInfo[];
  previewTree: PreviewNode | null;
}

export async function inspectComponentTool(filePath: string): Promise<InspectedComponentResult> {
  const content = await fs.readFile(filePath, 'utf-8');
  return {
    ...extractCvaMetadata(content),
    props: analyzeProps(content),
    elements: listElements(content),
    previewTree: extractPreviewTree(content),
  };
}
