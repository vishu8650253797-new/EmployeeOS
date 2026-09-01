import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Pencil,
  Trash2,
  UserPlus,
  Repeat,
  Undo2,
  Wrench,
  MoreHorizontal,
  ShieldAlert,
  ShieldOff,
  ShieldCheck,
  Archive,
  Ban,
  Tag,
  Barcode,
  Layers,
  MapPin,
  Calendar,
  Wallet,
  Building2,
  UserRound,
  FileText,
  Paperclip,
  Upload,
  Download,
  History as HistoryIcon,
  LayoutGrid,
} from 'lucide-react';
import { assetService } from '../../services/assetService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate, formatCurrency, fullName } from '../../utils/format';
import { ATTACHMENT_CATEGORIES } from '../../data/assets';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import AssignAssetModal from '../../components/assets/AssignAssetModal';
import ReassignAssetModal from '../../components/assets/ReassignAssetModal';
import ReturnAssetModal from '../../components/assets/ReturnAssetModal';
import ReportIssueModal from '../../components/assets/ReportIssueModal';

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutGrid },
  { value: 'timeline', label: 'Timeline', icon: HistoryIcon },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
  { value: 'attachments', label: 'Attachments', icon: Paperclip },
];

const NON_ASSIGNABLE = ['DISPOSED', 'RETIRED', 'IN_MAINTENANCE', 'ASSIGNED', 'LOST'];
const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];

const STATUS_ACTIONS = {
  damage: { label: 'Mark Damaged', icon: ShieldAlert, message: 'Mark this asset as damaged?' },
  lost: { label: 'Mark Lost', icon: ShieldOff, message: 'Mark this asset as lost?' },
  recover: { label: 'Mark Recovered', icon: ShieldCheck, message: 'Mark this lost asset as recovered and available again?' },
  retire: { label: 'Retire Asset', icon: Archive, message: 'Retire this asset? It will no longer be assignable.' },
  dispose: { label: 'Dispose Asset', icon: Ban, message: 'Dispose this asset? This is a terminal state.' },
};

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-ink-400">{label}</p>
        <p className="mt-0.5 break-words text-[13px] font-medium text-ink-900">{value ?? '—'}</p>
      </div>
    </div>
  );
}

function OverviewTab({ asset }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Identification" />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={Tag} label="Asset tag" value={asset.assetTag} />
          <InfoRow icon={Barcode} label="Serial number" value={asset.serialNumber} />
          <InfoRow icon={Layers} label="Category" value={asset.categoryId?.name} />
          <InfoRow icon={FileText} label="Brand / Model" value={[asset.brand, asset.model].filter(Boolean).join(' · ') || '—'} />
          <InfoRow icon={MapPin} label="Location" value={asset.location} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Current assignment" />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={UserRound} label="Assigned to" value={asset.assignedTo ? fullName(asset.assignedTo) : 'Unassigned'} />
          <InfoRow icon={Building2} label="Department" value={asset.assignedDepartment?.name} />
          <InfoRow icon={Calendar} label="Assigned on" value={formatDate(asset.assignedAt)} />
          <InfoRow icon={Calendar} label="Returned on" value={formatDate(asset.returnedAt)} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Purchase information" />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={Calendar} label="Purchase date" value={formatDate(asset.purchaseDate)} />
          <InfoRow icon={Wallet} label="Purchase price" value={asset.purchasePrice != null ? `${asset.currency} ${asset.purchasePrice}` : '—'} />
          <InfoRow icon={Building2} label="Vendor" value={asset.vendorId?.name} />
          <InfoRow icon={FileText} label="Purchase order #" value={asset.purchaseOrderNumber} />
          <InfoRow icon={FileText} label="Invoice #" value={asset.invoiceNumber} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Warranty" />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={Calendar} label="Warranty start" value={formatDate(asset.warrantyStartDate)} />
          <InfoRow icon={Calendar} label="Warranty end" value={formatDate(asset.warrantyEndDate)} />
          <div className="flex items-center gap-3 py-2.5">
            <ShieldCheck size={16} className="text-ink-400" aria-hidden="true" />
            <div>
              <p className="text-xs text-ink-400">Status</p>
              <div className="mt-1">
                <StatusBadge status={asset.warrantyStatus} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {asset.notes && (
        <Card className="lg:col-span-2">
          <CardHeader title="Notes" />
          <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink-700">{asset.notes}</p>
        </Card>
      )}
    </div>
  );
}

