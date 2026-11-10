# Engineering Architecture & Implementation Blueprint: Retune

This document defines the complete production engineering stack, system contracts, monorepo template structures, and execution instructions for **Retune**—the zero-config visual component tuner and Scalar-powered API console for VS Code.

---

## 1. Concrete Technology Stack

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   RETUNE STACK                                   │
├──────────────────────┬───────────────────────────────────┬───────────────────────┤
│ Layer                │ Technology / Package              │ Purpose               │
├──────────────────────┼───────────────────────────────────┼───────────────────────┤
│Monorepo Orchestration│ Turborepo + pnpm (Workspaces)     │ Fast builds & cache   │
│ Extension Host API   │ vscode engine (^1.90.0), Node 20  │ VS Code integration   │
│ AST Engine           │ Recast + @babel/parser + TS AST   │ Non-lossy mutations   │
│ Dynamic Bundler      │ Vite 5 (Programmatic Node API)    │ In-memory HMR sandbox │
│ Webview Runtime      │ React 18 + TypeScript 5.5         │ Stage & Console UI    │
│ Styling System       │ Tailwind CSS v3/v4 + Lucide React │ Native styling tokens │
│ API Documentation    │ @scalar/api-reference-react       │ Embedded API console  │
│ Agent Protocol       │ @modelcontextprotocol/sdk         │ Headless MCP stdio/SSE│
│ Testing Suite        │ Vitest + Playwright (VS Code API) │ Unit & E2E assertion  │
└──────────────────────┴───────────────────────────────────┴───────────────────────┘

```

---

## 2. Monorepo File Tree & Templates

### File Tree

```text
retune/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .vscode/
│   ├── extensions.json
│   ├── launch.json
│   └── tasks.json
├── packages/
│   ├── core/                        # AST Engine, Analyzers & Mutators
│   │   ├── src/
│   │   │   ├── ast/
│   │   │   │   ├── cva-extractor.ts
│   │   │   │   ├── jsx-mutator.ts
│   │   │   │   └── prop-analyzer.ts
│   │   │   ├── spec/
│   │   │   │   └── openapi.json
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── engine/                      # Ephemeral Bundler & HTTP Daemon
│   │   ├── src/
│   │   │   ├── bundler/
│   │   │   │   ├── module-resolver.ts
│   │   │   │   └── vite-server.ts
│   │   │   ├── server/
│   │   │   │   └── daemon.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── webview/                     # Webview React UI (Stage + Scalar)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── api-console/
│   │   │   │   │   └── scalar-view.tsx
│   │   │   │   └── stage/
│   │   │   │       ├── harmonics-bar.tsx
│   │   │   │       ├── tone-selector.tsx
│   │   │   │       └── viewport-frame.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-theme-sync.ts
│   │   │   │   └── use-vscode-bridge.ts
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   ├── mcp/                         # Model Context Protocol stdio/SSE Server
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   │   ├── inspect-component.ts
│   │   │   │   └── mutate-class.ts
│   │   │   ├── server.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── vscode-extension/            # VS Code Extension Host
│       ├── src/
│       │   ├── commands/
│       │   │   └── open-stage.command.ts
│       │   ├── providers/
│       │   │   ├── codelens.provider.ts
│       │   │   └── stage-panel.ts
│       │   └── extension.ts
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                     # Monorepo Root
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json

```

---

## 3. Configuration & Workspace Templates

### Root `package.json`

```json
{
  "name": "retune-monorepo",
  "private": true,
  "packageManager": "pnpm@9.5.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "package": "turbo run package"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "turbo": "^2.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}

```

### `pnpm-workspace.yaml`

```yaml
packages:
  - "packages/*"

```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {}
  }
}

```

### `packages/core/src/types/index.ts`

