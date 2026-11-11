# Orca plugin research for Retune (issue #1)

Date: 2026-11-11
Orca CLI / app version examined: **1.4.252** (`orca --version`), host API **1.4**, `pluginApi` major **1**.

Evidence labels used throughout:

- **[CLI]** output of `orca plugin ... --help`, `create`, `types`, `validate`, `inspect`, `check`, `test` run in a scratch folder outside the repo.
- **[TYPES]** the typings `orca plugin create` / `orca plugin types` write to `.orca/types/` (`orca`, `orca-host`, `orca-frame`, `orca-worker`, `orca-services`, `orca-testing`).
- **[SHIPPED]** readable (unminified) schema modules shipped with the installed app under `resources/app.asar.unpacked/out/shared/plugins/`. These are what the CLI validator runs.
- **[WEB]** `github.com/stablyai/orca/blob/main/docs/reference/plugin-authoring.md` and `plugin-isolated-frames.md`, read through a summarizing fetch; treat as secondary.
- **[INFERRED]** my reading; not executed.

Nothing was loaded into the Orca app: `dev load`, `enable`, `install` and `system on/off` were not run. Everything about how the Retune bundle behaves at runtime inside Orca is therefore unverified (see section 4).

## 0. Corrections to issue #1

1. **Manifest format is 2, not 1.** Every template writes `"manifestVersion": 2` plus a required `"execution"` profile. Format 1 still loads but requires `publisher`, has no `execution`, and is described as legacy [CLI][SHIPPED]. A format 1 copy of the draft manifest failed validation with `publisher: is required` [CLI].
2. **Agent skills and MCP servers cannot be contributed today.** `contributes.skills` and `contributes.mcpServers` are reserved and must be empty. Validation of a non-empty value fails with `contributes.skills: is reserved for agent skills and must be empty for now; contributes.mcpServers: is reserved for MCP server definitions and must be empty for now` [CLI].
3. **Panels live only in the right sidebar.** There is no editor-tab panel. The only way to put plugin UI in an editor tab is a **custom editor**, which is bound to a file by extension or filename [SHIPPED][CLI].
4. **There is no active-file, open-document, or text-change API for workers or panels**, and no file read/write host method. A custom editor frame gets the text of the one file it is opened on, never its path [TYPES][SHIPPED].

## 1. Orca plugin API as verified

### 1.1 Manifest (`orca-plugin.json`, format 2) [SHIPPED][CLI]

Format 2 is strict: unknown keys are refused at every level.

| Field | Notes |
|---|---|
| `$schema` | optional, ignored by Orca |
| `manifestVersion` | literal `2` |
| `execution` | `"data"` \| `"declarative"` \| `"sandboxed-ui"` \| `"trusted-worker"`, least to most authority. Contributions beyond it fail validation. `trusted-worker` requires `main`. |
| `id` | kebab-case. Install identity is `<publisher>.<id>`; ids starting `orca-` are reserved |
| `publisher` | deprecated, leave out. Derived from the repository owner, or `local` for a folder. Needs `engines.orca >= 1.4.246` when omitted |
| `name`, `version` (semver), `description`, `author {name,url}`, `repository`, `icon` | display fields |
| `engines.orca` | `>=x.y.z`. Must be at least the newest "since" of every field and value used; the validator enforces this |
| `pluginApi` | optional, defaults to `1`. Refused on `data` and `declarative` plugins |
| `main` | worker entry: `.js`/`.mjs`, or `.ts`/`.mts` transpiled by Orca at load. No JSX in a worker |
| `contributes` | see 1.2 |
| `capabilities` | array of `{ "kind": ... }`, at most 32 |

Capability kinds (closed set): `workspace:read`, `workspace:write`, `agent:read`, `agent:launch`, `terminal:send`, `terminal:read`, `notifications:show`, `storage:own`, `secrets:own`, `settings:own`, `appearance:write`. Worker-only: `terminal:send`, `terminal:read`, `workspace:write`, `agent:launch`, `appearance:write`.

Version floors: format 2 `1.4.245`; derived publisher, components panels, build-less TS/TSX, panel-to-worker bridge and `contributes.settings` `1.4.246`; hooks, `customEditors[].frame`, worker host actions (`workspace:write`, `editor.open`, `commands.run`), status bar items and `commands[].replaces` `1.4.248`.

Folder limits [WEB]: at most 2,000 files and 50 MiB. Dev folders skip `node_modules/`, `.git/`, `.orca/`.

### 1.2 Contribution points [SHIPPED]

Active points and the minimum execution profile each needs:

| Point | Profile | Shape |
|---|---|---|
| `panels` (max 64) | sandboxed-ui | `{ id, title, icon?, entry, ui? }`. `ui`: `"html"` (default) or `"components"`. `icon` is one of a fixed name list (`layers`, `puzzle`, `blocks`, `code`, `wrench`, ...), not a file |
| `customEditors` (max 16) | sandboxed-ui | `{ id, title, icon?, extensions[], filenames[], entry, priority?, contentKind?, frame? }` |
| `commands` (max 256) | declarative | `{ id, title, when?, action?, replaces? }`. `when`: `"global"` \| `"workspace"`. With `action` it aliases a built-in Orca action and never starts the worker; without it, `main` is required |
| `keybindings` (max 256) | declarative | `{ command, key, when? }`. `key` like `Mod+Shift+K`; `when` must match the command's |
| `settings` (max 64) | sandboxed-ui | `{ key, title, description?, type, default?, enum?, enumLabels?, minimum?, maximum?, maxLength?, multiline?, placeholder? }`. `type`: `string` \| `number` \| `integer` \| `boolean`. Key regex `^[A-Za-z][A-Za-z0-9_.-]{0,63}$`. Needs `settings:own` |
| `statusBarItems` (max 8) | declarative | `{ id, text?, icon?, tone?, tooltip?, command? }`. A worker updates them with `statusBar.update` |
| `events` | trusted-worker | `{ on }`: `workspace.created`, `workspace.removed`, `workspace.changed`, `agent.status.changed` |
| `hooks` | trusted-worker | `{ event, onError? }`: `terminal.send`, `workspace.create.before`, `workspace.create.after`, `agent.launch.before`, `agent.prompt.before`, `agent.tool.before`, `agent.tool.after`, `editor.save.before` |
| `newFiles` (max 16) | data | `{ id, title, extension, template?, icon? }` |
| `themes`, `terminalThemes`, `iconThemes`, `syntaxes`, `languagePacks`, `vmRecipes` | data / declarative | content only |

