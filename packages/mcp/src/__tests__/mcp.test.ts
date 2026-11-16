import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { inspectComponentTool } from '../tools/inspect-component';
import { mutateClassTool, mutateCvaVariantTool } from '../tools/mutate-class';

describe('@retune/mcp tools', () => {
  it('inspects and mutates a component TSX file on disk including CVA variants', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'retune-mcp-'));
    const filePath = path.join(tmpDir, 'Button.tsx');
    const initialSource = `import { cva } from "class-variance-authority";
const buttonVariants = cva("rounded px-2", {
  variants: { size: { sm: "text-xs", lg: "text-lg" } },
  defaultVariants: { size: "sm" }
});
export function Button() {
  return <button className="rounded px-2"><span>Click</span></button>;
}
`;
    await fs.writeFile(filePath, initialSource, 'utf-8');

    const meta = await inspectComponentTool(filePath);
    expect(meta.hasCva).toBe(true);
    expect(meta.baseClasses).toBe('rounded px-2');
    expect(meta.variants.size).toEqual(['sm', 'lg']);
    expect(meta.elements.map((e) => e.name)).toEqual(['button', 'span']);
    expect(meta.previewTree?.children[0]?.tag).toBe('span');

    const updated = await mutateClassTool(filePath, 'Button', 'rounded px-2 shadow-2xl');
    expect(updated).toContain('className="rounded px-2 shadow-2xl"');

    const withVariant = await mutateCvaVariantTool(filePath, 'size', 'xl', {
      newClasses: 'h-12 px-8',
      setAsDefault: true,
    });
    expect(withVariant).toContain('xl: "h-12 px-8"');
    expect(withVariant).toContain('size: "xl"');

    const diskContent = await fs.readFile(filePath, 'utf-8');
    expect(diskContent).toContain('className="rounded px-2 shadow-2xl"');
    expect(diskContent).toContain('xl: "h-12 px-8"');

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});

