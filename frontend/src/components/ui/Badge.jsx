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
  // Asset lifecycle statuses
  AVAILABLE: 'success',
  RESERVED: 'info',
  ASSIGNED: 'brand',
  IN_MAINTENANCE: 'warning',
  DAMAGED: 'danger',
  LOST: 'danger',
  RETURNED: 'neutral',
  RETIRED: 'neutral',
  DISPOSED: 'neutral',
  // Asset condition
  NEW: 'success',
  EXCELLENT: 'success',
  GOOD: 'info',
  FAIR: 'warning',
  // Asset request / maintenance statuses
  FULFILLED: 'success',
  OPEN: 'warning',
  WAITING_FOR_PARTS: 'warning',
  // Warranty status (ACTIVE reuses the tone mapped above)
  EXPIRING_SOON: 'warning',
  EXPIRED: 'danger',
  NONE: 'neutral',
  // Offboarding lifecycle statuses
  DRAFT: 'neutral',
  INITIATED: 'info',
  PENDING_APPROVAL: 'warning',
  NOTICE_PERIOD: 'brand',
  CLEARANCE_IN_PROGRESS: 'warning',
  FINAL_REVIEW: 'info',
  // Offboarding approval / clearance sub-statuses
  MANAGER_APPROVED: 'info',
  NOT_STARTED: 'neutral',
  CLEARED: 'success',
  BLOCKED: 'danger',
  // Asset / document clearance aggregate statuses
  NOT_APPLICABLE: 'neutral',
  PARTIAL: 'warning',
  // Exit interview / access deactivation / knowledge transfer statuses
  NOT_SCHEDULED: 'neutral',
  SCHEDULED: 'info',
  WAIVED: 'neutral',
  DEACTIVATED: 'success',
  FAILED: 'danger',
  NOT_REQUIRED: 'neutral',
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