Reserved, must be empty: `agentHarnesses`, `skills`, `mcpServers`, `taskSources`, `connections`, `sidebarCards`. Planned meaning [SHIPPED]: `mcpServers` "MCP server definitions that Orca offers to the agents it launches", `skills` "Agent skills shipped as files that Orca installs for the agents it launches".

Built-in actions usable in `action` / `replaces` / `commands.run` (closed set): `worktree.history.back`, `worktree.history.forward`, `sidebar.left.toggle`, `sidebar.sleepingWorkspaces.toggle`, `floatingWorkspace.maximize`, `tab.rename`, `workspace.rename`, `workspace.openBoard`, `view.tasks`, `sidebar.right.toggle`, `sidebar.explorer.toggle`, `sidebar.search.toggle`, `sidebar.sourceControl.toggle`, `sidebar.checks.toggle`, `sidebar.ports.toggle`. None of them opens a specific plugin panel or a custom editor.

### 1.3 Worker [TYPES][CLI]

- Runs "in a separate Node.js process on the Orca host, with your user account's access to that machine" (consent text). `node:` builtins resolve as Node resolves them [WEB], so `node:fs` and `node:http` are available to the worker itself. This is how a worker would read and write files; there is no host method for it.
- Entry: `export default function activate(orca: OrcaWorkerApi)`. Optional `export function deactivate()`. A named `activate` is never called.
- Started on demand (first command, event, hook, or `plugin.request`). A save of the file restarts it and drops in-memory state. With `main` plus `statusBarItems`, the worker "is started when it is enabled and kept running while it stays enabled".

```ts
type OrcaWorkerApi = {
  readonly api: { major: number; minor: number }
  readonly commands: { register(commandId: string, handler: (args: unknown, context: { signal: AbortSignal }) => unknown): Disposable }
  readonly events: { on<E>(event: E, handler: (payload: PluginEvents[E]) => void | Promise<void>): Disposable }
  readonly hooks: { on<H>(hook: H, handler: HookHandler<H>): Disposable }
  readonly host: HostApi<'worker'>
  readonly panels: PanelsApi            // "This plugin's panels and custom editors."
  readonly storage: StorageApi          // get/set/delete/keys/onDidChange
  readonly settings: SettingsApi        // get()/get(key)/set/onDidChange
  readonly secrets: SecretsApi
  readonly grantedCapabilities: readonly string[]
  log(message: string): void
}
```

Worker-callable host methods (`orca.host.call(name, params)`): `workspace.readContext`, `workspace.list`, `workspace.open`, `editor.open { workspaceId, path }`, `commands.run { action }`, `terminal.create`, `terminal.read`, `terminal.sendText`, `agent.launch`, `agents.list`, `notifications.show`, `statusBar.update`, `appearance.read`, `appearance.apply`, plus storage, secrets and settings.

What a worker can learn about files:

- `workspace.list` returns `{ id, kind, name, path, branch, hostId }[]`, so the workspace root path is known.
- `workspace.readContext` returns only `{ branch, displayName, terminals }` for the focused workspace. No path, no active file.
- The `editor.save.before` hook carries `{ workspaceId, path, languageId?, text }` on an explicit save. This is the only place a worker sees the path and text of an open file, and it may rewrite `text`.

### 1.4 Panels [SHIPPED][TYPES][WEB]

Two kinds:

- **`ui: "html"`** (default): `entry` is an HTML page shown as arbitrary HTML/JS. On the desktop app it runs as an isolated `<webview>` guest served from `orca-plugin-frame://<key>/<path>`, one session, process and storage partition per plugin. Scripts, styles, images, fonts, WASM and workers load by relative URL.
- **`ui: "components"`**: `entry` is a TSX module that returns a tree of Orca's own components (`Stack`, `Row`, `Button`, `Input`, `Select`, `Slider`, `Tabs`, `Table`, `Tree`, `Box`, `CodeView`, `Markdown`, ...). No DOM: "No lowercase tags: panels never render DOM." State is `atom`/`read`/`set`. No build step. This cannot host the React webview.

Frame API (`window.orca`, both panels and custom editors):

```ts
type OrcaFrameApi = {
  readonly api: HostApiVersion
  readonly host: HostApi<'panel' | 'editor'>
  on<E extends keyof FrameEvents>(event: E, handler: (payload: FrameEvents[E]) => unknown): Disposable
  readonly locale: string
  readonly plugin: PluginBridgeApi
  readonly storage: StorageApi
  readonly settings: SettingsApi
  readonly secrets: SecretsApi
  readonly shell?: { openExternal(url: string): Promise<{ opened: boolean; reason?: 'cancelled' | 'consent-unavailable' }> }
  readonly files?: { saveAs(options: SaveAsOptions): Promise<{ status: 'saved' | 'cancelled' }> }
  readonly document?: EditorDocumentApi   // custom editors only
}
```

"Defined by Orca's frame shell before any plugin script runs; also `window.orca`."

Frame-callable host methods: `workspace.readContext`, `notifications.show`, `agents.list`, `events.subscribe`, `plugin.request`, `shell.openExternal`, `files.saveAs`, storage, secrets, settings. Nothing that touches files, terminals or the editor.

### 1.5 Panel and editor to worker messaging [TYPES]

