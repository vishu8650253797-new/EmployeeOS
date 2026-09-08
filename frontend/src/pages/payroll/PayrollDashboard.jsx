import { Navigate, useNavigate } from 'react-router-dom';
import { Wallet, Users, TrendingDown, Clock, Layers, Sliders, CalendarRange, BarChart3 } from 'lucide-react';
import { payrollAnalyticsService } from '../../services/payrollAnalyticsService';
import { payrollRunService } from '../../services/payrollRunService';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { formatCurrencyFromMinorUnits, formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { StatCardSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];

function StatCard({ label, value, icon: Icon, tone = 'text-ink-900' }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-500">{label}</p>
        <Icon size={16} className="text-ink-400" aria-hidden="true" />
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}

function QuickLink({ label, description, icon: Icon, to, navigate }) {
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="focus-ring flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-shadow hover:shadow-card-md"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon size={17} aria-hidden="true" />
      </span>
      <span>
        <span className="block text-[13px] font-semibold text-ink-900">{label}</span>
        <span className="block text-xs text-ink-500">{description}</span>
      </span>
    </button>
  );
}

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);

  const { data: overview, loading: overviewLoading, error: overviewError, refetch: refetchOverview } = useFetch(
    () => (canView ? payrollAnalyticsService.getOverview() : Promise.resolve(null)),
    [canView]
  );
  const { data: runsData, loading: runsLoading } = useFetch(
    () => (canView ? payrollRunService.getRuns({ limit: 5 }) : Promise.resolve(null)),
    [canView]
  );

  if (!canView) {
    if (user?.employeeId) return <Navigate to="/my-payslips" replace />;
    return <ErrorState title="No access" message="You don't have permission to view payroll." />;
  }

  const runs = runsData?.data || [];
  const latestRun = overview?.latestRun;

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Salary structures, compensation, and payroll processing"
        actions={
          <Button onClick={() => navigate('/payroll/runs/new')}>
            <Wallet size={15} />
            New Payroll Run
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {overviewLoading ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : overviewError ? (
          <div className="col-span-full">
            <ErrorState message={overviewError} onRetry={refetchOverview} />
          </div>
        ) : (
          [
            { label: 'Latest period', value: latestRun?.periodLabel || '—', icon: CalendarRange },
            { label: 'Employees paid', value: latestRun?.employeeCount ?? '—', icon: Users },
            { label: 'Gross payroll', value: latestRun ? formatCurrencyFromMinorUnits(latestRun.totalGrossMinorUnits) : '—', icon: Wallet, tone: 'text-brand-700' },
            { label: 'Net payroll', value: latestRun ? formatCurrencyFromMinorUnits(latestRun.totalNetPayMinorUnits) : '—', icon: TrendingDown, tone: 'text-success-700' },
            { label: 'Pending approvals', value: overview?.pendingApprovals ?? 0, icon: Clock, tone: (overview?.pendingApprovals || 0) > 0 ? 'text-warning-700' : 'text-ink-900' },
          ].map((cell) => <StatCard key={cell.label} {...cell} />)
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink navigate={navigate} to="/payroll/runs" label="Payroll runs" description="Process, approve, and finalize" icon={Wallet} />
        <QuickLink navigate={navigate} to="/payroll/structures" label="Salary structures" description="Templates of pay components" icon={Layers} />
        <QuickLink navigate={navigate} to="/payroll/components" label="Salary components" description="Earnings & deductions catalog" icon={Sliders} />
        <QuickLink navigate={navigate} to="/payroll/periods" label="Payroll periods" description="Calendar months & pay dates" icon={CalendarRange} />
        <QuickLink navigate={navigate} to="/payroll/compensation" label="Employee compensation" description="Assign & review pay structures" icon={Users} />
        <QuickLink navigate={navigate} to="/payroll/analytics" label="Analytics" description="Cost trends & department breakdown" icon={BarChart3} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-ink-900">Recent payroll runs</h2>
      <TableContainer>
        {runsLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : runs.length === 0 ? (
          <EmptyState icon={Wallet} title="No payroll runs yet" message="Create your first payroll run to get started." actionLabel="New Payroll Run" onAction={() => navigate('/payroll/runs/new')} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Run</TH>
                <TH>Type</TH>
                <TH>Employees</TH>
                <TH>Net pay</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {runs.map((run) => (
                <TR key={run.id} className="cursor-pointer" onClick={() => navigate(`/payroll/runs/${run.id}`)}>
                  <TD className="font-medium text-ink-900">{formatDate(run.createdAt)}</TD>
                  <TD>{run.runType}</TD>
                  <TD>{run.employeeCount}</TD>
                  <TD>{formatCurrencyFromMinorUnits(run.totalNetPayMinorUnits, run.currency)}</TD>
                  <TD><StatusBadge status={run.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>
    </div>
  );
}
