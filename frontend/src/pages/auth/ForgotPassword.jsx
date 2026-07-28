import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { authService } from '../../services/authService';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email) return setError('Email is required');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address');
    setError('');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      toast(err.message || 'Unable to send reset link.', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600">
          <MailCheck size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink-900">Check your email</h1>
        <p className="mt-1.5 text-[13px] text-ink-500">
          We sent a password reset link to <span className="font-medium text-ink-700">{email}</span>.
          The link expires in 30 minutes.
        </p>
        <Link
          to="/login"
          className="focus-ring mt-6 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink-900">Forgot your password?</h1>
      <p className="mt-1.5 text-[13px] text-ink-500">
        Enter your work email and we&apos;ll send you a link to reset it.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
        <Input
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? 'Sending link…' : 'Send reset link'}
        </Button>
      </form>

      <Link
        to="/login"
        className="focus-ring mt-6 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-brand-600 hover:text-brand-700"
      >
        <ArrowLeft size={14} />
        Back to sign in
      </Link>
    </div>
  );
}
