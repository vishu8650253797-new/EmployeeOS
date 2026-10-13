import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

// Android/Chrome-family browsers fire `beforeinstallprompt` only when the
// platform's own installability criteria are already met (valid manifest,
// service worker, HTTPS, etc.) — this never forces a popup, it just exposes
// a button when the browser says installation is actually available.
// iOS Safari never fires this event (there is no native beforeinstallprompt
// API there); users there install via Share → Add to Home Screen instead,
// which the apple-mobile-web-app meta tags in index.html already support.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }
    function onInstalled() {
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferredPrompt || dismissed) return null;

  async function handleInstall() {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] w-full max-w-sm -translate-x-1/2 px-4 sm:bottom-24 sm:left-auto sm:right-6 sm:translate-x-0 sm:px-0">
      <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-pop">
        <Download size={18} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm text-ink-700">Install EmployeeOS for quicker access.</p>
          <button
            type="button"
            onClick={handleInstall}
            className="focus-ring mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
          >
            Install
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss install prompt"
          className="focus-ring rounded-md p-0.5 text-ink-400 transition-colors hover:text-ink-700"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
