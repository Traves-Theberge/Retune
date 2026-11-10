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

// 2. Package a portable .vsix archive and install via Antigravity IDE CLI if present
try {
  const vsixStaging = path.join(extRoot, '.vsix-staging');
  const vsixExtDir = path.join(vsixStaging, 'extension');
  const vsixPath = path.join(extRoot, `${pkg.name}-${pkg.version}.vsix`);
  const zipPath = path.join(extRoot, `${pkg.name}-${pkg.version}.zip`);

  fs.rmSync(vsixStaging, { recursive: true, force: true });
  fs.rmSync(vsixPath, { force: true });
  fs.rmSync(zipPath, { force: true });
  fs.mkdirSync(vsixExtDir, { recursive: true });

  for (const item of filesToCopy) {
    const src = path.join(extRoot, item);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(vsixExtDir, item), { recursive: true });
    }
  }

  fs.writeFileSync(
    path.join(vsixStaging, '[Content_Types].xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".css" ContentType="text/css"/>
  <Default Extension=".html" ContentType="text/html"/>
  <Default Extension=".svg" ContentType="image/svg+xml"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>`
  );

  fs.writeFileSync(
    path.join(vsixStaging, 'extension.vsixmanifest'),
    `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${pkg.name}" Version="${pkg.version}" Publisher="${pkg.publisher}" />
    <DisplayName>${pkg.displayName.replace(/&/g, '&amp;')}</DisplayName>
    <Description xml:space="preserve">${pkg.description.replace(/&/g, '&amp;')}</Description>
    <Tags>${(pkg.keywords || []).join(',')}</Tags>
    <Categories>${(pkg.categories || []).join(',')}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${pkg.engines.vscode}" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>`
  );

  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${vsixStaging}\\*' -DestinationPath '${zipPath}' -Force`,
      ],
      { stdio: 'ignore' }
    );
    fs.renameSync(zipPath, vsixPath);
    console.log(`[retune-vscode] Packaged VSIX: ${vsixPath}`);

    const agyIdeCmd = path.join(
      process.env.LOCALAPPDATA || '',
      'Programs',
      'Antigravity IDE',
      'bin',
      'antigravity-ide.cmd'
    );
    if (fs.existsSync(agyIdeCmd)) {
      execFileSync('cmd.exe', ['/c', agyIdeCmd, '--install-extension', vsixPath, '--force'], {
        stdio: 'inherit',
      });
    }
  }
  fs.rmSync(vsixStaging, { recursive: true, force: true });
} catch (err) {
  console.warn('[retune-vscode] VSIX step warning:', err.message);
}
