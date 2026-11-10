import React from 'react';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

export interface ScalarViewProps {
  isDark: boolean;
  specUrl?: string;
  layout?: 'modern' | 'classic';
}

export function ScalarView({
  isDark,
  specUrl = 'http://127.0.0.1:49221/v1/openapi.json',
  layout = 'modern',
}: ScalarViewProps) {
  return (
    <div className="h-full w-full overflow-y-auto">
      <ApiReferenceReact
        configuration={
          {
            url: specUrl,
            spec: { url: specUrl },
            darkMode: isDark,
            layout,
          } as any
        }
      />
    </div>
  );
}