function TimelineTab({ history }) {
  if (!history || history.length === 0) {
    return (
      <Card padding={false}>
        <EmptyState icon={HistoryIcon} title="No history yet" message="Activity on this asset will appear here." />
      </Card>
    );
  }
  return (
    <Card padding={false}>
      <ul className="divide-y divide-line">
        {history.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 px-5 py-4">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink-900">{entry.action.replaceAll('_', ' ')}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {entry.performedBy ? fullName(entry.performedBy) : 'System'} · {formatDate(entry.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MaintenanceTab({ records, onReportIssue, canReport }) {
  return (
    <div className="space-y-4">
      {canReport && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onReportIssue}>
            <Wrench size={14} />
            Report Issue
          </Button>
        </div>
      )}
      {!records || records.length === 0 ? (
        <Card padding={false}>
          <EmptyState icon={Wrench} title="No maintenance records" message="Reported issues for this asset will appear here." />
        </Card>
      ) : (
        <TableCardList records={records} />
      )}
    </div>
  );
}

function TableCardList({ records }) {
  return (
    <Card padding={false}>
      <ul className="divide-y divide-line">
        {records.map((record) => (
          <li key={record.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-ink-900">{record.description}</p>
              <StatusBadge status={record.status} />
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {record.issueType} · Reported {formatDate(record.createdAt)}
              {record.assignedTechnicianId ? ` · Assigned to ${fullName(record.assignedTechnicianId)}` : ''}
            </p>
            {record.maintenanceCost != null && (
              <p className="mt-1 text-xs text-ink-500">Cost: {formatCurrency(record.maintenanceCost)}</p>
            )}
            {record.resolution && <p className="mt-1 text-[13px] text-ink-700">Resolution: {record.resolution}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AttachmentsTab({ asset, canManage, onChanged }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [uploadCategory, setUploadCategory] = useState('OTHER');
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function handleFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      formData.append('category', uploadCategory);
      await assetService.uploadAttachment(asset.id, formData);
      toast('Attachment uploaded.');
      onChanged?.();
    } catch (err) {
      toast(err.message || 'Failed to upload attachment.', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(attachment) {
    try {
      const response = await assetService.downloadAttachment(asset.id, attachment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.originalFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast(err.message || 'Failed to download attachment.', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await assetService.deleteAttachment(asset.id, deleteTarget.id);
      toast('Attachment removed.');
      setDeleteTarget(null);
      onChanged?.();
    } catch (err) {
      toast(err.message || 'Failed to remove attachment.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const attachments = asset.attachments || [];

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              label="Category"
              value={uploadCategory}
              onChange={setUploadCategory}
              options={ATTACHMENT_CATEGORIES}
              className="sm:w-56"
            />
            <Button onClick={() => fileInputRef.current?.click()} loading={uploading} disabled={uploading}>
              <Upload size={14} />
              {uploading ? 'Uploading…' : 'Upload attachment'}
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
          </div>
        </Card>
      )}

      {attachments.length === 0 ? (
        <Card padding={false}>
          <EmptyState icon={Paperclip} title="No attachments" message="Invoices, warranty cards, and photos for this asset will appear here." />
        </Card>
      ) : (
        <Card padding={false}>
          <ul className="divide-y divide-line">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink-900">{attachment.title}</p>
                  <p className="text-xs text-ink-400">
                    {attachment.category.replaceAll('_', ' ')} · {formatDate(attachment.uploadedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDownload(attachment)}
                    aria-label={`Download ${attachment.title}`}
                    className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                  >
                    <Download size={15} />
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(attachment)}
                      aria-label={`Delete ${attachment.title}`}
                      className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Remove attachment"
        message={deleteTarget ? `Remove "${deleteTarget.title}" from this asset?` : ''}
        confirmLabel="Remove"
      />
    </div>
  );
}

export default function AssetDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [activeTab, setActiveTab] = useState('overview');
  const [assignOpen, setAssignOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [statusAction, setStatusAction] = useState(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: asset, loading, error, refetch } = useFetch(() => assetService.getAssetById(id), [id]);

  useSocketEvent(SOCKET_EVENTS.ASSET_UPDATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_ASSIGNED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_REASSIGNED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_RETURNED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_DAMAGED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_LOST, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_RECOVERED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_RETIRED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_DISPOSED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_MAINTENANCE_CREATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_MAINTENANCE_UPDATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_MAINTENANCE_COMPLETED, refetch, [refetch]);

  async function handleStatusAction() {
    if (!statusAction) return;
    setStatusSaving(true);
    try {
      const fn = { damage: 'markDamaged', lost: 'markLost', recover: 'recoverAsset', retire: 'retireAsset', dispose: 'disposeAsset' }[statusAction];
      await assetService[fn](asset.id, statusNotes || undefined);
      toast(`${STATUS_ACTIONS[statusAction].label} recorded.`);
      setStatusAction(null);
      setStatusNotes('');
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to update asset status.', 'error');
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await assetService.deleteAsset(id);
      toast(`${asset.name} has been deleted.`);
      navigate('/assets');
    } catch (err) {
      toast(err.message || 'Failed to delete asset.', 'error');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={4} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Asset not found" message="This asset may have been removed or the link is incorrect." onRetry={refetch} />;
  }

  const canReport = canManage || (user?.employeeId && asset.assignedTo?._id === user.employeeId);

  return (
    <div>
      <PageHeader
        title={asset.name}
        breadcrumbs={[{ label: 'Assets', to: '/assets' }, { label: asset.assetTag }]}
        actions={
          <>
            {canManage && !NON_ASSIGNABLE.includes(asset.status) && (
              <Button variant="secondary" onClick={() => setAssignOpen(true)}>
                <UserPlus size={14} />
                Assign
              </Button>
            )}
            {canManage && asset.status === 'ASSIGNED' && (
              <>
                <Button variant="secondary" onClick={() => setReassignOpen(true)}>
                  <Repeat size={14} />
                  Reassign
                </Button>
                <Button variant="secondary" onClick={() => setReturnOpen(true)}>
                  <Undo2 size={14} />
                  Return
                </Button>
              </>
            )}
            {canManage && (
              <Button variant="secondary" onClick={() => navigate(`/assets/${id}/edit`)}>
                <Pencil size={14} />
                Edit
              </Button>
            )}
            {canManage && (
              <Dropdown
                width="w-52"
                trigger={({ open }) => (
                  <button
                    type="button"
                    aria-label="More actions"
                    aria-expanded={open}
                    className="focus-ring rounded-lg border border-line-strong bg-surface p-2.5 text-ink-500 shadow-card hover:bg-canvas"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                )}
              >
                {asset.status !== 'DISPOSED' && (
                  <DropdownItem icon={ShieldAlert} onClick={() => setStatusAction('damage')}>
                    Mark Damaged
                  </DropdownItem>
                )}
                {asset.status !== 'DISPOSED' && (
                  <DropdownItem icon={ShieldOff} onClick={() => setStatusAction('lost')}>
                    Mark Lost
                  </DropdownItem>
                )}
                {asset.status === 'LOST' && (
                  <DropdownItem icon={ShieldCheck} onClick={() => setStatusAction('recover')}>
                    Mark Recovered
                  </DropdownItem>
                )}
                {!['DISPOSED', 'RETIRED'].includes(asset.status) && (
                  <DropdownItem icon={Archive} onClick={() => setStatusAction('retire')}>
                    Retire
                  </DropdownItem>
                )}
                {asset.status !== 'DISPOSED' && (
                  <DropdownItem icon={Ban} onClick={() => setStatusAction('dispose')}>
                    Dispose
                  </DropdownItem>
                )}
                {user?.role === 'SUPER_ADMIN' && (
                  <>
                    <DropdownSeparator />
                    <DropdownItem icon={Trash2} danger onClick={() => setConfirmDelete(true)}>
                      Delete
                    </DropdownItem>
                  </>
                )}
              </Dropdown>
            )}
          </>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink-900">{asset.name}</h2>
              <StatusBadge status={asset.status} />
              <StatusBadge status={asset.condition} />
            </div>
            <p className="mt-1 text-[13px] text-ink-500">
              {asset.assetTag} · {asset.categoryId?.name || 'Uncategorized'}
              {asset.brand ? ` · ${asset.brand}` : ''} {asset.model || ''}
            </p>
          </div>
          <div className="flex gap-6 sm:text-right">
            <div>
              <p className="text-xs text-ink-400">Assigned to</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink-900">
                {asset.assignedTo ? fullName(asset.assignedTo) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Warranty</p>
              <div className="mt-0.5">
                <StatusBadge status={asset.warrantyStatus} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-5" />

      {activeTab === 'overview' && <OverviewTab asset={asset} />}
      {activeTab === 'timeline' && <TimelineTab history={asset.history} />}
      {activeTab === 'maintenance' && (
        <MaintenanceTab records={asset.maintenanceRecords} onReportIssue={() => setReportOpen(true)} canReport={canReport} />
      )}
      {activeTab === 'attachments' && <AttachmentsTab asset={asset} canManage={canManage} onChanged={refetch} />}

      <AssignAssetModal open={assignOpen} asset={asset} onClose={() => setAssignOpen(false)} onAssigned={refetch} />
      <ReassignAssetModal open={reassignOpen} asset={asset} onClose={() => setReassignOpen(false)} onReassigned={refetch} />
      <ReturnAssetModal open={returnOpen} asset={asset} onClose={() => setReturnOpen(false)} onReturned={refetch} />
      <ReportIssueModal open={reportOpen} asset={asset} onClose={() => setReportOpen(false)} onReported={refetch} />

      <Modal
        open={Boolean(statusAction)}
        onClose={() => {
          setStatusAction(null);
          setStatusNotes('');
        }}
        title={statusAction ? STATUS_ACTIONS[statusAction].label : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusAction(null)} disabled={statusSaving}>
              Cancel
            </Button>
            <Button variant={statusAction === 'dispose' ? 'danger' : 'primary'} onClick={handleStatusAction} loading={statusSaving}>
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-700">{statusAction ? STATUS_ACTIONS[statusAction].message : ''}</p>
          <Input label="Notes" textarea value={statusNotes} onChange={setStatusNotes} placeholder="Optional notes" />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete asset"
        message={`Are you sure you want to delete ${asset.name} (${asset.assetTag})? This is only possible for assets with no assignment history.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
