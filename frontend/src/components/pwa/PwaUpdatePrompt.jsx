import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

// A persistent (non-auto-dismissing) banner, deliberately separate from the
// toast system — toasts auto-dismiss after 4s, which isn't appropriate for
// an action the user needs time to notice and choose to act on. Styled to
// match the existing toast's visual language for consistency.
//
// Only the "new version available" case is surfaced to the user.
// useRegisterSW also reports `offlineReady`, which this intentionally does
// not display — this is an HR app with real payroll/leave/attendance data,
// and telling users the app "works offline" would misrepresent what's
// actually true (only static app-shell code is cached; no HR data is).
export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] w-full max-w-sm -translate-x-1/2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0 sm:px-0">
      <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-pop">
        <RefreshCw size={18} className="mt-0.5 shrink-0 text-info-600" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm text-ink-700">A new version of EmployeeOS is available.</p>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="focus-ring mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
          >
            Reload to update
          </button>
        </div>
      </div>
    </div>
  );
}
