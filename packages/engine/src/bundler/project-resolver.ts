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
const MAX_CSS_CHARS = 400_000;

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

function rewriteMediaHeader(header: string): string {
  if (!/^@media\b/i.test(header)) return header;
  const cond = header.slice('@media'.length).trim();
  if (!/\b(?:min-width|max-width|width)\b/i.test(cond)) return header;
  if (/\b(?:prefers-reduced-motion|prefers-color-scheme|pointer|any-pointer|hover|any-hover|print|speech)\b/i.test(cond)) {
    return header;
  }
  const normalized = cond.replace(/^(?:only\s+)?(?:all|screen)\s+and\s+/i, '').trim();
  return normalized ? `@container retune-stage ${normalized}` : header;
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
        const rewrittenHeader = rewriteMediaHeader(header);
        out += `${rewrittenHeader}{${rewriteBlock(body)}}`;
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

  const scopedRules = rewriteBlock(stripped);
  const parts = [...topLevelAtRules];
  if (scopedRules.trim()) parts.push(scopedRules);
  return parts.join('\n');
}

const PREVIEW_SHELL_OVERRIDES =
  '.retune-preview-scope .app-shell > .sidebar { position: sticky; top: 0; height: auto; min-height: 100%; align-self: stretch; }\n' +
  '.retune-preview-scope .main-column { margin-left: 0; }';

export function collectWorkspaceCss(entryFile: string, sourceText: string): string {
  if (!entryFile) return '';
  const dir = path.dirname(entryFile);
  const cssFiles: string[] = [];
  const seen = new Set<string>();
  const cssImportRe = /import\s+(?:[^'"]+\s+from\s+)?['"](\.[^'"]+\.css)['"]/g;
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
  const collectImportsFromSource = (baseDir: string, text: string) => {
    cssImportRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = cssImportRe.exec(text)) !== null) {
      addCss(path.resolve(baseDir, m[1]));
    }
  };

  // Discover shared app stylesheet and entry-point CSS imports across up to 3 ancestor levels
  let walkDir = dir;
  const baseCandidates: string[] = [];
  const entryCandidates: string[] = [];
  for (let level = 0; level < 3; level++) {
    for (const file of CSS_DEFAULTS) {
      const cand = path.join(walkDir, file);
      if (fs.existsSync(cand)) baseCandidates.unshift(cand);
    }
    for (const entryName of ['main.tsx', 'main.jsx', 'App.tsx', 'App.jsx', 'index.tsx']) {
      const entryCand = path.join(walkDir, entryName);
      if (fs.existsSync(entryCand)) entryCandidates.unshift(entryCand);
    }
    const parent = path.dirname(walkDir);
    if (parent === walkDir) break;
    walkDir = parent;
  }
  baseCandidates.forEach(addCss);
  for (const entryCand of entryCandidates) {
    try {
      collectImportsFromSource(path.dirname(entryCand), fs.readFileSync(entryCand, 'utf8'));
    } catch {
      // Ignore unreadable entry file
    }
  }

  // Sibling stylesheets in the component's own folder (excluding CSS Modules)
  try {
    const entries = fs.readdirSync(dir).filter((f) => f.endsWith('.css') && !f.endsWith('.module.css')).sort();
    for (const f of entries) {
      addCss(path.join(dir, f));
    }
  } catch {
    // Ignore unreadable directory
  }

  // Explicit component CSS imports (e.g. `import './task-wizard.css';`) loaded after shared styles
  collectImportsFromSource(dir, sourceText);

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
  if (!combined.trim()) return '';
  return `${combined.trim()}\n${PREVIEW_SHELL_OVERRIDES}`;
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
