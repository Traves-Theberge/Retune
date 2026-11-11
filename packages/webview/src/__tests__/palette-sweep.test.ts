import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '..');
const EXCLUDED = new Set([
  '__tests__/',
  'components/controls.tsx',
  'components/ui/color-field.tsx',
  'state/demo.ts',
  'styles.css',
]);
const FORBIDDEN =
  /\b(zinc|indigo|rose|emerald|amber|sky|violet)-\d|#[0-9a-fA-F]{6}\b|text-\[(?:[0-9]|10)px\]/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function relative(file: string): string {
  return path.relative(SRC_ROOT, file).split(path.sep).join('/');
}

describe('palette sweep', () => {
  it('uses token utilities only and no sub-11px text outside the allowed files', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(file);
      if (!/\.tsx?$/.test(rel)) continue;
      if ([...EXCLUDED].some((ex) => (ex.endsWith('/') ? rel.startsWith(ex) : rel === ex))) continue;
      fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((text, i) => {
        if (FORBIDDEN.test(text)) offenders.push(`${rel}:${i + 1}: ${text.trim()}`);
      });
    }
    expect(offenders, `Offending lines:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('keeps only the use-is-dark hook and no viewport-frame component', () => {
    expect(fs.readdirSync(path.join(SRC_ROOT, 'hooks'))).toEqual(['use-is-dark.ts']);
    expect(fs.existsSync(path.join(SRC_ROOT, 'components', 'stage', 'viewport-frame.tsx'))).toBe(false);
  });
});
