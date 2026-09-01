import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, Check, X, PackageCheck, Ban } from 'lucide-react';
import { assetRequestService } from '../../services/assetRequestService';
import { assetCategoryService } from '../../services/assetCategoryService';
import { assetService } from '../../services/assetService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate, fullName } from '../../utils/format';
import { PRIORITIES } from '../../data/assets';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const PAGE_SIZE = 10;
const APPROVER_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];
const INITIAL_FORM = { assetCategoryId: '', requestedAssetType: '', reason: '', priority: 'MEDIUM' };

function RejectModal({ open, onClose, onSubmit, saving }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reject request"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => onSubmit(reason)} loading={saving} disabled={!reason.trim()}>
            Reject request
          </Button>
        </>
      }
    >
      <Input label="Rejection reason" required textarea value={reason} onChange={setReason} placeholder="Let the requester know why" />
    </Modal>
  );
}

function FulfillModal({ open, onClose, request, onSubmit, saving }) {
  const { data } = useFetch(
    () =>
      open && request
        ? assetService.getAssets({ status: 'AVAILABLE', category: request.assetCategoryId?.id, limit: 100 })
        : Promise.resolve(null),
    [open, request?.id]
  );
  const [assetId, setAssetId] = useState('');
  const assets = data?.data || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fulfill request"
      description={request ? `Select an available ${request.assetCategoryId?.name || 'asset'} to hand over` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(assetId)} loading={saving} disabled={!assetId}>
            Fulfill request
          </Button>
        </>
      }
    >
      {assets.length === 0 ? (
        <EmptyState icon={PackageCheck} title="No available assets" message="There are no available assets in this category right now." />
      ) : (
        <Select
          label="Asset"
          required
          value={assetId}
          onChange={setAssetId}
          placeholder="Select an asset"
          options={assets.map((a) => ({ value: a.id, label: `${a.name} (${a.assetTag})` }))}
        />
      )}
    </Modal>
  );
}

