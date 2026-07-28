import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 disabled:hover:bg-brand-600 shadow-card',
  secondary:
    'bg-surface text-ink-700 border border-line-strong hover:bg-canvas disabled:hover:bg-surface shadow-card',
  ghost: 'text-ink-500 hover:bg-ink-400/10 hover:text-ink-700',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 disabled:hover:bg-danger-600 shadow-card',
  dangerGhost: 'text-danger-600 hover:bg-danger-50',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-9 w-9',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`focus-ring inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
