import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, UserRound, X } from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { employeeCompensationService } from '../../services/employeeCompensationService';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { fullName, formatDate, formatCurrencyFromMinorUnits } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/Badge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';
import AssignCompensationModal from '../../components/payroll/AssignCompensationModal';

const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const DEBOUNCE_MS = 300;

function EmployeePicker({ onSelect }) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading } = useFetch(
    () => (debounced ? employeeService.getEmployees({ search: debounced, limit: 10 }) : Promise.resolve(null)),
    [debounced]
  );
  const employees = data?.data || [];

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink-400/10 text-ink-400">
        <UserRound size={22} aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-ink-900">Find an employee</h2>
      <p className="mt-1 text-[13px] text-ink-500">Search for an employee to view or assign their compensation.</p>
      <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" className="mx-auto mt-4" />
      {loading && debounced && <p className="mt-4 text-[13px] text-ink-500">Searching…</p>}
      {!loading && debounced && employees.length === 0 && <p className="mt-4 text-[13px] text-ink-500">No employees found.</p>}
      {employees.length > 0 && (
        <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface text-left shadow-card">
          {employees.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelect(e)}
              className="focus-ring flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-canvas"
            >
              <span>
                <span className="block text-[13px] font-medium text-ink-900">{fullName(e)}</span>
                <span className="block text-xs text-ink-500">{e.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmployeeCompensationHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const employeeId = searchParams.get('employeeId');
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role) || user?.employeeId === employeeId;
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [assignOpen, setAssignOpen] = useState(false);

  const { data: employee, loading: employeeLoading } = useFetch(
    () => (employeeId ? employeeService.getEmployeeById(employeeId) : Promise.resolve(null)),
    [employeeId]
  );
  const { data, loading, error, refetch } = useFetch(
    () => (employeeId && canView ? employeeCompensationService.getCompensationHistory(employeeId) : Promise.resolve(null)),
    [employeeId, canView]
  );

  if (!VIEW_ROLES.includes(user?.role) && !user?.employeeId) {
    return <ErrorState title="No access" message="You don't have permission to view employee compensation." />;
  }

  if (!employeeId) {
    return (
      <div>
        <PageHeader title="Employee Compensation" subtitle="Assign and review salary structures per employee" />
        <EmployeePicker onSelect={(e) => setSearchParams({ employeeId: e.id })} />
      </div>
    );
  }

  if (!canView) {
    return <ErrorState title="No access" message="You don't have permission to view this employee's compensation." />;
  }

  const history = data?.data || [];
  const current = history.find((h) => h.status === 'ACTIVE');

  return (
    <div>
      <PageHeader
        title={employeeLoading ? 'Employee Compensation' : fullName(employee) || 'Employee Compensation'}
        subtitle="Compensation history and current salary structure"
        actions={
          <>
            <Button variant="secondary" onClick={() => setSearchParams({})}>
              <X size={15} />
              Change employee
            </Button>
            {canManage && (
              <Button onClick={() => setAssignOpen(true)}>
                <Plus size={15} />
                Assign compensation
              </Button>
            )}
          </>
        }
      />

      {employeeLoading ? (
        <LoadingState label="Loading employee…" />
      ) : (
        <>
          {current && (
            <div className="mb-5 rounded-xl border border-line bg-surface p-5 shadow-card">
              <p className="text-[13px] text-ink-500">Current structure</p>
              <p className="mt-1 text-lg font-semibold text-ink-900">
                {current.effectiveComponents ? `${current.effectiveComponents.length} components` : '—'}
              </p>
              <p className="mt-1 text-[13px] text-ink-500">Effective from {formatDate(current.effectiveFrom)}</p>
              {current.ctcAnnualMinorUnits != null && (
                <p className="mt-1 text-[13px] text-ink-500">Annual CTC: {formatCurrencyFromMinorUnits(current.ctcAnnualMinorUnits, current.currency)}</p>
              )}
            </div>
          )}

          <TableContainer>
            {loading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : error ? (
              <ErrorState message={error} onRetry={refetch} />
            ) : history.length === 0 ? (
              <EmptyState title="No compensation history" message="This employee has no compensation assigned yet." actionLabel={canManage ? 'Assign compensation' : undefined} onAction={canManage ? () => setAssignOpen(true) : undefined} />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Effective from</TH>
                    <TH>Effective to</TH>
                    <TH>Reason</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <TBody>
                  {history.map((row) => (
                    <TR key={row.id}>
                      <TD className="font-medium text-ink-900">{formatDate(row.effectiveFrom)}</TD>
                      <TD>{row.effectiveTo ? formatDate(row.effectiveTo) : '—'}</TD>
                      <TD className="text-ink-500">{row.revisionReason || '—'}</TD>
                      <TD><StatusBadge status={row.status} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </TableContainer>
        </>
      )}

      <AssignCompensationModal
        open={assignOpen}
        employeeId={employeeId}
        employeeName={fullName(employee)}
        onClose={() => setAssignOpen(false)}
        onAssigned={refetch}
      />
    </div>
  );
}
