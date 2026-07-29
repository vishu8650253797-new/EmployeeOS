import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

const TOAST_STYLES = {
  success: { icon: CheckCircle2, iconClass: 'text-success-600' },
  error: { icon: AlertCircle, iconClass: 'text-danger-600' },
  info: { icon: Info, iconClass: 'text-info-600' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = 'success') => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  toast.success = (message) => toast(message, 'success');
  toast.error = (message) => toast(message, 'error');
  toast.info = (message) => toast(message, 'info');

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0 sm:px-0"
      >
        {toasts.map(({ id, message, type }) => {
          const { icon: Icon, iconClass } = TOAST_STYLES[type] || TOAST_STYLES.info;
          return (
            <div
              key={id}
              role="status"
              className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-pop"
            >
              <Icon size={18} className={`${iconClass} mt-0.5 shrink-0`} aria-hidden="true" />
              <p className="flex-1 text-sm text-ink-700">{message}</p>
              <button
                type="button"
                onClick={() => dismiss(id)}
                aria-label="Dismiss notification"
                className="focus-ring rounded-md p-0.5 text-ink-400 transition-colors hover:text-ink-700"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
