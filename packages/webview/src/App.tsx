import React, { useEffect, useState } from 'react';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import { Stage } from './components/stage/stage';
import { SidebarView } from './components/sidebar/sidebar-view';
import { StageHeader } from './components/stage-header';
import { Toast } from './components/ui';
import { NoComponent, ProblemBanner } from './components/shared/file-problem';
import { isTextField, matchShortcut } from './lib/shortcuts';
import { useIsDark } from './hooks/use-is-dark';
import { useStage } from './state/use-stage';

declare global {
  interface Window {
    RETUNE_VIEW_MODE?: 'editor-tab' | 'sidebar';
  }
}

function isSidebarMode(): boolean {
  return (
    window.RETUNE_VIEW_MODE === 'sidebar' ||
    new URLSearchParams(window.location.search).get('mode') === 'sidebar'
  );
}

export function App() {
  const store = useStage();
  const isDark = useIsDark();
  const { sync, undo, redo, stage, meta, config, hostKind } = store;
  const [tone, setTone] = useState<'dark' | 'light'>(isDark ? 'dark' : 'light');
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inTextField = isTextField(target as { tagName?: string; type?: string; isContentEditable?: boolean } | null);
      const action = matchShortcut(e, inTextField);
      if (!action) return;
      e.preventDefault();
      if (action === 'sync') {
        if (store.dirty) sync();
      }
      else if (action === 'undo') undo();
      else redo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sync, undo, redo, store.dirty]);

  if (isSidebarMode()) {
    return (
      <>
        <SidebarView store={store} />
        <Toast toast={store.toast} />
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-fg">
      {hostKind === 'standalone' && (
        <aside className="h-full w-72 shrink-0 overflow-hidden">
          <SidebarView store={store} embedded />
        </aside>
      )}

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <StageHeader store={store} onCompare={setComparing} />

        <main className={`relative flex-1 overflow-hidden ${tone === 'dark' ? 'bg-stage-dark' : 'bg-stage-light'}`}>
          {stage.activeTab === 'stage' &&
            (meta ? (
              <div className="flex h-full flex-col">
                <ProblemBanner problem={store.problem} />
                <div className="relative min-h-0 flex-1">
                  <Stage
                    store={store}
                    tone={tone}
                    comparing={comparing}
                    onToggleTone={() => setTone((t) => (t === 'dark' ? 'light' : 'dark'))}
                  />
                </div>
              </div>
            ) : (
              <NoComponent problem={store.problem} />
            ))}

          {stage.activeTab === 'ast' && (
            <div className="grid h-full grid-cols-1 divide-y divide-line overflow-hidden md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="space-y-4 overflow-y-auto p-4">
                <div>
                  <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-subtle">CVA variant AST</h3>
                  <pre className="overflow-x-auto rounded border border-line bg-raised p-3 font-mono text-[11px] text-fg">
                    {JSON.stringify(meta?.cva ?? { hasCva: false }, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-subtle">Props</h3>
                  <pre className="overflow-x-auto rounded border border-line bg-raised p-3 font-mono text-[11px] text-fg">
                    {JSON.stringify(meta?.props ?? [], null, 2)}
                  </pre>
                </div>
              </div>
              <div className="flex flex-col overflow-y-auto p-4">
                <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-subtle">
                  Source {meta?.filePath ? `• ${meta.filePath}` : ''}
                </h3>
                <pre className="flex-1 overflow-auto rounded border border-line bg-raised p-3 font-mono text-[11px] leading-relaxed text-muted">
                  {meta?.rawSource ?? '// Focus a .tsx file in VS Code to inspect its AST'}
                </pre>
              </div>
            </div>
          )}

          {stage.activeTab === 'api' && (
            <div className="h-full w-full overflow-y-auto">
              <ApiReferenceReact
                configuration={
                  {
                    url: `http://127.0.0.1:${config.daemonPort}/v1/openapi.json`,
                    spec: { url: `http://127.0.0.1:${config.daemonPort}/v1/openapi.json` },
                    darkMode: isDark,
                    layout: config.scalarLayout,
                  } as any
                }
              />
            </div>
          )}
        </main>
      </div>

      <Toast toast={store.toast} />
    </div>
  );
}
