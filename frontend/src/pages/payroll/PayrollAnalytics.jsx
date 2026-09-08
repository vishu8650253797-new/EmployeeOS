import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { payrollAnalyticsService } from '../../services/payrollAnalyticsService';
import { payrollPeriodService } from '../../services/payrollPeriodService';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { formatCurrencyFromMinorUnits } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Select from '../../components/ui/Select';
import { StatCardSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[13px] text-ink-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-ink-900">{value}</p>
    </div>
  );
}

export default function PayrollAnalytics() {
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);

  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  const { data: overview, loading: overviewLoading } = useFetch(() => (canView ? payrollAnalyticsService.getOverview() : Promise.resolve(null)), [canView]);
  const { data: trends, loading: trendsLoading } = useFetch(() => (canView ? payrollAnalyticsService.getTrends(12) : Promise.resolve([])), [canView]);
  const { data: periods } = useFetch(() => (canView ? payrollPeriodService.getPeriods({ status: 'FINALIZED' }) : Promise.resolve([])), [canView]);

  const effectivePeriodId = selectedPeriodId || trends?.[trends.length - 1]?.payrollPeriodId || '';
  const { data: departmentCost, loading: deptLoading, error: deptError } = useFetch(
    () => (canView && effectivePeriodId ? payrollAnalyticsService.getDepartmentCost(effectivePeriodId) : Promise.resolve([])),
    [canView, effectivePeriodId]
  );

  if (!canView) {
    return <ErrorState title="No access" message="You don't have permission to view payroll analytics." />;
  }

  return (
    <div>
      <PageHeader title="Payroll Analytics" subtitle="Cost trends and department breakdown" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {overviewLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Latest period" value={overview?.latestRun?.periodLabel || '—'} />
            <StatCard label="Employees paid" value={overview?.latestRun?.employeeCount ?? '—'} />
            <StatCard label="Gross payroll" value={overview?.latestRun ? formatCurrencyFromMinorUnits(overview.latestRun.totalGrossMinorUnits) : '—'} />
            <StatCard label="Employer cost" value={overview?.latestRun ? formatCurrencyFromMinorUnits(overview.latestRun.totalEmployerCostMinorUnits) : '—'} />
          </>
        )}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-ink-900">Payroll cost trend</h2>
      <TableContainer className="mb-6">
        {trendsLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (trends || []).length === 0 ? (
          <EmptyState icon={BarChart3} title="No finalized payroll yet" message="Trends appear once at least one payroll run has been finalized." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Period</TH>
                <TH>Employees</TH>
                <TH>Gross</TH>
                <TH>Net pay</TH>
                <TH>Employer cost</TH>
              </tr>
            </THead>
            <TBody>
              {trends.map((t) => (
                <TR key={t.payrollPeriodId}>
                  <TD className="font-medium text-ink-900">{`${t.year}-${String(t.month).padStart(2, '0')}`}</TD>
                  <TD>{t.employeeCount}</TD>
                  <TD>{formatCurrencyFromMinorUnits(t.totalGrossMinorUnits)}</TD>
                  <TD>{formatCurrencyFromMinorUnits(t.totalNetPayMinorUnits)}</TD>
                  <TD>{formatCurrencyFromMinorUnits(t.totalEmployerCostMinorUnits)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">Department cost breakdown</h2>
        <Select
          aria-label="Select period"
          value={effectivePeriodId}
          onChange={setSelectedPeriodId}
          className="sm:w-52"
          options={(periods || []).map((p) => ({ value: p.id, label: `${p.year}-${String(p.month).padStart(2, '0')}` }))}
        />
      </div>
      <TableContainer>
        {deptLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : deptError ? (
          <ErrorState message={deptError} />
        ) : (departmentCost || []).length === 0 ? (
          <EmptyState title="No data" message="No finalized payroll for this period." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Department</TH>
                <TH>Employees</TH>
                <TH>Gross</TH>
                <TH>Net pay</TH>
              </tr>
            </THead>
            <TBody>
              {departmentCost.map((d) => (
                <TR key={d.departmentId || 'unassigned'}>
                  <TD className="font-medium text-ink-900">{d.departmentName}</TD>
                  <TD>{d.employeeCount}</TD>
                  <TD>{formatCurrencyFromMinorUnits(d.totalGrossMinorUnits)}</TD>
                  <TD>{formatCurrencyFromMinorUnits(d.totalNetPayMinorUnits)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>
    </div>
  );
}
