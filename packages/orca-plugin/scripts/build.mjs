import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..');
const webviewDist = path.resolve(pluginRoot, '..', 'webview', 'dist');
const outDir = path.join(pluginRoot, 'webview');
const outAssets = path.join(outDir, 'assets');
const require = createRequire(import.meta.url);
const { collectWorkspaceCss } = require(
  path.resolve(pluginRoot, '..', 'engine', 'dist', 'bundler', 'project-resolver.js')
);

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.claude',
  '.turbo',
  '.next',
  '.orca',
  'dist',
  'build',
  'coverage',
  'webview',
  'webview-dist',
  'target',
  'tests',
  'test',
  '__tests__',
  'e2e',
  'fixtures',
  'public',
  '.storybook',
  'storybook-static',
]);

const MAX_INDEX_BYTES = 11_000_000;
const MAX_PROJECT_BYTES = 2_000_000;
const normSlashes = (p) => path.resolve(p).replace(/\\/g, '/');

function buildWorkspaceIndex() {
  const repoRoot = path.resolve(pluginRoot, '..', '..');
  const projectsParent = path.dirname(repoRoot);
  const roots = [repoRoot];

  const grandParent = path.dirname(projectsParent);
  if (projectsParent !== repoRoot && grandParent !== projectsParent) {
    try {
      const siblingDirs = fs
        .readdirSync(projectsParent, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
        .map((e) => path.join(projectsParent, e.name))
        .filter((dir) => path.resolve(dir) !== path.resolve(repoRoot) && fs.existsSync(path.join(dir, 'package.json')))
        .sort((a, b) => {
          try {
            return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
          } catch {
            return 0;
          }
        })
        .slice(0, 15);
      roots.push(...siblingDirs);
    } catch {
      // Ignore unreadable parent directory
    }
  }

  const files = {};
  const sampleFileByDir = new Map();
  let totalBytes = 0;

  for (const root of roots) {
    if (totalBytes >= MAX_INDEX_BYTES) break;
    const stack = [root];
    let projectBytes = 0;
    let count = 0;
    while (stack.length > 0 && count < 1500 && projectBytes < MAX_PROJECT_BYTES && totalBytes < MAX_INDEX_BYTES) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (count >= 1500 || projectBytes >= MAX_PROJECT_BYTES || totalBytes >= MAX_INDEX_BYTES) break;
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && !SKIP_DIRS.has(entry.name)) {
            stack.push(path.join(dir, entry.name));
          }
          continue;
        }
        if (!entry.isFile()) continue;
        const isSvg = /\.svg$/i.test(entry.name);
        const isComp = /\.(tsx|jsx)$/i.test(entry.name);
        if (!isSvg && !isComp) continue;
        const abs = path.join(dir, entry.name);
        try {
          const stat = fs.statSync(abs);
          if (stat.size > (isSvg ? 20_000 : 80_000)) continue;
          const raw = fs.readFileSync(abs, 'utf8');
          const key = normSlashes(abs);
          const stored = isSvg ? `data:image/svg+xml;utf8,${encodeURIComponent(raw)}` : raw;
          if (totalBytes + stored.length > MAX_INDEX_BYTES) continue;
          files[key] = stored;
          projectBytes += stored.length;
          totalBytes += stored.length;
          if (isComp) {
            const normDir = normSlashes(dir);
            if (!sampleFileByDir.has(normDir)) {
              sampleFileByDir.set(normDir, abs);
            }
          }
          count += 1;
        } catch {
          // Skip unreadable file
        }
      }
    }
  }

  // Sort directories shallow-first so child folders inherit identical ancestor CSS cleanly
  const sortedDirs = [...sampleFileByDir.entries()].sort((a, b) => a[0].length - b[0].length);
  const cssByDir = {};
  for (const [normDir, sampleFile] of sortedDirs) {
    if (totalBytes >= MAX_INDEX_BYTES) break;
    try {
      const sampleSource = fs.readFileSync(sampleFile, 'utf8');
      const scoped = collectWorkspaceCss(sampleFile, sampleSource);
      if (!scoped) continue;
      // Check if an ancestor within 3 levels already holds the identical scoped CSS
      const parts = normDir.split('/');
      parts.pop();
      let inherited = false;
      for (let i = 0; i < 3 && parts.length > 0; i++) {
        const ancestorCss = cssByDir[parts.join('/')];
        if (ancestorCss !== undefined) {
          if (ancestorCss === scoped) inherited = true;
          break;
        }
        if (parts.length === 1) break;
        parts.pop();
      }
      if (!inherited && totalBytes + scoped.length <= MAX_INDEX_BYTES) {
        cssByDir[normDir] = scoped;
        totalBytes += scoped.length;
      }
    } catch {
      // Skip unreadable stylesheet
    }
  }

  return { files, cssByDir };
}

if (!fs.existsSync(path.join(webviewDist, 'assets'))) {
  throw new Error(
    `[retune-orca] Missing built webview assets at ${webviewDist}. Run "pnpm --filter @retune/webview build" first.`
  );
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outAssets, { recursive: true });
fs.cpSync(path.join(webviewDist, 'assets'), outAssets, { recursive: true });

const assetFiles = fs.readdirSync(outAssets);
const jsFile =
  assetFiles.find((f) => f.startsWith('index-') && f.endsWith('.js')) ||
  assetFiles.find((f) => f.endsWith('.js'));
const cssFile =
  assetFiles.find((f) => f.startsWith('index-') && f.endsWith('.css')) ||
  assetFiles.find((f) => f.endsWith('.css'));

if (!jsFile) {
  throw new Error('[retune-orca] Could not find JS bundle in webview/dist/assets');
}

function buildHtml(mode, title) {
  const styleTag = cssFile ? `\n    <link rel="stylesheet" href="./assets/${cssFile}" />` : '';
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>${styleTag}
    <script>
      window.RETUNE_VIEW_MODE = ${JSON.stringify(mode)};
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script src="./workspace-index.js"></script>
    <script type="module" src="./assets/${jsFile}"></script>
  </body>
</html>
`;
}

const workspaceIndex = buildWorkspaceIndex();
fs.writeFileSync(
  path.join(outDir, 'workspace-index.js'),
  `window.RETUNE_WORKSPACE_INDEX = ${JSON.stringify(workspaceIndex)};\n`,
  'utf8'
);

fs.writeFileSync(path.join(outDir, 'stage.html'), buildHtml('editor-tab', 'Retune'), 'utf8');
fs.writeFileSync(
  path.join(outDir, 'inspector.html'),
  buildHtml('sidebar', 'Retune Inspector'),
  'utf8'
);

console.log(
  `[retune-orca] Built Orca plugin webview entries (${jsFile}, ${cssFile ?? 'no css'}, ${Object.keys(workspaceIndex.files).length} workspace files)`
);
