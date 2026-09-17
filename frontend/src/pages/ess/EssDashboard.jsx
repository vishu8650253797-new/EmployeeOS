import { useNavigate } from 'react-router-dom';
import {
  UserRound, CalendarCheck, CalendarOff, Wallet, FolderOpen, ClipboardList, Bell,
} from 'lucide-react';
import { essService } from '../../services/essService';
import { useFetch } from '../../hooks/useFetch';
import PageHeader from '../../components/layout/PageHeader';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import { ErrorState, LoadingState } from '../../components/ui/States';

// Capabilities the backend already reports on (utils/essAccess.js is
// authoritative on availability) — this only maps a key to its icon and,
// where one already exists, the page it should link to. A capability with
// no route here still renders, just without a "Go" action.
const CAPABILITY_UI = {
  profile: { icon: UserRound, to: '/ess/profile' },
  attendance: { icon: CalendarCheck, to: '/ess/attendance' },
  leave: { icon: CalendarOff, to: '/ess/leave' },
  payroll: { icon: Wallet, to: '/my-payslips' },
  documents: { icon: FolderOpen, to: '/my-documents' },
  requests: { icon: ClipboardList },
  notifications: { icon: Bell },
};

const CAPABILITY_STATUS_UI = {
  available: { label: 'Available', tone: 'success' },
  restricted: { label: 'Restricted', tone: 'warning' },
  coming_soon: { label: 'Coming soon', tone: 'neutral' },
  not_permitted: { label: 'Not permitted', tone: 'danger' },
};

function CapabilityCard({ capabilityKey, capability, navigate }) {
  const ui = CAPABILITY_UI[capabilityKey] || {};
  const Icon = ui.icon || ClipboardList;
  const statusUi = CAPABILITY_STATUS_UI[capability.status] || { label: capability.status, tone: 'neutral' };
  const isClickable = capability.status === 'available' && Boolean(ui.to);

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={() => isClickable && navigate(ui.to)}
      className={`focus-ring flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-shadow ${
        isClickable ? 'hover:shadow-card-md' : 'opacity-70'
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="flex-1">
        <span className="block text-[13px] font-semibold text-ink-900">{capability.label}</span>
        <span className="mt-1 inline-block">
          <Badge tone={statusUi.tone}>{statusUi.label}</Badge>
        </span>
      </span>
    </button>
  );
}

export default function EssDashboard() {
  const navigate = useNavigate();
  const { data: context, loading, error, refetch } = useFetch(() => essService.getMe(), []);

  if (loading) return <LoadingState label="Loading your workspace…" />;

  if (error) {
    // useFetch only preserves the error message text (see hooks/useFetch.js),
    // so the two distinct backend states are told apart by their exact,
    // stable message text (backend/src/utils/essAccess.js) rather than an
    // HTTP status code.
    if (/no employee record/i.test(error)) {
      return (
        <ErrorState
          title="No employee record found"
          message="Your account isn't linked to an employee record yet. Contact HR to get this set up before you can use self-service features."
        />
      );
    }
    if (/employee record is inactive/i.test(error)) {
      return (
        <ErrorState
          title="Account inactive"
          message="Your employee record is currently inactive, so self-service access is unavailable. Contact HR if you believe this is a mistake."
        />
      );
    }
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (!context) return null;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${context.displayName}`}
        subtitle={context.organizationName ? `${context.jobTitle || ''} · ${context.organizationName}` : context.jobTitle}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-500">Employment status:</span>
        <StatusBadge status={context.employeeStatus} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-ink-900">Self-service</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(context.capabilities).map(([key, capability]) => (
          <CapabilityCard key={key} capabilityKey={key} capability={capability} navigate={navigate} />
        ))}
      </div>
    </div>
  );
}