```typescript
export interface CvaVariantMap {
  [variantGroup: string]: string[];
}

export interface CvaMetadata {
  hasCva: boolean;
  cvaIdentifier?: string;
  variants: CvaVariantMap;
  defaultVariants: Record<string, string>;
  baseClasses: string;
}

export interface ComponentMetadata {
  componentName: string;
  filePath: string;
  cva: CvaMetadata;
  rawSource: string;
}

export type WebviewMessage =
  | { type: 'MUTATE_CLASSES'; payload: { componentName: string; className: string } }
  | { type: 'MUTATE_VARIANT'; payload: { variantGroup: string; variantValue: string } }
  | { type: 'SWITCH_TAB'; payload: { tab: 'stage' | 'api' } };

export type HostMessage =
  | { type: 'SYNC_COMPONENT'; payload: ComponentMetadata }
  | { type: 'THEME_CHANGED'; payload: { isDark: boolean; highContrast: boolean } }
  | { type: 'MUTATION_SUCCESS'; payload: { updatedCode: string } };

```

---

## 4. Implementation Instructions

### Step 1: Implement `@retune/core` (Babel + Recast AST Engine)

#### `packages/core/src/ast/cva-extractor.ts`

```typescript
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { CvaMetadata } from '../types';

export function extractCvaMetadata(sourceCode: string): CvaMetadata {
  const ast = parse(sourceCode, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

  const metadata: CvaMetadata = {
    hasCva: false,
    variants: {},
    defaultVariants: {},
    baseClasses: '',
  };

  traverse(ast, {
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      const isCva =
        (t.isIdentifier(callee) && callee.name === 'cva') ||
        (t.isMemberExpression(callee) &&
          t.isIdentifier(callee.property) &&
          callee.property.name === 'cva');

      if (!isCva) return;

      metadata.hasCva = true;

      if (path.parentPath.isVariableDeclarator() && t.isIdentifier(path.parentPath.node.id)) {
        metadata.cvaIdentifier = path.parentPath.node.id.name;
      }

      // 1. Extract Base Classes
      if (args.length > 0 && t.isStringLiteral(args[0])) {
        metadata.baseClasses = args[0].value;
      } else if (args.length > 0 && t.isArrayExpression(args[0])) {
        metadata.baseClasses = args[0].elements
          .filter((el): el is t.StringLiteral => t.isStringLiteral(el))
          .map((el) => el.value)
          .join(' ');
      }

      // 2. Extract Options Config ({ variants, defaultVariants })
      if (args.length >= 2 && t.isObjectExpression(args[1])) {
        for (const prop of args[1].properties) {
          if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue;

          if (prop.key.name === 'variants' && t.isObjectExpression(prop.value)) {
            for (const vGroup of prop.value.properties) {
              if (t.isObjectProperty(vGroup) && t.isIdentifier(vGroup.key) && t.isObjectExpression(vGroup.value)) {
                const groupName = vGroup.key.name;
                metadata.variants[groupName] = [];
                for (const vOption of vGroup.value.properties) {
                  if (t.isObjectProperty(vOption)) {
                    const optName = t.isIdentifier(vOption.key)
                      ? vOption.key.name
                      : t.isStringLiteral(vOption.key)
                      ? vOption.key.value
                      : null;
                    if (optName) metadata.variants[groupName].push(optName);
                  }
                }
              }
            }
          }

          if (prop.key.name === 'defaultVariants' && t.isObjectExpression(prop.value)) {
            for (const dProp of prop.value.properties) {
              if (
                t.isObjectProperty(dProp) &&
                t.isIdentifier(dProp.key) &&
                t.isStringLiteral(dProp.value)
              ) {
                metadata.defaultVariants[dProp.key.name] = dProp.value.value;
              }
            }
          }
        }
      }
    },
  });

  return metadata;
}

```

#### `packages/core/src/ast/jsx-mutator.ts`

