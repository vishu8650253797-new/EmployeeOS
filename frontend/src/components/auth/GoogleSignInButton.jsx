import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Renders Google's own "Sign in with Google" button via the Identity
// Services script (loaded in index.html). One button handles both signup
// and login: the backend creates a new organization for a first-time
// Google email, or logs an existing one in — see authService.googleAuth.
export default function GoogleSignInButton() {
  const { googleAuth } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID || !buttonRef.current) return undefined;

    let cancelled = false;
    let pollInterval = null;

    async function handleCredentialResponse(response) {
      try {
        const { isNewUser } = await googleAuth(response.credential);
        toast(isNewUser ? 'Welcome to EmployeeOS! Your workspace is ready.' : 'Welcome back to EmployeeOS');
        navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
      } catch (err) {
        toast(err.message || 'Google sign-in failed. Please try again.', 'error');
      }
    }

    function init() {
      if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredentialResponse });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 328,
        text: 'continue_with',
      });
    }

    if (window.google?.accounts?.id) {
      init();
    } else {
      // The GSI script tag uses async/defer, so it may not be attached to
      // `window` yet on first render — poll briefly rather than assume.
      pollInterval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(pollInterval);
          init();
        }
      }, 100);
      setTimeout(() => pollInterval && clearInterval(pollInterval), 10000);
    }

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
    // Intentionally runs once on mount only — re-running would re-initialize
    // and re-render Google's own button unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Not configured yet (no Client ID) — render nothing rather than a broken button.
  if (!CLIENT_ID) return null;

  return <div ref={buttonRef} className="flex justify-center" />;
}
