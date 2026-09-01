import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Package,
  SlidersHorizontal,
  UserPlus,
  Repeat,
  Undo2,
  Wrench,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { assetService } from '../../services/assetService';
import { assetCategoryService } from '../../services/assetCategoryService';
import { assetVendorService } from '../../services/assetVendorService';
import { assetAnalyticsService } from '../../services/assetAnalyticsService';
import { departmentService } from '../../services/departmentService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { fullName } from '../../utils/format';
import { ASSET_STATUSES, ASSET_CONDITIONS, WARRANTY_STATUSES } from '../../data/assets';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton, StatCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';
import AssignAssetModal from '../../components/assets/AssignAssetModal';
import ReassignAssetModal from '../../components/assets/ReassignAssetModal';
import ReturnAssetModal from '../../components/assets/ReturnAssetModal';

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;
const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN', 'MANAGER'];
const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];
const NON_ASSIGNABLE = ['DISPOSED', 'RETIRED', 'IN_MAINTENANCE', 'ASSIGNED', 'LOST'];

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

export default function AssetInventory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [condition, setCondition] = useState('all');
  const [department, setDepartment] = useState('all');
  const [warrantyStatus, setWarrantyStatus] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [assignTarget, setAssignTarget] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const { data: overview, refetch: refetchOverview } = useFetch(
    () => (canView ? assetAnalyticsService.getOverview() : Promise.resolve(null)),
    [canView]
  );
  const { data: categories } = useFetch(
    () => (canView ? assetCategoryService.getCategories() : Promise.resolve(null)),
    [canView]
  );
  const { data: departments } = useFetch(
    () => (canView ? departmentService.getDepartments() : Promise.resolve(null)),
    [canView]
  );
  const { data: vendorsResponse } = useFetch(
    () => (canView ? assetVendorService.getVendors({ limit: 100 }) : Promise.resolve(null)),
    [canView]
  );

  const { data, loading, error, refetch } = useFetch(
    () =>
      canView
        ? assetService.getAssets({
            search: debouncedSearch,
            status: status === 'all' ? '' : status,
            category: category === 'all' ? '' : category,
            condition: condition === 'all' ? '' : condition,
            department: department === 'all' ? '' : department,
            warrantyStatus: warrantyStatus === 'all' ? '' : warrantyStatus,
            sortBy,
            sortOrder,
            page,
            limit: PAGE_SIZE,
          })
        : Promise.resolve(null),
    [canView, debouncedSearch, status, category, condition, department, warrantyStatus, sortBy, sortOrder, page]
  );

  const assets = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };
  const vendors = vendorsResponse?.data || [];

  function refetchAll() {
    refetch();
    refetchOverview();
  }

  useSocketEvent(SOCKET_EVENTS.ASSET_CREATED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_UPDATED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_DELETED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_ASSIGNED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_REASSIGNED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_RETURNED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_DAMAGED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_LOST, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_RETIRED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_DISPOSED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_MAINTENANCE_CREATED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_MAINTENANCE_COMPLETED, refetchAll, [refetchAll]);

  function handleSort(column) {
    if (sortBy === column) {
      setSortOrder((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function updateFilter(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await assetService.deleteAsset(deleteTarget.id);
      toast(`${deleteTarget.name} has been deleted.`);
      setDeleteTarget(null);
      refetchAll();
    } catch (err) {
      toast(err.message || 'Failed to delete asset. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  if (!canView) {
    return (
      <ErrorState
        title="No access"
        message="You don't have permission to view the asset inventory."
      />
    );
  }

  const hasFilters =
    search || status !== 'all' || category !== 'all' || condition !== 'all' || department !== 'all' || warrantyStatus !== 'all';

  const categoryOptions = [
    { value: 'all', label: 'All categories' },
    ...(categories || []).map((c) => ({ value: c.id, label: c.name })),
  ];
  const departmentOptions = [
    { value: 'all', label: 'All departments' },
    ...(departments || []).map((d) => ({ value: d.id, label: d.name })),
  ];
  const statusOptions = [{ value: 'all', label: 'All statuses' }, ...ASSET_STATUSES];
  const conditionOptions = [{ value: 'all', label: 'All conditions' }, ...ASSET_CONDITIONS];
  const warrantyOptions = [{ value: 'all', label: 'All warranties' }, ...WARRANTY_STATUSES];

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle="Track and manage your organization's equipment inventory"
        actions={
          canManage && (
            <Button onClick={() => navigate('/assets/new')}>
              <Plus size={15} />
              Add Asset
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
        {!overview
          ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
          : [
              { label: 'Total', value: overview.totalAssets, icon: Boxes },
              { label: 'Available', value: overview.available, icon: CheckCircle2, tone: 'text-success-700' },
              { label: 'Assigned', value: overview.assigned, icon: Package, tone: 'text-brand-700' },
              { label: 'Maintenance', value: overview.inMaintenance, icon: Wrench, tone: 'text-warning-700' },
              { label: 'Damaged', value: overview.damaged, icon: AlertTriangle, tone: 'text-danger-700' },
              { label: 'Lost', value: overview.lost, icon: ShieldAlert, tone: 'text-danger-700' },
              { label: 'Retired', value: overview.retired, icon: Trash2 },
              { label: 'Warranty Expiring', value: overview.warrantyExpiringSoon, icon: AlertTriangle, tone: 'text-warning-700' },
            ].map((cell) => <StatCard key={cell.label} {...cell} />)}
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by tag, serial, name, brand, model…"
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
          <Select aria-label="Filter by status" value={status} onChange={updateFilter(setStatus)} options={statusOptions} className="sm:w-40" />
          <Select aria-label="Filter by category" value={category} onChange={updateFilter(setCategory)} options={categoryOptions} className="sm:w-44" />
          <Select aria-label="Filter by condition" value={condition} onChange={updateFilter(setCondition)} options={conditionOptions} className="sm:w-40" />
          <Select aria-label="Filter by department" value={department} onChange={updateFilter(setDepartment)} options={departmentOptions} className="sm:w-44" />
          <Select aria-label="Filter by warranty" value={warrantyStatus} onChange={updateFilter(setWarrantyStatus)} options={warrantyOptions} className="sm:w-44" />
        </div>
      </div>

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : assets.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No assets found"
            message={hasFilters ? 'Try adjusting your search or filters.' : 'Get started by registering your first asset.'}
            actionLabel={hasFilters || !canManage ? undefined : 'Add Asset'}
            onAction={hasFilters || !canManage ? undefined : () => navigate('/assets/new')}
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH sortable sortDir={sortBy === 'name' ? sortOrder : null} onSort={() => handleSort('name')}>
                    Asset
                  </TH>
                  <TH>Category</TH>
                  <TH>Serial Number</TH>
                  <TH>Assigned To</TH>
                  <TH>Department</TH>
                  <TH>Status</TH>
                  <TH>Condition</TH>
                  <TH>Warranty</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {assets.map((asset) => (
                  <TR key={asset.id}>
                    <TD>
                      <button
                        type="button"
                        onClick={() => navigate(`/assets/${asset.id}`)}
                        className="focus-ring rounded-lg text-left"
                      >
                        <span className="block font-medium text-ink-900 hover:text-brand-700">{asset.name}</span>
                        <span className="block text-xs text-ink-400">{asset.assetTag}</span>
                      </button>
                    </TD>
                    <TD>{asset.categoryId?.name || '—'}</TD>
                    <TD className="text-ink-500">{asset.serialNumber || '—'}</TD>
                    <TD>{asset.assignedTo ? fullName(asset.assignedTo) : '—'}</TD>
                    <TD>{asset.assignedDepartment?.name || '—'}</TD>
                    <TD>
                      <StatusBadge status={asset.status} />
                    </TD>
                    <TD>
                      <StatusBadge status={asset.condition} />
                    </TD>
                    <TD>
                      {asset.warrantyEndDate ? (
                        <span>
                          <StatusBadge status={asset.warrantyStatus} />
                        </span>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD className="text-right">
                      <Dropdown
                        width="w-48"
                        trigger={({ open }) => (
                          <button
                            type="button"
                            aria-label={`Actions for ${asset.name}`}
                            aria-expanded={open}
                            className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        )}
                      >
                        <DropdownItem icon={Eye} onClick={() => navigate(`/assets/${asset.id}`)}>
                          View details
                        </DropdownItem>
                        {canManage && (
                          <>
                            <DropdownItem icon={Pencil} onClick={() => navigate(`/assets/${asset.id}/edit`)}>
                              Edit
                            </DropdownItem>
                            <DropdownSeparator />
                            {!NON_ASSIGNABLE.includes(asset.status) && (
                              <DropdownItem icon={UserPlus} onClick={() => setAssignTarget(asset)}>
                                Assign
                              </DropdownItem>
                            )}
                            {asset.status === 'ASSIGNED' && (
                              <DropdownItem icon={Repeat} onClick={() => setReassignTarget(asset)}>
                                Reassign
                              </DropdownItem>
                            )}
                            {asset.status === 'ASSIGNED' && (
                              <DropdownItem icon={Undo2} onClick={() => setReturnTarget(asset)}>
                                Return
                              </DropdownItem>
                            )}
                            <DropdownSeparator />
                            <DropdownItem icon={Trash2} danger onClick={() => setDeleteTarget(asset)}>
                              Delete
                            </DropdownItem>
                          </>
                        )}
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

      <AssignAssetModal open={Boolean(assignTarget)} asset={assignTarget} onClose={() => setAssignTarget(null)} onAssigned={refetchAll} />
      <ReassignAssetModal open={Boolean(reassignTarget)} asset={reassignTarget} onClose={() => setReassignTarget(null)} onReassigned={refetchAll} />
      <ReturnAssetModal open={Boolean(returnTarget)} asset={returnTarget} onClose={() => setReturnTarget(null)} onReturned={refetchAll} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete asset"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.name} (${deleteTarget.assetTag})? This is only possible for assets with no assignment history.`
            : ''
        }
        confirmLabel="Delete"
      />
    </div>
  );
}
