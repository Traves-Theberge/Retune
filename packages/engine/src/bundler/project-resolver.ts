import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyzeProps,
  extractCvaMetadata,
  extractPreviewTree,
  listElements,
  type ComponentMetadata,
  type PreviewTreeOptions,
  type ResolvedImport,
} from '@retune/core';

const RESOLVE_EXTENSIONS = ['', '.tsx', '.jsx', '.ts', '.js', '/index.tsx', '/index.jsx', '/index.ts', '/index.js'];
const CSS_DEFAULTS = ['styles.css', 'index.css', 'app.css', 'globals.css'];
const MAX_CSS_CHARS = 180_000;

export function createImportResolver(entryFile: string): PreviewTreeOptions['resolveImport'] {
  const fileCache = new Map<string, string | null>();
  const readCached = (filePath: string): string | null => {
    if (fileCache.has(filePath)) return fileCache.get(filePath)!;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      fileCache.set(filePath, content);
      return content;
    } catch {
      fileCache.set(filePath, null);
      return null;
    }
  };

  return (specifier: string, fromId?: string): ResolvedImport | null => {
    if (!specifier.startsWith('.')) return null;
    const baseDir = path.dirname(fromId || entryFile);
    const targetBase = path.resolve(baseDir, specifier);

    if (/\.(svg|png|jpe?g|webp|gif)$/i.test(specifier)) {
      if (specifier.toLowerCase().endsWith('.svg') && fs.existsSync(targetBase) && fs.statSync(targetBase).isFile()) {
        const raw = readCached(targetBase);
        return raw ? { id: targetBase, source: raw } : null;
      }
      return null;
    }

    for (const ext of RESOLVE_EXTENSIONS) {
      const candidate = targetBase + ext;
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          const content = readCached(candidate);
          if (content !== null) return { id: candidate, source: content };
        }
      } catch {
        // Ignore inaccessible paths
      }
    }
    return null;
  };
}

function splitSelectors(raw: string): string[] {
  const out: string[] = [];
  let cur = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function scopeSelectorList(selectorsRaw: string, scopeClass: string): string {
  return splitSelectors(selectorsRaw)
    .map((sel) => {
      if (/^(:root|html|body)$/i.test(sel)) return scopeClass;
      if (/^(:root|html|body)\b/i.test(sel)) {
        return sel.replace(/^(:root|html|body)\b/i, scopeClass);
      }
      return `${scopeClass} ${sel}`;
    })
    .join(', ');
}

function findMatchingBrace(css: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length - 1;
}

/**
 * Prefix project CSS selectors with `.retune-preview-scope` so component styles work
 * cleanly in The Stage without leaking into Retune's own UI chrome.
 */
export function scopePreviewCss(rawCss: string, scopeClass = '.retune-preview-scope'): string {
  const stripped = rawCss
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@import\s+[^;]+;/g, '');

  const topLevelAtRules: string[] = [];
  const rewriteBlock = (input: string): string => {
    let out = '';
    let i = 0;
    while (i < input.length) {
      const nextBrace = input.indexOf('{', i);
      const nextSemi = input.indexOf(';', i);
      if (nextBrace === -1) {
        out += input.slice(i);
        break;
      }
      if (nextSemi !== -1 && nextSemi < nextBrace) {
        out += input.slice(i, nextSemi + 1);
        i = nextSemi + 1;
        continue;
      }

      const header = input.slice(i, nextBrace).trim();
      const closeIdx = findMatchingBrace(input, nextBrace);
      const body = input.slice(nextBrace + 1, closeIdx);
      i = closeIdx + 1;

      if (!header) continue;
      if (/^@(-webkit-)?keyframes\b|^@font-face\b|^@property\b/i.test(header)) {
        topLevelAtRules.push(`${header}{${body}}`);
      } else if (/^@(media|supports|layer|container)\b/i.test(header)) {
        out += `${header}{${rewriteBlock(body)}}`;
      } else if (header.startsWith('@')) {
        topLevelAtRules.push(`${header}{${body}}`);
      } else {
        const scopedSel = scopeSelectorList(header, scopeClass);
        const normalizedBody = body.replace(/\b100d?vh\b/gi, '100%');
        out += `${scopedSel}{${normalizedBody}}`;
      }
    }
    return out;
  };

  const layeredRules = rewriteBlock(stripped);
  const parts = [...topLevelAtRules];
  if (layeredRules.trim()) parts.push(`@layer components {${layeredRules}}`);
  return parts.join('\n');
}

export function collectWorkspaceCss(entryFile: string, sourceText: string): string {
  if (!entryFile) return '';
  const dir = path.dirname(entryFile);
  const cssFiles: string[] = [];
  const seen = new Set<string>();
  const addCss = (candidate: string) => {
    const abs = path.resolve(candidate);
    if (seen.has(abs)) return;
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        seen.add(abs);
        cssFiles.push(abs);
      }
    } catch {
      // Ignore missing CSS files
    }
  };

  // Discover shared app stylesheet in current or ancestor directories (up to 2 levels up)
  let walkDir = dir;
  const baseCandidates: string[] = [];
  for (let level = 0; level < 3; level++) {
    for (const file of CSS_DEFAULTS) {
      const cand = path.join(walkDir, file);
      if (fs.existsSync(cand)) baseCandidates.unshift(cand);
    }
    const parent = path.dirname(walkDir);
    if (parent === walkDir) break;
    walkDir = parent;
  }
  baseCandidates.forEach(addCss);

  // Explicit component CSS imports (e.g. `import './task-wizard.css';`) loaded after shared styles
  const cssImportRe = /import\s+(?:[^'"]+\s+from\s+)?['"](\.[^'"]+\.css)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = cssImportRe.exec(sourceText)) !== null) {
    addCss(path.resolve(dir, m[1]));
  }

  if (cssFiles.length === 0) return '';
  let combined = '';
  for (const file of cssFiles) {
    try {
      const scoped = scopePreviewCss(fs.readFileSync(file, 'utf8'));
      if (combined.length + scoped.length <= MAX_CSS_CHARS) {
        combined += scoped + '\n';
      }
    } catch {
      // Skip unreadable CSS file
    }
  }
  return combined.trim();
}

export function inspectComponentFile(
  sourceText: string,
  filePath = '',
  componentName = 'Component'
): ComponentMetadata {
  const resolveImport = filePath ? createImportResolver(filePath) : undefined;
  const workspaceCss = filePath ? collectWorkspaceCss(filePath, sourceText) : '';
  return {
    componentName,
    filePath,
    cva: extractCvaMetadata(sourceText),
    props: analyzeProps(sourceText),
    rawSource: sourceText,
    elements: listElements(sourceText),
    previewTree: extractPreviewTree(sourceText, {
      ...(filePath ? { sourceId: filePath } : {}),
      ...(resolveImport ? { resolveImport } : {}),
    }),
    ...(workspaceCss ? { workspaceCss } : {}),
  };
}