```typescript
import { parse, print } from 'recast';
import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';

export function mutateClassName(
  sourceCode: string,
  targetComponent: string,
  newClassName: string
): string {
  const ast = parse(sourceCode, {
    parser: {
      parse(source: string) {
        return babelParse(source, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          tokens: true,
        });
      },
    },
  });

  let mutated = false;

  // Walk using Recast AST types
  const recast = require('recast');
  recast.types.visit(ast, {
    visitJSXOpeningElement(path: any) {
      const node = path.node;
      const isTarget =
        t.isJSXIdentifier(node.name) &&
        (node.name.name === targetComponent ||
          node.name.name === 'button' ||
          node.name.name === 'div');

      if (isTarget && !mutated) {
        let classAttr = node.attributes.find(
          (attr: any) => t.isJSXAttribute(attr) && attr.name.name === 'className'
        );

        if (classAttr) {
          classAttr.value = t.stringLiteral(newClassName);
        } else {
          node.attributes.push(
            t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(newClassName))
          );
        }
        mutated = true;
      }
      this.traverse(path);
    },
  });

  return print(ast).code;
}

```

---

### Step 2: Implement Ephemeral Engine & Scalar Daemon (`@retune/engine`)

#### `packages/engine/src/server/daemon.ts`

```typescript
import http from 'node:http';
import { extractCvaMetadata } from '@retune/core';
import { mutateClassName } from '@retune/core';

export function createRetuneDaemon(port = 49221) {
  const server = http.createServer((req, res) => {
    // CORS headers for Webview & local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

    // GET /v1/openapi.json -> Returns spec to Scalar
    if (req.method === 'GET' && url.pathname === '/v1/openapi.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(require('@retune/core/spec/openapi.json')));
      return;
    }

    // POST /v1/components/inspect
    if (req.method === 'POST' && url.pathname === '/v1/components/inspect') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const { fileContent } = JSON.parse(body);
          const cvaMeta = extractCvaMetadata(fileContent);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ cva: cvaMeta }));
        } catch (err: any) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // POST /v1/components/mutate
    if (req.method === 'POST' && url.pathname === '/v1/components/mutate') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const { fileContent, componentName, className } = JSON.parse(body);
          const updated = mutateClassName(fileContent, componentName, className);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ updatedContent: updated, success: true }));
        } catch (err: any) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, '127.0.0.1');
  return server;
}

```

---

### Step 3: Implement Webview App with Scalar (`@retune/webview`)

#### `packages/webview/src/App.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import { ComponentMetadata, WebviewMessage, HostMessage } from '@retune/core';

declare const vscode: {
  postMessage: (message: WebviewMessage) => void;
};

