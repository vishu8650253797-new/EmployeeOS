import { Inbox, AlertCircle, Loader2, RotateCw } from 'lucide-react';
import Button from './Button';

// Shared page-level states: Empty, Error, Loading.

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  message,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-400/10 text-ink-400">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-[13px] text-ink-500">{message}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this data. Please try again.',
  onRetry,
  className = '',
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <AlertCircle size={22} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-ink-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          <RotateCw size={14} />
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Loading…', className = '' }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-3 px-6 py-14 ${className}`}
    >
      <Loader2 size={22} className="animate-spin text-brand-600" aria-hidden="true" />
      <p className="text-[13px] text-ink-500">{label}</p>
    </div>
  );
}
