import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  MoreHorizontal,
  Eye,
  LogOut,
  SlidersHorizontal,
  Users,
  Clock,
  ShieldCheck,
  ClipboardList,
  Package,
  MessageSquare,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { offboardingService } from '../../services/offboardingService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { fullName, formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem } from '../../components/ui/Dropdown';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton, StatCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';
import InitiateOffboardingModal from '../../components/offboarding/InitiateOffboardingModal';

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;
const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'IT_ADMIN', 'FINANCE'];

const OFFBOARDING_TYPES = [
  { value: 'RESIGNATION', label: 'Resignation' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'CONTRACT_END', label: 'Contract End' },
  { value: 'LAYOFF', label: 'Layoff' },
  { value: 'OTHER', label: 'Other' },
];

const STATUSES = [
  'DRAFT', 'INITIATED', 'PENDING_APPROVAL', 'NOTICE_PERIOD', 'CLEARANCE_IN_PROGRESS',
  'FINAL_REVIEW', 'COMPLETED', 'CANCELLED', 'REJECTED',
].map((s) => ({ value: s, label: s.replaceAll('_', ' ') }));

function StatCard({ label, value, icon: Icon, tone = 'text-ink-900' }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-500">{label}</p>
        <Icon size={16} className="text-ink-400" aria-hidden="true" />
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone}`}>{value ?? 0}</p>
    </div>
  );
}

export default function OffboardingList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role) || Boolean(user?.employeeId);
  const canInitiate = Boolean(user);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [offboardingType, setOffboardingType] = useState('all');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [initiateOpen, setInitiateOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const { data: dashboard, refetch: refetchDashboard } = useFetch(
    () => (canView ? offboardingService.getDashboard() : Promise.resolve(null)),
    [canView]
  );

  const { data, loading, error, refetch } = useFetch(
    () =>
      canView
        ? offboardingService.getOffboardings({
            search: debouncedSearch,
            status: status === 'all' ? '' : status,
            offboardingType: offboardingType === 'all' ? '' : offboardingType,
            page,
            limit: PAGE_SIZE,
          })
        : Promise.resolve(null),
    [canView, debouncedSearch, status, offboardingType, page]
  );

  const records = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };

  function refetchAll() {
    refetch();
    refetchDashboard();
  }

  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_CREATED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_UPDATED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_APPROVED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_REJECTED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_CANCELLED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_CLEARANCE_UPDATED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_COMPLETED, refetchAll, [refetchAll]);

  function updateFilter(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  if (!canView) {
    return <ErrorState title="No access" message="You don't have permission to view offboarding records." />;
  }

  const hasFilters = search || status !== 'all' || offboardingType !== 'all';

  return (
    <div>
      <PageHeader
        title="Offboarding"
        subtitle="Manage employee exits from initiation through final clearance"
        actions={
          canInitiate && (
            <Button onClick={() => setInitiateOpen(true)}>
              <Plus size={15} />
              Initiate Offboarding
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
        {!dashboard
          ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
          : [
              { label: 'Active', value: dashboard.activeOffboardings, icon: Users, tone: 'text-brand-700' },
              { label: 'Pending Approval', value: dashboard.pendingApprovals, icon: ClipboardList, tone: 'text-warning-700' },
              { label: 'In Notice Period', value: dashboard.inNoticePeriod, icon: Clock },
              { label: 'Pending Clearances', value: dashboard.pendingClearances, icon: ShieldCheck, tone: 'text-warning-700' },
              { label: 'Pending Asset Returns', value: dashboard.pendingAssetReturns, icon: Package, tone: 'text-warning-700' },
              { label: 'Pending Exit Interviews', value: dashboard.pendingExitInterviews, icon: MessageSquare },
              { label: 'Pending Access Off', value: dashboard.pendingAccessDeactivation, icon: Lock, tone: 'text-danger-700' },
              { label: 'Completed', value: dashboard.completedOffboardings, icon: CheckCircle2, tone: 'text-success-700' },
            ].map((cell) => <StatCard key={cell.label} {...cell} />)}
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by employee name or ID…"
            className="flex-1 sm:max-w-sm"
          />
          <Button
            variant="secondary"
            className="sm:hidden"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={15} />
            Filters
          </Button>
        </div>
        <div className={`grid-cols-2 gap-2 sm:flex sm:flex-wrap ${filtersOpen ? 'grid' : 'hidden sm:flex'}`}>
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={updateFilter(setStatus)}
            options={[{ value: 'all', label: 'All statuses' }, ...STATUSES]}
            className="sm:w-48"
          />
          <Select
            aria-label="Filter by type"
            value={offboardingType}
            onChange={updateFilter(setOffboardingType)}
            options={[{ value: 'all', label: 'All types' }, ...OFFBOARDING_TYPES]}
            className="sm:w-44"
          />
        </div>
      </div>

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : records.length === 0 ? (
          <EmptyState
            icon={LogOut}
            title="No offboarding records found"
            message={hasFilters ? 'Try adjusting your search or filters.' : 'No active offboarding processes.'}
            actionLabel={hasFilters ? undefined : 'Initiate Offboarding'}
            onAction={hasFilters ? undefined : () => setInitiateOpen(true)}
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Employee</TH>
                  <TH>Type</TH>
                  <TH>Last Working Date</TH>
                  <TH>Status</TH>
                  <TH>Clearance</TH>
                  <TH>Approval</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {records.map((record) => (
                  <TR key={record.id}>
                    <TD>
                      <button
                        type="button"
                        onClick={() => navigate(`/offboarding/${record.id}`)}
                        className="focus-ring rounded-lg text-left"
                      >
                        <span className="block font-medium text-ink-900 hover:text-brand-700">
                          {record.employeeId ? fullName(record.employeeId) : 'Unknown'}
                        </span>
                        <span className="block text-xs text-ink-400">{record.employeeId?.jobTitle || ''}</span>
                      </button>
                    </TD>
                    <TD>
                      <StatusBadge status={record.offboardingType} />
                    </TD>
                    <TD className="text-ink-500">{formatDate(record.lastWorkingDate)}</TD>
                    <TD>
                      <StatusBadge status={record.status} />
                    </TD>
                    <TD>
                      <StatusBadge status={record.clearanceStatus} />
                    </TD>
                    <TD>
                      <StatusBadge status={record.approvalStatus} />
                    </TD>
                    <TD className="text-right">
                      <Dropdown
                        width="w-48"
                        trigger={({ open }) => (
                          <button
                            type="button"
                            aria-label="Actions"
                            aria-expanded={open}
                            className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        )}
                      >
                        <DropdownItem icon={Eye} onClick={() => navigate(`/offboarding/${record.id}`)}>
                          View details
                        </DropdownItem>
                      </Dropdown>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={pagination.page} totalItems={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
          </>
        )}
      </TableContainer>

      <InitiateOffboardingModal open={initiateOpen} onClose={() => setInitiateOpen(false)} onInitiated={refetchAll} />
    </div>
  );
}
