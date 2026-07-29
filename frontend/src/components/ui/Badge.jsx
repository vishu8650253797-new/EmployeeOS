const TONES = {
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  info: 'bg-info-50 text-info-700',
  neutral: 'bg-ink-400/10 text-ink-700',
  brand: 'bg-brand-50 text-brand-700',
};

// Maps common HR domain statuses to a visual tone.
export const STATUS_TONES = {
  ACTIVE: 'success',
  Active: 'success',
  PRESENT: 'success',
  Present: 'success',
  Approved: 'success',
  APPROVED: 'success',
  ON_LEAVE: 'info',
  'On Leave': 'info',
  Pending: 'warning',
  PENDING: 'warning',
  LATE: 'warning',
  Late: 'warning',
  Probation: 'warning',
  SUSPENDED: 'warning',
  HALF_DAY: 'warning',
  CANCELLED: 'neutral',
  INACTIVE: 'neutral',
  Inactive: 'neutral',
  ABSENT: 'danger',
  Absent: 'danger',
  Rejected: 'danger',
  REJECTED: 'danger',
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  IN_REVIEW: 'warning',
  BLOCKED: 'danger',
  DONE: 'success',
  PLANNING: 'neutral',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
};

export const PRIORITY_TONES = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

export default function Badge({ children, tone = 'neutral', dot = true, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className = '' }) {
  return (
    <Badge tone={STATUS_TONES[status] || 'neutral'} className={className}>
      {status}
    </Badge>
  );
}

export function PriorityBadge({ priority, className = '' }) {
  return (
    <Badge tone={PRIORITY_TONES[priority] || 'neutral'} className={className}>
      {priority}
    </Badge>
  );
}
