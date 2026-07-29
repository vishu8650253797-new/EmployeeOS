import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    email: import.meta.env.DEV ? 'admin@employeeos.io' : '',
    password: import.meta.env.DEV ? 'Password123' : '',
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate() {
    const next = {};
    if (!form.email) next.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (!form.password) next.password = 'Password is required';
    else if (form.password.length < 6) next.password = 'Password must be at least 6 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(form);
      toast('Welcome back to EmployeeOS');
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      toast(err.message || 'Unable to sign in. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink-900">Sign in to EmployeeOS</h1>
      <p className="mt-1.5 text-[13px] text-ink-500">
        Enter your work credentials to access your workspace.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
        <Input
          label="Work email"
          type="email"
          name="email"
          autoComplete="off"
          placeholder="you@company.com"
          required
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          error={errors.email}
        />

        <div>
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="off"
              placeholder="••••••••"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              error={errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="focus-ring absolute right-3 top-[34px] rounded-md p-0.5 text-ink-400 hover:text-ink-700"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-2 text-right">
            <Link
              to="/forgot-password"
              className="focus-ring rounded-md text-[13px] font-medium text-brand-600 hover:text-brand-700"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-line bg-canvas p-3.5 text-[13px] text-ink-500">
        <p className="font-medium text-ink-700">Dev account</p>
        <p className="mt-1">
          Start backend with <code className="rounded bg-surface px-1 text-ink-700">SEED_ADMIN=true</code>, then sign in with{' '}
          <span className="font-medium text-ink-700">admin@employeeos.io</span> /{' '}
          <span className="font-medium text-ink-700">Password123</span>.
        </p>
      </div>
    </div>
  );
}