export function App() {
  const [activeTab, setActiveTab] = useState<'stage' | 'api'>('stage');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [meta, setMeta] = useState<ComponentMetadata | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [harmonicsClass, setHarmonicsClass] = useState<string>('');

  useEffect(() => {
    const handleMessage = (event: MessageEvent<HostMessage>) => {
      const msg = event.data;
      if (msg.type === 'SYNC_COMPONENT') {
        setMeta(msg.payload);
        setSelectedVariants(msg.payload.cva.defaultVariants || {});
        setHarmonicsClass(msg.payload.cva.baseClasses || '');
      } else if (msg.type === 'THEME_CHANGED') {
        setIsDark(msg.payload.isDark);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleClassCommit = (newClasses: string) => {
    setHarmonicsClass(newClasses);
    if (!meta) return;
    vscode.postMessage({
      type: 'MUTATE_CLASSES',
      payload: { componentName: meta.componentName, className: newClasses },
    });
  };

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'dark bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'}`}>
      {/* Retune Control Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tight text-indigo-400">RETUNE</span>
          <span className="text-xs text-zinc-500">|</span>
          <span className="text-xs font-mono text-zinc-400">{meta?.componentName || 'No File Selected'}</span>
        </div>
        <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded-md text-xs">
          <button
            onClick={() => setActiveTab('stage')}
            className={`px-3 py-1 rounded transition ${activeTab === 'stage' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            The Stage
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1 rounded transition ${activeTab === 'api' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Scalar API
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'stage' ? (
          <div className="flex flex-col h-full">
            {/* Tone Selector Matrix (Variants) */}
            <div className="p-3 border-b border-zinc-800 flex flex-wrap gap-4 items-center bg-zinc-900/20">
              {meta?.cva.hasCva ? (
                Object.entries(meta.cva.variants).map(([group, options]) => (
                  <div key={group} className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-zinc-400 uppercase tracking-wider">{group}:</span>
                    <select
                      value={selectedVariants[group] || ''}
                      onChange={(e) => setSelectedVariants((prev) => ({ ...prev, [group]: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200 outline-none"
                    >
                      {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ))
              ) : (
                <div className="text-xs text-zinc-500 italic">No CVA configuration found in active component</div>
              )}
            </div>

            {/* Sandbox Canvas */}
            <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950/80">
              <div className="border border-zinc-800 rounded-lg p-12 bg-zinc-900/40 shadow-xl max-w-md w-full flex items-center justify-center">
                <button className={`transition-all ${harmonicsClass}`}>
                  {meta?.componentName ? `${meta.componentName} Preview` : 'Select a component'}
                </button>
              </div>
            </div>

            {/* Harmonics Bar (Live Tailwind Input) */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center gap-2">
              <span className="text-xs font-mono text-indigo-400">Harmonics:</span>
              <input
                type="text"
                value={harmonicsClass}
                onChange={(e) => setHarmonicsClass(e.target.value)}
                onBlur={(e) => handleClassCommit(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleClassCommit((e.target as HTMLInputElement).value)}
                placeholder="Enter Tailwind classes..."
                className="flex-1 bg-zinc-800/80 border border-zinc-700 rounded px-3 py-1.5 text-xs font-mono text-zinc-100 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        ) : (
          /* Scalar API Console Tab */
          <div className="h-full w-full overflow-y-auto">
            <ApiReferenceReact
              configuration={{
                spec: { url: 'http://127.0.0.1:49221/v1/openapi.json' },
                darkMode: isDark,
                layout: 'modern',
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

```

---

### Step 4: Implement VS Code Extension (`packages/vscode-extension`)

#### `packages/vscode-extension/src/extension.ts`

```typescript
import * as vscode from 'vscode';
import { StagePanel } from './providers/stage-panel';
import { createRetuneDaemon } from '@retune/engine';

let daemonInstance: ReturnType<typeof createRetuneDaemon> | undefined;

export function activate(context: vscode.ExtensionContext) {
  // 1. Boot local Retune Daemon for Scalar & AST endpoints
  try {
    daemonInstance = createRetuneDaemon(49221);
  } catch (e) {
    console.warn('Retune daemon failed to bind port (may already be running):', e);
  }

  // 2. Register Stage Panel Command
  const openStageCommand = vscode.commands.registerCommand('retune.openStage', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.tsx')) {
      vscode.window.showWarningMessage('Please focus a React (.tsx) component to tune.');
      return;
    }
    StagePanel.render(context.extensionUri, editor.document);
  });

  // 3. Listen to Active Editor Changes
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && editor.document.fileName.endsWith('.tsx') && StagePanel.currentPanel) {
      StagePanel.currentPanel.updateDocument(editor.document);
    }
  });

  context.subscriptions.push(openStageCommand);
}

export function deactivate() {
  if (daemonInstance) {
    daemonInstance.close();
  }
}

```

#### `packages/vscode-extension/src/providers/stage-panel.ts`

```typescript
import * as vscode from 'vscode';
import { extractCvaMetadata, mutateClassName } from '@retune/core';
import * as path from 'node:path';

export class StagePanel {
  public static currentPanel: StagePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _document: vscode.TextDocument;
  private _disposables: vscode.Disposable[] = [];

  public static render(extensionUri: vscode.Uri, document: vscode.TextDocument) {
    if (StagePanel.currentPanel) {
      StagePanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
      StagePanel.currentPanel.updateDocument(document);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'retuneStage',
      'Retune: The Stage',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'packages/webview/dist')],
      }
    );

    StagePanel.currentPanel = new StagePanel(panel, extensionUri, document);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, document: vscode.TextDocument) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._document = document;

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleWebviewMessage(message),
      null,
      this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this.syncCurrentDocument();
  }

  public updateDocument(document: vscode.TextDocument) {
    this._document = document;
    this.syncCurrentDocument();
  }

  public syncCurrentDocument() {
    const text = this._document.getText();
    const cvaMeta = extractCvaMetadata(text);
    const componentName = path.basename(this._document.fileName, path.extname(this._document.fileName));

    this._panel.webview.postMessage({
      type: 'SYNC_COMPONENT',
      payload: {
        componentName,
        filePath: this._document.fileName,
        cva: cvaMeta,
        rawSource: text,
      },
    });
  }

  private async _handleWebviewMessage(message: any) {
    if (message.type === 'MUTATE_CLASSES') {
      const { componentName, className } = message.payload;
      const originalText = this._document.getText();
      const mutated = mutateClassName(originalText, componentName, className);

      if (mutated !== originalText) {
        const fullRange = new vscode.Range(
          this._document.positionAt(0),
          this._document.positionAt(originalText.length)
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(this._document.uri, fullRange, mutated);
        await vscode.workspace.applyEdit(edit);
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Retune Stage</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          const vscode = acquireVsCodeApi();
        </script>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="http://localhost:5173/src/main.tsx"></script>
      </body>
    </html>`;
  }

  public dispose() {
    StagePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
}

```

---

### Step 5: Implement Model Context Protocol (MCP) Server (`packages/mcp`)

#### `packages/mcp/src/server.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { extractCvaMetadata, mutateClassName } from '@retune/core';
import * as fs from 'node:fs/promises';

export async function runMcpServer() {
  const server = new Server(
    { name: 'retune-engine', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'retune_inspect_component',
          description: 'Extracts CVA variants, default props, and base classes from a TSX file',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Absolute path to .tsx file' },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'retune_fine_tune_classes',
          description: 'Updates Tailwind classNames with format-preserving AST mutation',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Absolute path to .tsx file' },
              componentName: { type: 'string', description: 'Target JSX element or component identifier' },
              newClasses: { type: 'string', description: 'Tailwind classes to apply' },
            },
            required: ['filePath', 'componentName', 'newClasses'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'retune_inspect_component') {
      const filePath = String(args?.filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const meta = extractCvaMetadata(content);
      return { content: [{ type: 'text', text: JSON.stringify(meta, null, 2) }] };
    }

    if (name === 'retune_fine_tune_classes') {
      const filePath = String(args?.filePath);
      const componentName = String(args?.componentName);
      const newClasses = String(args?.newClasses);

      const content = await fs.readFile(filePath, 'utf-8');
      const updated = mutateClassName(content, componentName, newClasses);
      await fs.writeFile(filePath, updated, 'utf-8');

      return {
        content: [{ type: 'text', text: `Successfully updated classes in ${filePath}` }],
      };
    }

    throw new Error(`Tool not found: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runMcpServer().catch(console.error);

```

---

## 5. Execution & Verification Guide

### 1. Bootstrap Workspace

```bash
# Clone and enter directory
git clone https://github.com/your-org/retune.git && cd retune

# Install all workspace dependencies
pnpm install

# Run build across all monorepo packages
pnpm build

```

### 2. Launch Local Dev Environment

```bash
# Start Webview Vite dev server and TypeScript watch
pnpm --filter @retune/webview dev

```

### 3. Launch Extension in VS Code Debug Host

1. Press `F5` or select **Run Extension** in the VS Code Run & Debug tab.
2. In the new VS Code Development Host window, open any React project containing shadcn components (e.g., `@/components/ui/button.tsx`).
3. Press `Cmd+Shift+P` (or `Ctrl+Shift+P`), type **`Retune: Open Visual Stage`**, and press Enter.
4. Verify:
* "The Stage" opens in a split pane beside `Button.tsx`.
* The Tone Selector dropdowns immediately reflect the variants from `buttonVariants`.
* The Harmonics input bar contains the base classes.
* Click **Scalar API** to view the live OpenAPI interactive console.
* Edit a utility class in the Harmonics input (e.g., append `shadow-2xl`) and verify that `Button.tsx` updates without losing indentation or comments.