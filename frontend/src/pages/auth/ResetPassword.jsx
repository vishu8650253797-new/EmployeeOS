import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/authService';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function ResetPassword() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || 'demo-token';

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate() {
    const next = {};
    if (!form.password) next.password = 'New password is required';
    else if (form.password.length < 8) next.password = 'Use at least 8 characters';
    if (!form.confirm) next.confirm = 'Please confirm your password';
    else if (form.confirm !== form.password) next.confirm = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await authService.resetPassword({ token, password: form.password });
      toast('Password updated. Please sign in with your new password.');
      navigate('/login');
    } catch (err) {
      toast(err.message || 'Unable to reset password.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink-900">Set a new password</h1>
      <p className="mt-1.5 text-[13px] text-ink-500">
        Choose a strong password you haven&apos;t used before on EmployeeOS.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
        <div className="relative">
          <Input
            label="New password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            error={errors.password}
            hint={!errors.password ? 'Use 8+ characters with a mix of letters and numbers.' : undefined}
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

        <Input
          label="Confirm new password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          required
          value={form.confirm}
          onChange={(v) => setForm((f) => ({ ...f, confirm: v }))}
          error={errors.confirm}
        />

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? 'Updating password…' : 'Reset password'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-500">
        Remembered it?{' '}
        <Link
          to="/login"
          className="focus-ring rounded-md font-medium text-brand-600 hover:text-brand-700"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
