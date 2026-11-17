import { useEffect, useState } from 'react';

function readIsDark(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.documentElement.classList.contains('light')) return false;
  if (document.body.classList.contains('vscode-light')) return false;
  return true;
}

/** True unless the host (VS Code or Orca) marked the document as a light theme. Follows class changes. */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(readIsDark()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setIsDark(readIsDark());
    return () => observer.disconnect();
  }, []);

  return isDark;
}