export default function AssetRequests() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const canApprove = APPROVER_ROLES.includes(user?.role);

  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [fulfillTarget, setFulfillTarget] = useState(null);
  const [actionSaving, setActionSaving] = useState(false);

  const { data: categories } = useFetch(() => assetCategoryService.getCategories(), []);

  const { data, loading, error, refetch } = useFetch(
    () => assetRequestService.getRequests({ status: status === 'all' ? '' : status, page, limit: PAGE_SIZE }),
    [status, page]
  );
  const requests = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0 };

  useSocketEvent(SOCKET_EVENTS.ASSET_REQUEST_CREATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_REQUEST_APPROVED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_REQUEST_REJECTED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_REQUEST_FULFILLED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.ASSET_REQUEST_CANCELLED, refetch, [refetch]);

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }, []);

  function validate() {
    const next = {};
    if (!form.assetCategoryId) next.assetCategoryId = 'Select a category';
    if (!form.reason.trim()) next.reason = 'Tell us why you need this asset';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await assetRequestService.createRequest(form);
      toast('Asset request submitted.');
      setCreateOpen(false);
      setForm(INITIAL_FORM);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to submit request. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(request) {
    try {
      await assetRequestService.approveRequest(request.id);
      toast('Request approved.');
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to approve request.', 'error');
    }
  }

  async function handleReject(reason) {
    setActionSaving(true);
    try {
      await assetRequestService.rejectRequest(rejectTarget.id, reason);
      toast('Request rejected.');
      setRejectTarget(null);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to reject request.', 'error');
    } finally {
      setActionSaving(false);
    }
  }

  async function handleFulfill(assetId) {
    setActionSaving(true);
    try {
      await assetRequestService.fulfillRequest(fulfillTarget.id, assetId);
      toast('Request fulfilled.');
      setFulfillTarget(null);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to fulfill request.', 'error');
    } finally {
      setActionSaving(false);
    }
  }

  async function handleCancel(request) {
    try {
      await assetRequestService.cancelRequest(request.id);
      toast('Request cancelled.');
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to cancel request.', 'error');
    }
  }

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'FULFILLED', label: 'Fulfilled' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];
  const categoryOptions = (categories || []).map((c) => ({ value: c.id, label: c.name }));

  function canCancel(request) {
    const isOwn = !canApprove && request.requesterId;
    return ['PENDING', 'APPROVED'].includes(request.status) && (canApprove || isOwn);
  }

  return (
    <div>
      <PageHeader
        title={canApprove ? 'Asset Requests' : 'My Asset Requests'}
        subtitle={canApprove ? 'Review and fulfill asset requests from your team' : 'Request equipment and track your requests'}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={15} />
            Request Asset
          </Button>
        }
      />

      <Select
        aria-label="Filter by status"
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={statusOptions}
        className="mb-4 sm:w-48"
      />

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : requests.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No asset requests yet" message="Requests you submit will appear here." />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Request</TH>
                  {canApprove && <TH>Requester</TH>}
                  <TH>Date</TH>
                  <TH>Priority</TH>
                  <TH>Status</TH>
                  <TH>Approved By</TH>
                  <TH>Fulfilled Asset</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {requests.map((request) => (
                  <TR key={request.id}>
                    <TD>
                      <span className="block font-medium text-ink-900">{request.assetCategoryId?.name}</span>
                      {request.requestedAssetType && <span className="block text-xs text-ink-400">{request.requestedAssetType}</span>}
                    </TD>
                    {canApprove && <TD>{request.requesterId ? fullName(request.requesterId) : '—'}</TD>}
                    <TD className="text-ink-500">{formatDate(request.createdAt)}</TD>
                    <TD>
                      <PriorityBadge priority={request.priority} />
                    </TD>
                    <TD>
                      <StatusBadge status={request.status} />
                    </TD>
                    <TD>{request.approvedBy ? fullName(request.approvedBy) : '—'}</TD>
                    <TD>
                      {request.fulfilledAssetId ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/assets/${request.fulfilledAssetId._id}`)}
                          className="focus-ring rounded-lg text-brand-700 hover:underline"
                        >
                          {request.fulfilledAssetId.assetTag}
                        </button>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {canApprove && request.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(request)}
                              aria-label="Approve request"
                              className="focus-ring rounded-lg p-1.5 text-success-600 transition-colors hover:bg-success-50"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectTarget(request)}
                              aria-label="Reject request"
                              className="focus-ring rounded-lg p-1.5 text-danger-600 transition-colors hover:bg-danger-50"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                        {canApprove && request.status === 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => setFulfillTarget(request)}
                            aria-label="Fulfill request"
                            className="focus-ring rounded-lg p-1.5 text-brand-600 transition-colors hover:bg-brand-50"
                          >
                            <PackageCheck size={16} />
                          </button>
                        )}
                        {canCancel(request) && (
                          <button
                            type="button"
                            onClick={() => handleCancel(request)}
                            aria-label="Cancel request"
                            className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={pagination.page} totalItems={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
          </>
        )}
      </TableContainer>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Request an asset"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="asset-request-form" loading={saving}>
              {saving ? 'Submitting…' : 'Submit request'}
            </Button>
          </>
        }
      >
        <form id="asset-request-form" onSubmit={handleCreate} noValidate className="space-y-4">
          <Select
            label="Asset category"
            required
            value={form.assetCategoryId}
            onChange={(v) => updateField('assetCategoryId', v)}
            error={errors.assetCategoryId}
            placeholder="Select category"
            options={categoryOptions}
          />
          <Input
            label="Specific type / model (optional)"
            value={form.requestedAssetType}
            onChange={(v) => updateField('requestedAssetType', v)}
            placeholder="e.g. 16-inch laptop"
          />
          <Select label="Priority" value={form.priority} onChange={(v) => updateField('priority', v)} options={PRIORITIES} />
          <Input
            label="Reason"
            required
            textarea
            value={form.reason}
            onChange={(v) => updateField('reason', v)}
            error={errors.reason}
            placeholder="Why do you need this asset?"
          />
        </form>
      </Modal>

      <RejectModal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} onSubmit={handleReject} saving={actionSaving} />
      <FulfillModal
        open={Boolean(fulfillTarget)}
        request={fulfillTarget}
        onClose={() => setFulfillTarget(null)}
        onSubmit={handleFulfill}
        saving={actionSaving}
      />
    </div>
  );
}
