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
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-16 left-1/2 z-50 -translate-x-1/2">
      {toast && (
        <div className={`rounded-full border border-line bg-overlay/95 px-3.5 py-1.5 text-xs font-medium shadow-xl backdrop-blur ${toneClass[toast.tone]}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
