import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Wallet } from 'lucide-react';
import { payrollRunService } from '../../services/payrollRunService';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate, formatCurrencyFromMinorUnits } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const PREPARE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const PAGE_SIZE = 15;
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...['DRAFT', 'PROCESSING', 'CALCULATED', 'FAILED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'FINALIZED', 'CANCELLED'].map((s) => ({ value: s, label: s })),
];

export default function PayrollRunList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const payrollPeriodId = searchParams.get('payrollPeriodId') || '';
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);
  const canPrepare = PREPARE_ROLES.includes(user?.role);

  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = useFetch(
    () =>
      canView
        ? payrollRunService.getRuns({ status: status === 'all' ? '' : status, payrollPeriodId, page, limit: PAGE_SIZE })
        : Promise.resolve(null),
    [canView, status, payrollPeriodId, page]
  );
  const runs = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0 };

  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_CREATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_CALCULATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_FAILED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_SUBMITTED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_APPROVED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_REJECTED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_FINALIZED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_CANCELLED, refetch, [refetch]);

  if (!canView) {
    return <ErrorState title="No access" message="You don't have permission to view payroll runs." />;
  }

  return (
    <div>
      <PageHeader
        title="Payroll Runs"
        subtitle="Process, review, and approve payroll for each period"
        actions={canPrepare && <Button onClick={() => navigate('/payroll/runs/new')}><Plus size={15} />New Payroll Run</Button>}
      />

      <Select
        aria-label="Filter by status"
        value={status}
        onChange={(v) => { setStatus(v); setPage(1); }}
        options={STATUS_OPTIONS}
        className="mb-4 sm:w-52"
      />

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : runs.length === 0 ? (
          <EmptyState icon={Wallet} title="No payroll runs found" message="Create a payroll run to get started." actionLabel={canPrepare ? 'New Payroll Run' : undefined} onAction={canPrepare ? () => navigate('/payroll/runs/new') : undefined} />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Created</TH>
                  <TH>Type</TH>
                  <TH>Employees</TH>
                  <TH>Gross</TH>
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
                    <TD>{formatCurrencyFromMinorUnits(run.totalGrossMinorUnits, run.currency)}</TD>
                    <TD>{formatCurrencyFromMinorUnits(run.totalNetPayMinorUnits, run.currency)}</TD>
                    <TD><StatusBadge status={run.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={pagination.page} totalItems={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
          </>
        )}
      </TableContainer>
    </div>
  );
}
