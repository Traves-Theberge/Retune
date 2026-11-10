import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(extRoot, 'package.json'), 'utf8'));

const home = process.env.USERPROFILE || process.env.HOME;
const extId = `${pkg.publisher}.${pkg.name}`;
const extFolderName = `${extId}-${pkg.version}`;

// 1. Copy extension files into ~/.antigravity-ide/extensions, ~/.antigravity/extensions, and ~/.vscode/extensions
const extensionRoots = [
  path.join(home, '.antigravity-ide', 'extensions'),
  path.join(home, '.antigravity', 'extensions'),
  path.join(home, '.vscode', 'extensions'),
];

const filesToCopy = [
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'resources',
  'dist',
  'webview-dist',
];

for (const rootDir of extensionRoots) {
  try {
    const targetDir = path.join(rootDir, extFolderName);
    fs.mkdirSync(rootDir, { recursive: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });

    for (const item of filesToCopy) {
      const src = path.join(extRoot, item);
      if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(targetDir, item), { recursive: true });
      }
    }

    // Also register in extensions.json if present so the IDE discovers it immediately
    const manifestPath = path.join(rootDir, 'extensions.json');
    let manifest = [];
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        manifest = [];
      }
    }
    manifest = manifest.filter((entry) => entry?.identifier?.id?.toLowerCase() !== extId.toLowerCase());
    manifest.push({
      identifier: { id: extId },
      version: pkg.version,
      location: {
        $mid: 1,
        fsPath: targetDir,
        _sep: 1,
        external: `file:///${targetDir.replace(/\\/g, '/')}`,
        path: `/${targetDir.replace(/\\/g, '/')}`,
        scheme: 'file',
      },
      relativeLocation: extFolderName,
      metadata: {
        installedTimestamp: Date.now(),
        source: 'vsix',
      },
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    console.log(`[retune-vscode] Installed & registered in: ${targetDir}`);
  } catch (err) {
    console.warn(`[retune-vscode] Could not install to ${rootDir}:`, err.message);
  }
}
