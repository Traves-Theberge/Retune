import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..');
const webviewDist = path.resolve(pluginRoot, '..', 'webview', 'dist');
const outDir = path.join(pluginRoot, 'webview');
const outAssets = path.join(outDir, 'assets');

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
    <script type="module" src="./assets/${jsFile}"></script>
  </body>
</html>
`;
}

fs.writeFileSync(path.join(outDir, 'stage.html'), buildHtml('editor-tab', 'Retune'), 'utf8');
fs.writeFileSync(
  path.join(outDir, 'inspector.html'),
  buildHtml('sidebar', 'Retune Inspector'),
  'utf8'
);

console.log(`[retune-orca] Built Orca plugin webview entries (${jsFile}, ${cssFile ?? 'no css'})`);