```ts
// frame side
orca.plugin.request(name: string, input?: JsonValue, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<JsonValue>
orca.plugin.on(event: string, handler: (payload: JsonValue) => void): Disposable

// worker side
orca.panels.handle(name, (input, context: { panel: { id: string; surface: 'panel' | 'editor'; contributionId: string }; signal: AbortSignal }) => output): Disposable
orca.panels.post(event, payload, options?: { panel?: string }): void
```

- `request` starts the worker if needed. Default timeout 30000 ms, max 120000. Errors carry `code`: `unknown_method`, `timeout`, `unavailable`, or what the handler threw.
- `post` goes "To every open panel of this plugin, or one"; "Fire and forget: at most 256 KiB, 200 per 10 s."
- Frame to host budget [SHIPPED]: `PANEL_MESSAGE_MAX_BYTES = 64 * 1024`, `PANEL_MESSAGE_RATE_LIMIT = { maxMessages: 120, perMs: 10_000 }`, one budget per plugin shared by all its frames.
- Typing: declare `interface PluginRequests` and `interface PluginPanelEvents` in `declare module 'orca'` once (the `worker-panel` template's `src/protocol.ts`).
- Shared storage is a second channel: `storage.onDidChange` fires in the worker and in every frame when any of them writes.

### 1.6 Custom editors [SHIPPED][TYPES]

- Claim files by `extensions` (suffix with the dot, compound allowed, e.g. `.excalidraw.json`) and/or exact `filenames`. At least one is required.
- `priority`: `"default"` opens matching files in the editor; `"option"` only offers it in the view toggle beside Source. **Core file types always behave as `option`** regardless of `priority`. The core set includes `ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`, `json`, `md`, `css`, `html`, `yaml`, `toml`, `csv`, `txt`. So an editor claiming `.tsx` and `.jsx` is accepted and appears as a toggle on the tab; the file still opens in Source first.
- `contentKind`: `"text"` (default) or `"bytes"`. `frame`: `"any"` (default) or `"isolated"` (desktop app only).
- "It receives the open document and posts edits back; it never gets a file path or file system." Orca "keeps the buffer, dirty state, saving and the file's location".
- Edits are **whole-document replacements**, not ranges:

```ts
type EditorDocument = { readonly version: number; readonly readOnly: boolean; readonly content: EditorContent; readonly fileType?: string; readonly ancestor?: EditorContent }
type EditorEdit = { baseVersion: number; content: EditorContent }
type EditorDocumentApi = {
  get(): Promise<EditorDocument>
  onDidChange(handler: (document: EditorDocument) => void): Disposable
  applyEdit(edit: EditorEdit): Promise<null>            // rejects with conflict, too_large, not_permitted
  session<T = string>(options?: { decode?; encode?; merge?: (base: T, outside: T, mine: T) => T; debounceMs?: number }): Promise<EditorSession<T>>
}
type EditorSession<T> = { readonly value: T; readonly readOnly: boolean; change(next: T): void; flush(): Promise<void>; onReplace(handler: (value: T) => void): Disposable; dispose(): void }
```

- Limits: document max 64 MiB, edits 60 per 10 s, session debounce default 250 ms, save waits 1 s for a pending flush.
- `fileType` is set only for bytes documents, so a text editor cannot even tell `.tsx` from `.jsx`.
- "Orca keeps no undo history for them: Cmd/Ctrl+Z reaches the frame."
- Without a `merge` function, an outside write wins over unsent edits.

### 1.7 Theming [SHIPPED][TYPES]

- Orca injects a `<style id="orca-design-tokens">:root{...}</style>` with a curated allowlist, each exposed as `--orca-<name>`:
  `--orca-background`, `--orca-foreground`, `--orca-card`, `--orca-card-foreground`, `--orca-popover`, `--orca-popover-foreground`, `--orca-primary`, `--orca-primary-foreground`, `--orca-secondary`, `--orca-secondary-foreground`, `--orca-muted`, `--orca-muted-foreground`, `--orca-accent`, `--orca-accent-foreground`, `--orca-destructive`, `--orca-destructive-foreground`, `--orca-border`, `--orca-input`, `--orca-ring`, `--orca-radius`.
- `<html>` carries class `light` or `dark`. `orca.on('theme', ({ colorScheme }) => ...)` fires after the variables and class have already been updated in place.
- No font-family, font-size, editor-font, or high-contrast tokens exist.
- [INFERRED] the names follow the shadcn/ui convention, so `--orca-input` is the input border colour, not an input background. The value format (hex, hsl, oklch) was not observed.

### 1.8 Sandbox and CSP [SHIPPED][WEB]

Desktop isolated guest, sent as a header on every response:

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self' data: blob:;
worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
```

- **Network is closed** at the session level, including loopback: requests to anything but `orca-plugin-frame://<key>/`, `data:`, `blob:` are cancelled, and a drop-everything proxy covers loopback targets [WEB]. A frame cannot `fetch('http://127.0.0.1:49221')`.
- Inline scripts and inline styles are allowed. `eval` / `new Function` are not (`'unsafe-eval'` absent). Nested iframes are not (`frame-src 'none'`). `<base>` is neutralised (`base-uri 'none'`).
- Size caps: documents, scripts, styles, JSON, SVG, WASM 16 MiB each; images, fonts, media 32 MiB each; `.ts/.tsx/.jsx` source modules 1 MiB; `PLUGIN_PANEL_ENTRY_MAX_BYTES` 10 MiB.
- Browser clients (`orca serve` / web) use a `srcdoc` iframe with a much tighter CSP (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:`). Multi-file bundles do not load there: "multi-file assets need the desktop app".
- Links: `<a href>` clicks are swallowed; use `orca.shell.openExternal`, which needs a real user gesture and may prompt for consent per host.

### 1.9 Dev, validate, check loop [CLI]

| Command | What it does | Touches the Orca app |
|---|---|---|
| `orca plugin create <dir> --template <theme\|terminal-theme\|icon-theme\|syntax\|language-pack\|editor\|panel\|components\|worker-panel\|hook> [--id] [--name] [--json]` | scaffold into an empty folder; runs no code | no |
| `orca plugin types <dir>` | writes `.orca/types/*/index.d.ts` and `.orca/types/tsconfig.json`; `.orca/` ignores itself in Git | no |
| `orca plugin validate <dir\|orca-plugin.json> [--json]` | strict manifest, limits, profile, every named file. Exit 0 ok, 2 invalid. Reports `needsApproval` and grants | no |
| `orca plugin inspect <dir> [--json]` | validate plus contributions, access and content hash | no |
| `orca plugin check [dir] [--json]` | validate, mount each components panel in Node, statically check each custom editor. Runs plugin code unsandboxed. Exit 1 on failure | no |
| `orca plugin test [dir] [--json]` | runs `*.test.ts(x)` with `node:test` or the plugin's vitest; `orca/testing` provides `test`, `assert`, `mount`, `mockHost`, `mountWorker`, `mockEditorHost`, `defineCheck` | no |
| `orca plugin dev load <dir> [--approve <fingerprint>]` | adds a development folder; code needs approval, exit 3 prints the fingerprint | yes |
| `orca plugin dev watch <dir> [--check] [--shot <out-dir> [--shot-panel <id>]] [--approve <fp>] [--json]` | load, stream logs and reloads, Ctrl-C unloads | yes |
| `orca plugin dev request <dir\|key> <name> [--data <json>] [--panel <id>] [--timeout-ms <ms>]` | call a worker `panels.handle` handler | yes |
| `orca plugin dev emit <dir\|key> <event> [--data <json>]` | fire a test event at worker and open panels | yes |
| `orca plugin dev hook <dir\|key> <hook> --data <json>` | run one hook through the worker | yes |
| `orca plugin dev inspect <key>` | DevTools per open frame | yes |
| `orca plugin open <key> [--panel <id> \| --editor <file>]` | show a panel in the right sidebar or open a file in the plugin's editor | yes |
| `orca plugin shot <key\|dir> [--panel <id> \| --editor <file> \| --status-bar \| --window] [--theme <light\|dark>] [--width] [--height] [--act '<json>'] [--scenario <name>] [--out <file.png>]` | PNG of the panel or editor as drawn | yes |
| `orca plugin release-entry <dir>` | catalog entry for the committed HEAD; hashes HEAD, not the working tree | no |

A draft Retune manifest (section 3.2) with a copy of the current webview build was run through `validate`, `inspect` and `check` in the scratch folder. Results:

- `validate`: ok, `local.retune 0.1.0 (trusted-worker)`.
- `check`: `retune-stage (webview/stage.html): ok, 2 file(s) load`, content 6 files, 5,349,956 bytes. One warning: `webview/assets/index-C-ZDpouQ.js:1096:148214: Function compiles a string, which the editor frame refuses [editor_eval]`. The flagged code is a feature probe inside `try { return Function(""), true } catch { return false }` (zod's JIT detection, pulled in by Scalar), so it degrades safely [INFERRED from reading the bundle].
- Removing `main` and `execution: trusted-worker` failed with `main: required when contributes.commands contains a worker command`.
- `check` does not flag a remote `<script src="https://cdn.tailwindcss.com">`; it would simply fail to load at runtime [INFERRED].

## 2. Mapping table

| Retune on VS Code | Orca equivalent | Gap / workaround |
|---|---|---|
| Stage `WebviewPanel` (`stage-panel.ts`), opened in a tab or split | `customEditors` entry claiming `.tsx` / `.jsx`, `priority: "option"`, html entry, `frame: "isolated"`. Shows as a "Retune" toggle beside Source on the file's tab | No free-standing tab, no "beside" split, no programmatic open from a command. One frame per open file rather than one shared Stage that follows the active editor |
| Sidebar `WebviewView` (`sidebar.provider.ts`) | `panels` entry, `ui: "html"`, right sidebar | Right sidebar only. Icon must be one of Orca's named icons, not `retune-icon.svg` |
| `buildWebviewHtml` (`webview-html.ts`): `asWebviewUri`, `<base>`, CDN Tailwind script, `acquireVsCodeApi` bootstrap | Static `stage.html` and `inspector.html` inside the plugin folder with relative `./assets/...` URLs and an inline `window.RETUNE_VIEW_MODE` script | `<base>` is blocked, the CDN script cannot load, `acquireVsCodeApi` does not exist. Vite already uses `base: './'` |
| CodeLens ("Open Visual Stage", "Tune `<X />` in Stage", "Inspect AST & Props") | **No equivalent.** No editor decoration or lens API | The view toggle on the tab replaces "open stage". Component and tab selection move inside the Stage UI |
| Commands `retune.openStage`, `openStageTab`, `openStageSplit`, `tuneComponentAtCursor`, `inspectAstTab`, `openScalarApi` | `contributes.commands` handled by `orca.commands.register`, or declarative `action` aliases | A worker command cannot learn the active file or cursor, and no host method opens a custom editor on the current file. `editor.open { workspaceId, path }` opens a file in a tab but needs a path the worker does not have. Realistic commands: toggle the right sidebar (`action: "sidebar.right.toggle"`), daemon status |
| Keybinding `ctrl+shift+r` / `cmd+shift+r` when `editorTextFocus` | `contributes.keybindings` `{ command, key: "Mod+Shift+R", when }` | `when` is only `global` or `workspace`; no editor-focus context. Chord conflicts with Orca defaults not checked |
| Editor and explorer context menus, submenu, editor title buttons | **No equivalent** | None |
| `onDidChangeActiveTextEditor` / `onDidChangeTextDocument` sync | Inside the custom editor: `orca.document.onDidChange` / `session.onReplace` for that file | No cross-file "active editor" signal. Workers get only `workspace.changed` (focused workspace, terminals) and the `editor.save.before` hook on explicit saves |
| `WorkspaceEdit` full-range replace (`MUTATE_CLASSES`, `MUTATE_VARIANT`) | `orca.document.session().change(newFullText)` from the editor frame | Whole-document edits only, which matches what `stage-panel.ts` already does (it replaces the full range). Undo is the frame's job. Mutation must run where the text is: in the frame |
| Settings `retune.*` (`getConfiguration`, `onDidChangeConfiguration`, `cfg.update`) | `contributes.settings` plus `orca.settings.get/set/onDidChange` (frames and worker), capability `settings:own` | Scalar types only; `enumDescriptions` becomes `enumLabels`. `stage.openMode` and `sandbox.port` have no meaning in Orca. `autoSyncActiveEditor` has nothing to drive it |
| Theme (`THEME_CHANGED { isDark, highContrast }`, `--vscode-*`) | `orca.on('theme')`, `light`/`dark` class, 20 `--orca-*` tokens | No high-contrast signal, no font tokens |
| Daemon on `127.0.0.1:49221` started in `activate` | Start `createRetuneDaemon(port)` in the worker's `activate`, close in `deactivate` | Frames cannot reach it (network closed). It stays useful for external clients only. Worker lifetime is on-demand unless a status bar item keeps it running. Port clash with a running VS Code instance is already tolerated (`EADDRINUSE` warning) |
| Scalar API console tab (fetches `openapi.json` by URL, "try it" requests) | Pass the spec inline from `@retune/core`'s `openApiSpec` | Live requests from the frame are impossible. Either proxy through `plugin.request` to the worker, hide the tab under Orca, or offer `shell.openExternal` |
| MCP stdio server (`packages/mcp`) | **No equivalent** (`mcpServers` reserved) | Keep it as a separately configured server in the agent's own config. Revisit when Orca defines the point |
| Agent skills | **No equivalent** (`skills` reserved) | Ship skills through the agent's own mechanism |
| `retainContextWhenHidden` | Not exposed | Frame lifetime on tab or sidebar switch is unknown; persist `StageState` in `orca.storage` |
| Activation events | None needed; contributions are declarative and the worker starts on demand | |

## 3. Recommended architecture

### 3.1 Can the existing webview bundle be reused?

**Not as-is, but yes with bounded changes.** The build output is a static `index.html` plus one 5.03 MB JS file and one 314 KB CSS file with relative URLs. That shape is exactly what an Orca html panel or custom editor loads, it is under the 16 MiB per-file cap, and it passed `orca plugin check`. What must change:

1. **Host transport.** The app calls `vscode.postMessage` and listens on `window` `message`. Orca has neither. This is what the `host.ts` adapter refactor fixes (3.4).
2. **Remote Tailwind script.** `src/index.html` and `webview-html.ts` load `https://cdn.tailwindcss.com`. It cannot load in Orca. Any class that only works because of the CDN runtime will not render; the compiled Tailwind v4 CSS with the `@source inline` safelist and `lib/arbitrary-style.ts` must cover it.
3. **Loopback fetches.** `App.tsx` posts to `http://127.0.0.1:${daemonPort}/v1/components/mutate` in standalone mode and gives Scalar `http://127.0.0.1:.../v1/openapi.json`. Both are blocked.
4. **Theme.** `styles.css` hard-codes `color-scheme: dark`, `#09090b`, `#e4e4e7`, and components use zinc classes. Orca supports light themes.
5. **Analysis location.** Under VS Code the extension host runs `@retune/core`. Under Orca the only code that sees the document text is the editor frame, and frame-to-host messages are capped at 64 KiB, so sending source to the worker for analysis breaks on larger files. `@retune/core`'s analyzers and mutators should be bundled into the Orca build of the webview and run in the frame. `@retune/core` has no `node:` imports in `src` (only `@babel/parser`, `@babel/traverse`, `@babel/types`, `recast`), which makes this plausible but untested in a browser bundle.

### 3.2 Layout

```
packages/orca-plugin/
  orca-plugin.json
  package.json            # scripts: build, validate, check, test
  tsconfig.json           # extends ./.orca/types/tsconfig.json
  scripts/build.mjs       # builds webview (Orca mode), copies dist to ./webview, bundles worker
  src/
    protocol.ts           # declare module 'orca' { PluginRequests; PluginPanelEvents }
    worker.ts             # activate(orca): relay, settings, daemon, status bar
    worker.test.ts        # orca/testing mountWorker
  webview/                # build output, generated
    stage.html            # RETUNE_VIEW_MODE = "editor-tab"
    inspector.html        # RETUNE_VIEW_MODE = "sidebar"
    assets/index-*.js, index-*.css
  .orca/                  # generated typings, self-ignored
```

Shared code to extract so both hosts use it (new, small): a host-agnostic stage controller holding what is currently static state in `StagePanel` (`_stageState`, `getActiveMetadata`, `handleSharedMessage` minus the `vscode` calls). VS Code's `stage-panel.ts` and the Orca in-frame host both call it. Suggested home: `packages/core/src/host/stage-controller.ts`.

Draft manifest. This exact content validated in the scratch folder:

```json
{
  "manifestVersion": 2,
  "id": "retune",
  "name": "Retune",
  "version": "0.1.0",
  "description": "Visual component stage for React, Tailwind and cva: tune classes and variants and write them back to source.",
  "engines": { "orca": ">=1.4.248" },
  "execution": "trusted-worker",
  "pluginApi": 1,
  "main": "src/worker.ts",
  "contributes": {
    "customEditors": [
      {
        "id": "retune-stage",
        "title": "Retune",
        "extensions": [".tsx", ".jsx"],
        "entry": "webview/stage.html",
        "priority": "option",
        "contentKind": "text",
        "frame": "isolated"
      }
    ],
    "panels": [
      { "id": "retune-inspector", "title": "Retune Inspector", "icon": "layers", "entry": "webview/inspector.html" }
    ],
    "commands": [
      { "id": "retune.toggleInspector", "title": "Retune: Toggle Inspector Sidebar", "when": "workspace", "action": "sidebar.right.toggle" },
      { "id": "retune.showInspector", "title": "Retune: Daemon Status", "when": "global" }
    ],
    "keybindings": [
      { "command": "retune.toggleInspector", "key": "Mod+Shift+R", "when": "workspace" }
    ],
    "settings": [
      { "key": "daemon.port", "title": "Daemon port", "type": "integer", "default": 49221, "minimum": 1024, "maximum": 65535 },
      { "key": "stage.defaultViewport", "title": "Default viewport", "type": "string", "enum": ["responsive", "mobile", "tablet", "desktop"], "default": "responsive" },
      { "key": "stage.showGrid", "title": "Show grid", "type": "boolean", "default": true },
      { "key": "scalar.layout", "title": "API console layout", "type": "string", "enum": ["modern", "classic"], "default": "modern" }
    ],
    "statusBarItems": [
      { "id": "retune-daemon", "text": "Retune", "icon": "layers", "tooltip": "Retune daemon", "command": "retune.showInspector" }
    ]
  },
  "capabilities": [
    { "kind": "settings:own" },
    { "kind": "storage:own" },
    { "kind": "workspace:read" }
  ]
}
```

Decision to make before building: **worker or no worker.** A `sandboxed-ui` plugin (custom editor plus panel, no `main`, no worker commands, no status bar updates) asks the user for far less: "Shows its own code in sandboxed panels or editors inside Orca; an editor reads every file it opens." The `trusted-worker` profile's consent line is "Runs its own code in a separate Node.js process on the Orca host, with your user account's access to that machine." Stage plus inspector can sync through `orca.storage` + `storage.onDidChange` with no worker at all. The worker only buys the daemon, worker commands and the status item. Recommendation: ship phase 1 as `sandboxed-ui` (drop `main`, the `retune.showInspector` command, `statusBarItems`, `workspace:read`; set `execution: "sandboxed-ui"`), add the worker in phase 2 only if the daemon is wanted inside Orca.

### 3.3 What the worker does (phase 2)

- `orca.panels.handle('retune.publish', snapshot)`: the stage frame publishes `{ meta (without rawSource), stageState }`; the worker caches it and `orca.panels.post('retune.host', hostMessage)` to all frames so the inspector updates.
- `orca.panels.handle('retune.webviewMessage', msg)`: the inspector's `WebviewMessage` (variant change, prop value, stage state) is posted on to the stage frame, which owns the document.
- `orca.panels.handle('retune.snapshot')`: returns the cached snapshot for a frame that just opened.
- Starts `createRetuneDaemon(await orca.settings.get('daemon.port'))` in `activate`, closes it in `deactivate`, reflects state with `statusBar.update`.
- `orca.commands.register('retune.showInspector', ...)`: returns a status string.
- Keep nothing important in memory: a save of `worker.ts` restarts it. The snapshot cache can be rebuilt by asking frames to republish.
- The worker should be bundled to one ESM file (esbuild) if it imports `@retune/engine` / `@retune/core`; whether Orca resolves `node_modules` for a worker at install time is unverified.

### 3.4 Orca host adapter for `{ kind, post, subscribe }`

Detection: `typeof window.orca !== 'undefined'` gives `kind: 'orca'`. `window.orca.document !== undefined` distinguishes the editor surface (Stage) from the panel surface (inspector).

Editor surface, where the adapter is an in-frame host:

- On creation: `const session = await orca.document.session<string>({ merge })`. Build `ComponentMetadata` from `session.value` with `extractCvaMetadata` / `analyzeProps`. `filePath` is unavailable: set it to `''` and derive `componentName` from the source (first exported component or the cva identifier) rather than the file basename.
- `subscribe(cb)`: deliver `SYNC_COMPONENT`, `SYNC_STAGE_STATE`, `SYNC_CONFIG` on start; re-deliver `SYNC_COMPONENT` from `session.onReplace`; map `orca.on('theme', t => cb({ type: 'THEME_CHANGED', payload: { isDark: t.colorScheme === 'dark', highContrast: false } }))`; initial theme from `document.documentElement.classList.contains('dark')`; `orca.settings.onDidChange` to `SYNC_CONFIG`.
- `post(msg)`:
  - `READY`: replay the three sync messages.
  - `MUTATE_CLASSES` / `MUTATE_VARIANT`: `const next = mutateClassName(session.value, ...)`; if changed, `session.change(next)`, then re-analyze and emit `SYNC_COMPONENT`. Optionally emit `MUTATION_SUCCESS`.
  - `UPDATE_STAGE_STATE`, `UPDATE_PROP_VALUE`, `SWITCH_TAB`: update local state, emit `SYNC_STAGE_STATE`, publish to the inspector.
  - `UPDATE_CONFIG`: `orca.settings.set(key, value)` per changed key, using the same key mapping as `extension-config.ts` (`daemon.port`, `stage.defaultViewport`, `stage.showGrid`, `scalar.layout`).
  - `OPEN_STAGE_TAB`: no-op.
- Publishing to the inspector: `orca.storage.set('retune.snapshot', ...)` (worker-less) or `orca.plugin.request('retune.publish', ...)`. Strip `rawSource` and stay under 64 KiB. Publish on `focus` / `visibilitychange` so the most recently focused Stage frame is the one the inspector follows.
- Must provide a `merge(base, outside, mine)`; simplest safe choice is "outside wins, then re-apply the last class mutation".
- Must keep its own undo stack for mutations, since Ctrl/Cmd+Z is delivered to the frame.
- Throttle: all frames share 120 host calls per 10 s and the editor 60 edits per 10 s. Slider drags need a trailing debounce of 150 ms or more before `post`.

Panel surface (inspector):

- `subscribe(cb)`: `orca.storage.onDidChange` on the snapshot key (or `orca.plugin.on('retune.host', cb)`), plus theme and settings as above.
- `post(msg)`: write an intent to storage (or `orca.plugin.request('retune.webviewMessage', msg)`) for the active Stage frame to apply. With no Stage frame open, the inspector shows an empty state telling the user to switch a `.tsx` tab to the Retune view.

For type-checking `window.orca` inside `packages/webview`, declare a minimal structural interface in `host.ts` (only `document.session`, `plugin`, `storage`, `settings`, `on`) instead of depending on the generated `orca/frame` typings, so the webview package builds without the Orca CLI.

### 3.5 `--rt-*` token mapping for Orca

Chain each token so one stylesheet works in both hosts with no host detection:

```css
--rt-bg: var(--vscode-editor-background, var(--orca-background, #09090b));
```

| Purpose (`--rt-*`, names to be aligned with the refactor) | VS Code source | Orca source | Fallback |
|---|---|---|---|
| surface background | `--vscode-editor-background` | `--orca-background` | `#09090b` |
| text | `--vscode-foreground` / `--vscode-editor-foreground` | `--orca-foreground` | `#e4e4e7` |
| raised surface (cards, sidebar sections) | `--vscode-sideBar-background` / `--vscode-editorWidget-background` | `--orca-card` | |
| text on raised surface | `--vscode-sideBar-foreground` | `--orca-card-foreground` | |
| popover / dropdown | `--vscode-dropdown-background` / `--vscode-menu-background` | `--orca-popover`, `--orca-popover-foreground` | |
| muted surface | `--vscode-editor-inactiveSelectionBackground` | `--orca-muted` | |
| muted text | `--vscode-descriptionForeground` | `--orca-muted-foreground` | |
| border | `--vscode-panel-border` / `--vscode-widget-border` | `--orca-border` | |
| input border | `--vscode-input-border` | `--orca-input` | |
| input background | `--vscode-input-background` | `--orca-background` (no dedicated token) | |
| focus ring | `--vscode-focusBorder` | `--orca-ring` | |
| primary button | `--vscode-button-background` / `--vscode-button-foreground` | `--orca-primary` / `--orca-primary-foreground` | |
| secondary button | `--vscode-button-secondaryBackground` / `-secondaryForeground` | `--orca-secondary` / `--orca-secondary-foreground` | |
| hover / selected row | `--vscode-list-hoverBackground` / `--vscode-list-activeSelectionBackground` | `--orca-accent` / `--orca-accent-foreground` | |
| danger | `--vscode-errorForeground` | `--orca-destructive` / `--orca-destructive-foreground` | |
| radius | none | `--orca-radius` | `6px` |
| UI font family and size | `--vscode-font-family`, `--vscode-font-size` | none | `system-ui, sans-serif`, `13px` |
| code font | `--vscode-editor-font-family`, `--vscode-editor-font-size` | none | `ui-monospace, monospace` |

Also needed: replace `:root { color-scheme: dark }` with `:where(html.light){color-scheme:light}` / `:where(html.dark){color-scheme:dark}` handling, and treat `--orca-*` values as opaque colours (use them directly or with `color-mix()`, never by splitting channels).

## 4. Risks and open questions (ranked)

1. **The React bundle has never been run inside an Orca frame.** Static check passes, runtime is unknown: module script with the `crossorigin` attribute on the `orca-plugin-frame://` scheme, React 19, Scalar's Vue runtime, `localStorage`, focus events. Resolve: with the user's approval, `orca plugin dev watch packages/orca-plugin --check`, then `orca plugin shot <key> --editor examples/<file>.tsx` and `orca plugin dev inspect <key>` for console errors.
2. **The Stage model changes from "one panel following the active editor" to "one editor frame per file".** This affects the stage state model, the inspector sync and every command. Resolve: confirm with the product owner that "Retune toggle on a `.tsx` tab" is acceptable UX before any code; prototype with the `editor` template.
3. **`@retune/core` in the browser.** Babel parser/traverse and `recast` must bundle and run in a frame without `eval` and without Node shims; bundle size grows. Resolve: a Vite build of a tiny page calling `extractCvaMetadata` and `mutateClassName`, then `orca plugin check` for `editor_eval` warnings.
4. **Undo and conflict semantics.** Orca keeps no undo history for custom editors, and an agent writing the file while the Stage has unsent edits needs a `merge`. Whether Source-view undo covers edits made in the Retune view is unknown. Resolve: test in a dev load; implement a mutation-level undo stack and a conservative merge.
5. **No CDN Tailwind.** Arbitrary or unsafelisted classes typed in the Stage may not render. Resolve: audit what the CDN script currently provides versus `lib/arbitrary-style.ts` and the safelist; run the VS Code build with the CDN tag removed and compare.
6. **Inspector sync and rate limits.** 64 KiB per frame message, 120 calls per 10 s shared across frames, 256 KiB per worker post. `ComponentMetadata.rawSource` can exceed this. Resolve: never send `rawSource` across frames; debounce; measure with a large component file.
7. **Scalar API console.** No network from the frame. Resolve: decide between inline spec with "try it" disabled, a worker proxy via `plugin.request`, or hiding the tab under Orca.
8. **Distribution.** Catalog and Git installs hash committed files (`release-entry` uses HEAD), the plugin folder must contain the built `webview/` output, and it may not reference files outside itself. A monorepo subfolder works through catalog `source.path`, but build output would have to be committed. Publisher is derived from the repository owner. Resolve: choose between a release branch, or a CI-published separate repository; run `orca plugin release-entry` on a trial commit.
9. **Worker dependencies.** Unverified whether an installed plugin's worker can import from `node_modules`. Resolve: bundle the worker to one `.mjs`; confirm with `orca plugin test` and a dev load.
10. **Worker lifetime for the daemon.** The typings say a worker with status bar items is kept running; not observed. Resolve: dev load and `orca plugin logs`.
11. **Browser clients (`orca serve`).** Multi-file html frames do not load there. `frame: "isolated"` makes the editor fall back to Source with a notice; the html panel has no such field and its behaviour on a browser client is unknown. Resolve: accept desktop-only, document it.
12. **Keybinding conflict.** `Mod+Shift+R` may already be bound in Orca. "Each chord may be bound once on every platform." Resolve: check during the first dev load; pick another chord if refused.
13. **Token value format and missing font tokens.** Resolve: read computed values in DevTools during a dev load; `orca plugin shot --theme light` and `--theme dark`.
14. **CI validation.** `orca plugin validate` / `check` need the Orca CLI, which CI runners do not have. The docs mention `pnpm validate:plugin` inside Orca's own repo. Resolve: ask upstream whether a standalone validator package exists; otherwise keep these as local pre-release steps.
15. **Frame lifetime when hidden.** No `retainContextWhenHidden` equivalent is documented. Resolve: persist `StageState` in `orca.storage`; observe during a dev load.
16. **Issue #1 deliverables that cannot be met now:** agent skills and MCP contribution. Resolve: update the issue; track Orca's reserved `skills` / `mcpServers` points.

## 5. Task outline

Each task lists files and how to verify. Tasks 1 to 6 need no Orca host state. Task 9 onward needs the user to approve a development load.

1. **Extract a host-agnostic stage controller.**
   Files: `packages/core/src/host/stage-controller.ts` (new), `packages/core/src/index.ts`, `packages/vscode-extension/src/providers/stage-panel.ts`.
   Move stage state, metadata building from a source string, and `WebviewMessage` handling out of `StagePanel`; inject `getText`, `applyText`, `getConfig`, `updateConfig`, `emit`.
   Verify: `pnpm --filter @retune/core test`, `pnpm --filter retune-vscode test`, `pnpm --filter retune-vscode lint`.

2. **Derive `componentName` without a file path.**
   Files: `packages/core/src/ast/` (new helper), tests in `packages/core/src/__tests__/`.
   Verify: `pnpm --filter @retune/core test`.

3. **Remove the webview's dependence on remote and loopback resources.**
   Files: `packages/webview/src/index.html`, `packages/webview/src/App.tsx`, `packages/webview/src/components/api-console/scalar-view.tsx`, `packages/vscode-extension/src/providers/webview-html.ts`.
   Drop the CDN Tailwind tag (or gate it to VS Code), pass `openApiSpec` inline, route the standalone mutate call through the host adapter.
   Verify: `pnpm --filter @retune/webview build`; `grep -c "cdn.tailwindcss" packages/webview/dist/index.html` prints `0`.

4. **Add the Orca host adapter** (after the `host.ts` refactor lands).
   Files: `packages/webview/src/lib/host.ts`, `packages/webview/src/lib/host-orca.ts` (new), `packages/webview/src/__tests__/host-orca.test.ts` (new, fake `window.orca`).
   Implement section 3.4 for both surfaces.
   Verify: `pnpm --filter @retune/webview test`.

5. **Add `--orca-*` fallbacks to the `--rt-*` tokens and light/dark handling.**
   Files: `packages/webview/src/styles.css`.
   Verify: `pnpm --filter @retune/webview build`; `grep -c -- "--orca-background" packages/webview/dist/assets/*.css` is at least 1.

6. **Scaffold `packages/orca-plugin`.**
   Files: `packages/orca-plugin/orca-plugin.json` (section 3.2, phase 1 variant without `main`), `package.json`, `tsconfig.json`, `scripts/build.mjs`, `webview/stage.html`, `webview/inspector.html` (generated), `.gitignore`.
   `scripts/build.mjs` builds the webview and copies `dist/assets` into `packages/orca-plugin/webview/assets`, then writes the two HTML files with the hashed asset names.
   Verify: `orca plugin types packages/orca-plugin`; `orca plugin validate packages/orca-plugin` exits 0; `orca plugin inspect packages/orca-plugin` lists `customEditors: Retune` and `panels: Retune Inspector`.

7. **Static check of the editor bundle.**
   Files: none new.
   Verify: `orca plugin check packages/orca-plugin` exits 0; review every `editor_eval` warning and record why each is safe or fix it.

8. **Add settings.**
   Files: `packages/orca-plugin/orca-plugin.json`, `packages/webview/src/lib/host-orca.ts`.
   Verify: `orca plugin validate packages/orca-plugin`; adapter unit test for the key mapping.

9. **First development load (needs user approval of the fingerprint).**
   Files: none.
   Verify: `orca plugin dev watch packages/orca-plugin --check`; `orca plugin open local.retune --editor examples/<component>.tsx`; `orca plugin shot local.retune --editor examples/<component>.tsx --theme dark` and `--theme light`; `orca plugin shot local.retune --panel retune-inspector`; `orca plugin logs local.retune` shows no errors.

10. **Round-trip edit test in Orca.**
    Change a class in the Stage, confirm the Source view and the file on disk after save, then undo.
    Verify: `orca plugin shot local.retune --editor <copy>.tsx --act '[{"click":[x,y]}]'` exits 0 and the temp copy shows the new class; manual save and undo check.

11. **Inspector sync.**
    Files: `packages/webview/src/lib/host-orca.ts`.
    Verify: with a Stage frame open, change a variant in the inspector and confirm the Stage updates; `orca plugin logs local.retune` shows no `rate_limited` or `too_large`.

12. **(Phase 2) Worker: relay, daemon, status item, command.**
    Files: `packages/orca-plugin/src/worker.ts`, `src/protocol.ts`, `src/worker.test.ts`, manifest (`execution: "trusted-worker"`, `main`, `statusBarItems`, worker command), `scripts/build.mjs` (bundle worker).
    Verify: `orca plugin test packages/orca-plugin`; `orca plugin validate packages/orca-plugin`; after a dev load, `orca plugin dev request packages/orca-plugin retune.snapshot`; `curl http://127.0.0.1:49221/v1/openapi.json`.

13. **Release path.**
    Files: CI workflow or release script, `README.md` section for Orca.
    Verify: `orca plugin release-entry <release checkout>` prints an entry; `orca plugin validate` on the release tree exits 0.

14. **Update issue #1** with the corrections in section 0 and the phase split.
