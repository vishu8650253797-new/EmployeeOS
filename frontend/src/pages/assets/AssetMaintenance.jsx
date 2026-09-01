import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Clock, PackageSearch, CheckCircle2, Wallet } from 'lucide-react';
import { assetMaintenanceService } from '../../services/assetMaintenanceService';
import { assetVendorService } from '../../services/assetVendorService';
import { assetAnalyticsService } from '../../services/assetAnalyticsService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate, formatCurrency, fullName } from '../../utils/format';
import { MAINTENANCE_STATUSES } from '../../data/assets';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton, StatCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const PAGE_SIZE = 10;
const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];

function StatCard({ label, value, icon: Icon, tone = 'text-ink-900' }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-500">{label}</p>
        <Icon size={16} className="text-ink-400" aria-hidden="true" />
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone}`}>{value ?? 0}</p>
    </Card>
  );
}

function UpdateMaintenanceModal({ open, onClose, record, onUpdated }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ status: '', vendorId: '', maintenanceCost: '', resolution: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const { data: vendorsResponse } = useFetch(() => (open ? assetVendorService.getVendors({ limit: 100 }) : Promise.resolve(null)), [open]);
  const vendors = vendorsResponse?.data || [];

  useEffect(() => {
    if (record) {
      setForm({
        status: record.status,
        vendorId: record.vendorId?._id || '',
        maintenanceCost: record.maintenanceCost ?? '',
        resolution: record.resolution || '',
        notes: record.notes || '',
      });
    }
  }, [record]);

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await assetMaintenanceService.updateMaintenance(record.id, {
        status: form.status,
        vendorId: form.vendorId || undefined,
        maintenanceCost: form.maintenanceCost === '' ? undefined : Number(form.maintenanceCost),
        resolution: form.resolution || undefined,
        notes: form.notes || undefined,
      });
      toast('Maintenance record updated.');
      onUpdated?.();
    } catch (err) {
      toast(err.message || 'Failed to update maintenance record.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!record) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update Maintenance"
      description={`${record.assetId?.name || 'Asset'} · ${record.assetId?.assetTag || ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="update-maintenance-form" loading={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="update-maintenance-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink-700">{record.description}</div>
        <Select label="Status" value={form.status} onChange={(v) => updateField('status', v)} options={MAINTENANCE_STATUSES} />
        <Select
          label="Vendor"
          value={form.vendorId}
          onChange={(v) => updateField('vendorId', v)}
          placeholder="Select vendor"
          options={vendors.map((v) => ({ value: v.id, label: v.name }))}
        />
        <Input
          label="Maintenance cost"
          type="number"
          value={form.maintenanceCost}
          onChange={(v) => updateField('maintenanceCost', v)}
        />
        <Input label="Resolution" textarea value={form.resolution} onChange={(v) => updateField('resolution', v)} placeholder="How was it resolved?" />
        <Input label="Notes" textarea value={form.notes} onChange={(v) => updateField('notes', v)} />
      </form>
    </Modal>
  );
}

export default function AssetMaintenance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);

  const { data: analytics, refetch: refetchAnalytics } = useFetch(() => assetAnalyticsService.getMaintenanceAnalytics(), []);

  const { data, loading, error, refetch } = useFetch(
    () => assetMaintenanceService.getMaintenanceList({ status: status === 'all' ? '' : status, page, limit: PAGE_SIZE }),
    [status, page]
  );
  const records = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0 };

  function refetchAll() {
    refetch();
    refetchAnalytics();
  }

  useSocketEvent(SOCKET_EVENTS.ASSET_MAINTENANCE_CREATED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_MAINTENANCE_UPDATED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.ASSET_MAINTENANCE_COMPLETED, refetchAll, [refetchAll]);

  const statusOptions = [{ value: 'all', label: 'All statuses' }, ...MAINTENANCE_STATUSES];

  return (
    <div>
      <PageHeader title="Maintenance" subtitle="Track equipment repairs and servicing" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {!analytics
          ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
          : [
              { label: 'Open', value: analytics.open, icon: Wrench, tone: 'text-warning-700' },
              { label: 'In Progress', value: analytics.inProgress, icon: Clock, tone: 'text-info-700' },
              { label: 'Waiting for Parts', value: analytics.waitingForParts, icon: PackageSearch, tone: 'text-warning-700' },
              { label: 'Completed', value: analytics.completed, icon: CheckCircle2, tone: 'text-success-700' },
              { label: 'Total Cost', value: formatCurrency(analytics.totalMaintenanceCost), icon: Wallet },
            ].map((cell) => <StatCard key={cell.label} {...cell} />)}
      </div>

      <Select
        aria-label="Filter by status"
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={statusOptions}
        className="mb-4 sm:w-56"
      />

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : records.length === 0 ? (
          <EmptyState icon={Wrench} title="No maintenance records found" message="Reported issues on assets will appear here." />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Asset</TH>
                  <TH>Issue</TH>
                  <TH>Reported By</TH>
                  <TH>Priority</TH>
                  <TH>Status</TH>
                  <TH>Cost</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {records.map((record) => (
                  <TR key={record.id}>
                    <TD>
                      <button
                        type="button"
                        onClick={() => navigate(`/assets/${record.assetId?._id}`)}
                        className="focus-ring rounded-lg text-left"
                      >
                        <span className="block font-medium text-ink-900 hover:text-brand-700">{record.assetId?.name}</span>
                        <span className="block text-xs text-ink-400">{record.assetId?.assetTag}</span>
                      </button>
                    </TD>
                    <TD className="max-w-xs truncate">{record.description}</TD>
                    <TD>{record.reportedBy ? fullName(record.reportedBy) : '—'}</TD>
                    <TD>
                      <PriorityBadge priority={record.priority} />
                    </TD>
                    <TD>
                      <StatusBadge status={record.status} />
                    </TD>
                    <TD className="text-ink-500">{record.maintenanceCost != null ? formatCurrency(record.maintenanceCost) : '—'}</TD>
                    <TD className="text-right">
                      {canManage && !['COMPLETED', 'CANCELLED'].includes(record.status) ? (
                        <Button variant="secondary" size="sm" onClick={() => setEditing(record)}>
                          Update
                        </Button>
                      ) : (
                        <span className="text-xs text-ink-400">{formatDate(record.completedAt)}</span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={pagination.page} totalItems={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
          </>
        )}
      </TableContainer>

      <UpdateMaintenanceModal
        open={Boolean(editing)}
        record={editing}
        onClose={() => setEditing(null)}
        onUpdated={() => {
          setEditing(null);
          refetchAll();
        }}
      />
    </div>
  );
}
