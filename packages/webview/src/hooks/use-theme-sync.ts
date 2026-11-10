import { useState, useEffect } from 'react';
import { HostMessage } from '@retune/core';

export function useThemeSync(initialDark = true) {
  const [isDark, setIsDark] = useState<boolean>(initialDark);

  useEffect(() => {
    const handler = (event: MessageEvent<HostMessage>) => {
      if (event.data?.type === 'THEME_CHANGED') {
        setIsDark(event.data.payload.isDark);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return { isDark, setIsDark };
}

