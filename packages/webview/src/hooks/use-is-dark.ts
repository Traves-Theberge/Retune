import { useEffect, useState } from 'react';

function readIsDark(): boolean {
  return typeof document === 'undefined' || !document.body.classList.contains('vscode-light');
}

/** True unless the VS Code host marked the body as a light theme. Follows class changes. */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(readIsDark()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setIsDark(readIsDark());
    return () => observer.disconnect();
  }, []);

  return isDark;
}
