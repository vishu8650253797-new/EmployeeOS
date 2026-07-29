import { useState } from 'react';
import { CalendarOff, Plus, Ban, Eye } from 'lucide-react';
import { leaveRequestService } from '../../services/leaveRequestService';
import { leaveBalanceService } from '../../services/leaveBalanceService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Tooltip from '../../components/ui/Tooltip';
import LeaveRequestForm from '../../components/leave/LeaveRequestForm';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import {
  TableContainer,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
} from '../../components/ui/Table';

export default function MyLeave() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  const {
    data: requests,
    loading,
    error,
    refetch,
  } = useFetch(
    () =>
      leaveRequestService
        .getMyLeaveRequests(statusFilter === 'ALL' ? {} : { status: statusFilter })
        .then((res) => res.data || []),
    [statusFilter]
  );

  const {
    data: balances,
    loading: balanceLoading,
    refetch: refetchBalances,
  } = useFetch(() => leaveBalanceService.getMyLeaveBalances().then((res) => res.data || []), []);

  const { data: allRequests, refetch: refetchAll } = useFetch(
    () => leaveRequestService.getMyLeaveRequests().then((res) => res.data || []),
    []
  );

  function refreshAll() {
    refetch();
    refetchAll();
    refetchBalances();
  }

  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_APPROVED, refreshAll, [refetch, refetchAll]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_REJECTED, refreshAll, [refetch, refetchAll]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_CANCELLED, refreshAll, [refetch, refetchAll]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_BALANCE_UPDATED, refetchBalances, [refetchBalances]);

  const counts = (allRequests || []).reduce(
    (acc, request) => {
      acc.all += 1;
      acc[request.status] = (acc[request.status] || 0) + 1;
      return acc;
    },
    { all: 0, PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 }
  );

  const tabs = [
    { value: 'ALL', label: 'All', count: counts.all },
    { value: 'PENDING', label: 'Pending', count: counts.PENDING },
    { value: 'APPROVED', label: 'Approved', count: counts.APPROVED },
    { value: 'REJECTED', label: 'Rejected', count: counts.REJECTED },
    { value: 'CANCELLED', label: 'Cancelled', count: counts.CANCELLED },
  ];

  async function handleCancel() {
    if (!cancelTarget) return;
    setProcessing(true);
    try {
      await leaveRequestService.cancelLeaveRequest(cancelTarget.id);
      toast('Leave request cancelled.', 'info');
      setCancelTarget(null);
      refreshAll();
    } catch (err) {
      const message = err?.response?.data?.message || 'Could not cancel request.';
      toast(message, 'error');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="My Leave"
        subtitle="Track your leave balances and request history"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={15} />
            Apply for leave
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {balanceLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <div className="skeleton h-4 w-24" />
                <div className="skeleton mt-3 h-7 w-16" />
              </Card>
            ))
          : (balances || []).map((balance) => (
              <Card key={balance.id || balance.type}>
                <p className="text-[13px] font-medium text-ink-500">{balance.type}</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">
                  {balance.remaining}
                  <span className="ml-1 text-sm font-normal text-ink-400">
                    / {balance.allocated} days
                  </span>
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{
                      width: `${balance.allocated ? (balance.used / balance.allocated) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-ink-400">
                  {balance.used} used · {balance.pending} pending
                </p>
              </Card>
            ))}
      </div>

      <div className="mt-6">
        <Tabs tabs={tabs} active={statusFilter} onChange={setStatusFilter} className="mb-4" />
      </div>

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : !requests || requests.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="No leave requests"
            message="Apply for leave and your requests will show up here."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Leave Type</TH>
                <TH>Duration</TH>
                <TH>Days</TH>
                <TH>Reason</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {requests.map((request) => (
                <TR key={request.id}>
                  <TD>
                    <Badge tone="neutral" dot={false}>{request.leaveType}</Badge>
                  </TD>
                  <TD className="text-ink-500">
                    {formatDate(request.startDate)} – {formatDate(request.endDate)}
                  </TD>
                  <TD>{request.numberOfDays}</TD>
                  <TD>
                    <span className="block max-w-52 truncate" title={request.reason}>
                      {request.reason}
                    </span>
                  </TD>
                  <TD>
                    <StatusBadge status={request.status} />
                  </TD>
                  <TD className="text-right">
                    <span className="inline-flex items-center gap-1">
                      {(request.status === 'PENDING' || request.status === 'APPROVED') && (
                        <Tooltip label="Cancel">
                          <button
                            type="button"
                            aria-label="Cancel this request"
                            onClick={() => setCancelTarget(request)}
                            className="focus-ring rounded-lg p-1.5 text-danger-600 transition-colors hover:bg-danger-50"
                          >
                            <Ban size={16} />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip label="View details">
                        <button
                          type="button"
                          aria-label="View request details"
                          onClick={() => setDetailTarget(request)}
                          className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                        >
                          <Eye size={16} />
                        </button>
                      </Tooltip>
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Leave request details"
        footer={
          <Button variant="secondary" onClick={() => setDetailTarget(null)}>
            Close
          </Button>
        }
      >
        {detailTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge tone="neutral" dot={false}>{detailTarget.leaveType}</Badge>
              <StatusBadge status={detailTarget.status} className="ml-auto" />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-canvas p-4 text-[13px]">
              <div>
                <dt className="text-xs text-ink-400">From</dt>
                <dd className="mt-0.5 font-medium text-ink-900">{formatDate(detailTarget.startDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">To</dt>
                <dd className="mt-0.5 font-medium text-ink-900">{formatDate(detailTarget.endDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Days</dt>
                <dd className="mt-0.5 font-medium text-ink-900">
                  {detailTarget.numberOfDays} {detailTarget.numberOfDays === 1 ? 'day' : 'days'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Submitted</dt>
                <dd className="mt-0.5 font-medium text-ink-900">{formatDate(detailTarget.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Reviewed by</dt>
                <dd className="mt-0.5 font-medium text-ink-900">
                  {detailTarget.reviewedBy?.name || '—'}
                </dd>
              </div>
            </dl>
            <div>
              <p className="text-xs font-medium text-ink-400">Reason</p>
              <p className="mt-1 text-[13px] text-ink-700">{detailTarget.reason || '—'}</p>
            </div>
            {detailTarget.rejectionReason && (
              <div className="rounded-lg border border-danger-600/20 bg-danger-50 p-3">
                <p className="text-xs font-medium text-danger-700">Rejection note</p>
                <p className="mt-1 text-[13px] text-danger-700">{detailTarget.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={processing}
        variant="danger"
        title="Cancel leave request"
        message={
          cancelTarget
            ? `Cancel your ${cancelTarget.leaveType.toLowerCase()} request for ${cancelTarget.numberOfDays} ${cancelTarget.numberOfDays === 1 ? 'day' : 'days'} (${formatDate(cancelTarget.startDate)} – ${formatDate(cancelTarget.endDate)})?`
            : ''
        }
        confirmLabel="Cancel request"
      />

      <LeaveRequestForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={refreshAll} />
    </div>
  );
}
