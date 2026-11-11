export type ToastTone = 'success' | 'error' | 'info';
export interface ToastState {
  message: string;
  tone: ToastTone;
}

const toneClass: Record<ToastTone, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-fg',
};

export function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2">
      {toast && (
        <div className={`rounded border border-line bg-overlay px-3 py-1.5 text-xs shadow-lg ${toneClass[toast.tone]}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
