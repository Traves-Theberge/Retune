import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.resolve(__dirname, '..');
const webviewDist = path.resolve(extRoot, '..', 'webview', 'dist');
const targetWebviewDist = path.join(extRoot, 'webview-dist');

// 1. Copy built webview assets into packages/vscode-extension/webview-dist
if (fs.existsSync(webviewDist)) {
  fs.rmSync(targetWebviewDist, { recursive: true, force: true });
  fs.cpSync(webviewDist, targetWebviewDist, { recursive: true });
  console.log('[retune-vscode] Copied webview build to webview-dist/');
}

// 2. Bundle dist/extension.js with @retune/core and @retune/engine inlined for standalone installation
try {
  const require = createRequire(import.meta.url);
  // Resolve esbuild from workspace
  const esbuild = require('esbuild');
  await esbuild.build({
    entryPoints: [path.join(extRoot, 'src', 'extension.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(extRoot, 'dist', 'extension.js'),
    external: ['vscode', 'vite'],
    sourcemap: true,
    logLevel: 'info',
  });
} catch (err) {
  console.warn('[retune-vscode] esbuild bundle fallback to tsc output:', err.message);
}

