import { useNavigate } from 'react-router-dom';
import {
  UserRound, CalendarCheck, CalendarOff, Wallet, FolderOpen, ClipboardList, Bell,
} from 'lucide-react';
import { essService } from '../../services/essService';
import { essLeaveService } from '../../services/essLeaveService';
import { essAttendanceService } from '../../services/essAttendanceService';
import { payslipService } from '../../services/payslipService';
import { documentService } from '../../services/documentService';
import { hrRequestService } from '../../services/hrRequestService';
import { notificationService } from '../../services/notificationService';
import { useFetch } from '../../hooks/useFetch';
import { formatCurrencyFromMinorUnits, formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import { StatCardSkeleton } from '../../components/ui/Skeleton';
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
  documents: { icon: FolderOpen, to: '/ess/documents' },
  requests: { icon: ClipboardList, to: '/ess/requests' },
  notifications: { icon: Bell, to: '/notifications' },
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

function SummaryTile({ icon: Icon, label, value, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex flex-col items-start rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-shadow hover:shadow-card-md"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className="mt-2.5 text-[13px] text-ink-500">{label}</span>
      <span className="mt-0.5 text-xl font-semibold tracking-tight text-ink-900">{value}</span>
      {sub && <span className="mt-0.5 text-xs text-ink-400">{sub}</span>}
    </button>
  );
}

// One tile per capability, only fetched when that capability is actually
// available — an unavailable/restricted/coming-soon capability never fires
// its request, so a suspended or not-yet-linked account never sees a doomed
// API call fail in the console.
function LeaveTile({ navigate }) {
  const { data: balances, loading } = useFetch(() => essLeaveService.getBalance(), []);
  if (loading) return <StatCardSkeleton />;
  const remaining = (balances || []).reduce((sum, b) => sum + (b.remaining || 0), 0);
  const pending = (balances || []).reduce((sum, b) => sum + (b.pending || 0), 0);
  return (
    <SummaryTile
      icon={CalendarOff}
      label="Leave balance"
      value={`${remaining} days`}
      sub={pending > 0 ? `${pending} pending` : 'No pending requests'}
      onClick={() => navigate('/ess/leave')}
    />
  );
}

function AttendanceTile({ navigate }) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const { data: summary, loading } = useFetch(() => essAttendanceService.getMySummary({ startDate, endDate }), []);
  if (loading) return <StatCardSkeleton />;
  return (
    <SummaryTile
      icon={CalendarCheck}
      label="Attendance this month"
      value={`${summary?.attendanceRate ?? 0}%`}
      sub={summary ? `${summary.present} present · ${summary.late} late · ${summary.absent} absent` : 'No records yet'}
      onClick={() => navigate('/ess/attendance')}
    />
  );
}

function PayrollTile({ navigate }) {
  const { data: overview, loading } = useFetch(() => payslipService.getMyOverview(), []);
  if (loading) return <StatCardSkeleton />;
  if (!overview?.hasPayslips) {
    return <SummaryTile icon={Wallet} label="Payroll" value="—" sub="No payslips yet" onClick={() => navigate('/my-payslips')} />;
  }
  return (
    <SummaryTile
      icon={Wallet}
      label="Latest net pay"
      value={formatCurrencyFromMinorUnits(overview.latestPayslip.netPayMinorUnits, overview.latestPayslip.currency)}
      sub={overview.latestPayslip.period?.payDate ? `Paid ${formatDate(overview.latestPayslip.period.payDate)}` : undefined}
      onClick={() => navigate('/my-payslips')}
    />
  );
}

function DocumentsTile({ navigate }) {
  const { data, loading } = useFetch(() => documentService.getMyDocuments({ limit: 1 }), []);
  if (loading) return <StatCardSkeleton />;
  const total = data?.pagination?.total ?? 0;
  return (
    <SummaryTile
      icon={FolderOpen}
      label="My documents"
      value={total}
      sub={total === 1 ? '1 document available' : `${total} documents available`}
      onClick={() => navigate('/ess/documents')}
    />
  );
}

function HrRequestsTile({ navigate }) {
  const { data, loading } = useFetch(() => hrRequestService.getRequests({ limit: 5 }), []);
  if (loading) return <StatCardSkeleton />;
  const requests = data?.data || [];
  const open = requests.filter((r) => !['RESOLVED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(r.status));
  return (
    <SummaryTile
      icon={ClipboardList}
      label="HR requests"
      value={data?.pagination?.total ?? 0}
      sub={open.length > 0 ? `${open.length} in progress` : 'None in progress'}
      onClick={() => navigate('/ess/requests')}
    />
  );
}

function NotificationsTile({ navigate }) {
  const { data, loading } = useFetch(() => notificationService.getUnreadCount(), []);
  if (loading) return <StatCardSkeleton />;
  const count = data?.data?.count ?? 0;
  return (
    <SummaryTile
      icon={Bell}
      label="Notifications"
      value={count}
      sub={count > 0 ? 'Unread' : 'All caught up'}
      onClick={() => navigate('/notifications')}
    />
  );
}

const SUMMARY_TILES = {
  leave: LeaveTile,
  attendance: AttendanceTile,
  payroll: PayrollTile,
  documents: DocumentsTile,
  requests: HrRequestsTile,
  notifications: NotificationsTile,
};

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

  const availableSummaryKeys = Object.entries(context.capabilities)
    .filter(([key, cap]) => cap.status === 'available' && SUMMARY_TILES[key])
    .map(([key]) => key);

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

      {availableSummaryKeys.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Overview</h2>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {availableSummaryKeys.map((key) => {
              const Tile = SUMMARY_TILES[key];
              return <Tile key={key} navigate={navigate} />;
            })}
          </div>
        </>
      )}

      <h2 className="mb-3 text-sm font-semibold text-ink-900">Self-service</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(context.capabilities).map(([key, capability]) => (
          <CapabilityCard key={key} capabilityKey={key} capability={capability} navigate={navigate} />
        ))}
      </div>
    </div>
  );
}
