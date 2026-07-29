import { useState } from 'react';
import { CalendarOff, Check, X, Eye, Plus, Ban } from 'lucide-react';
import { leaveService } from '../../services/leaveService';
import { leaveRequestService } from '../../services/leaveRequestService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
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

const ACTION_LABELS = { approve: 'Approve', reject: 'Reject', cancel: 'Cancel' };

export default function Leave() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [detailTarget, setDetailTarget] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'approve'|'reject'|'cancel', request }
  const [processing, setProcessing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const {
    data: requests,
    loading,
    error,
    refetch,
  } = useFetch(() => leaveService.getLeaveRequests({ status: statusFilter }), [statusFilter]);

  const { data: balances, loading: balanceLoading } = useFetch(
    () => leaveService.getLeaveBalance(),
    []
  );

  const { data: allRequests, refetch: refetchAll } = useFetch(
    () => leaveService.getLeaveRequests(),
    []
  );

  function refreshAll() {
    refetch();
    refetchAll();
  }

  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_CREATED, refreshAll, [refetch, refetchAll]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_APPROVED, refreshAll, [refetch, refetchAll]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_REJECTED, refreshAll, [refetch, refetchAll]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_CANCELLED, refreshAll, [refetch, refetchAll]);
  useSocketEvent(SOCKET_EVENTS.DASHBOARD_LEAVE_UPDATED, refreshAll, [refetch, refetchAll]);

  const counts = (allRequests || []).reduce(
    (acc, request) => {
      acc.all += 1;
      acc[request.status] = (acc[request.status] || 0) + 1;
      return acc;
    },
    { all: 0, PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 }
  );

  const tabs = [
    { value: 'ALL', label: 'All requests', count: counts.all },
    { value: 'PENDING', label: 'Pending', count: counts.PENDING },
    { value: 'APPROVED', label: 'Approved', count: counts.APPROVED },
    { value: 'REJECTED', label: 'Rejected', count: counts.REJECTED },
    { value: 'CANCELLED', label: 'Cancelled', count: counts.CANCELLED },
  ];

  async function handleConfirm() {
    if (!confirmAction) return;
    const { type, request } = confirmAction;
    setProcessing(true);
    try {
      if (type === 'approve') {
        await leaveService.approveLeave(request.id);
        toast(`${request.employeeName}'s leave request approved.`);
      } else if (type === 'reject') {
        await leaveService.rejectLeave(request.id, 'Rejected by approver.');
        toast(`${request.employeeName}'s leave request rejected.`, 'info');
      } else {
        await leaveRequestService.cancelLeaveRequest(request.id);
        toast(`${request.employeeName}'s leave request cancelled.`, 'info');
      }
      setConfirmAction(null);
      refreshAll();
    } catch (err) {
      const message = err?.response?.data?.message || 'Action failed. Please try again.';
      toast(message, 'error');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Review and manage team leave requests"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={15} />
            Apply for leave
          </Button>
        }
      />

      {/* Leave balance summary */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {balanceLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <div className="skeleton h-4 w-24" />
                <div className="skeleton mt-3 h-7 w-16" />
              </Card>
            ))
          : (balances || []).map((balance) => (
              <Card key={balance.type}>
                <p className="text-[13px] font-medium text-ink-500">{balance.type}</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">
                  {balance.remaining}
                  <span className="ml-1 text-sm font-normal text-ink-400">/ {balance.allocated} days</span>
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${(balance.used / balance.allocated) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-ink-400">{balance.used} days used this year</p>
              </Card>
            ))}
      </div>

      <div className="mt-6">
        <Tabs tabs={tabs} active={statusFilter} onChange={setStatusFilter} className="mb-4" />
      </div>

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="No leave requests"
            message={
              statusFilter === 'all'
                ? 'Leave requests from your team will appear here.'
                : `There are no ${statusFilter.toLowerCase()} requests right now.`
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Employee</TH>
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
                    <span className="flex items-center gap-3">
                      <Avatar name={request.employeeName} size="sm" />
                      <span>
                        <span className="block font-medium text-ink-900">{request.employeeName}</span>
                        <span className="block text-xs text-ink-400">{request.department}</span>
                      </span>
                    </span>
                  </TD>
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
                      {request.status === 'PENDING' && (
                        <>
                          <Tooltip label="Approve">
                            <button
                              type="button"
                              aria-label={`Approve ${request.employeeName}'s request`}
                              onClick={() => setConfirmAction({ type: 'approve', request })}
                              className="focus-ring rounded-lg p-1.5 text-success-600 transition-colors hover:bg-success-50"
                            >
                              <Check size={16} />
                            </button>
                          </Tooltip>
                          <Tooltip label="Reject">
                            <button
                              type="button"
                              aria-label={`Reject ${request.employeeName}'s request`}
                              onClick={() => setConfirmAction({ type: 'reject', request })}
                              className="focus-ring rounded-lg p-1.5 text-danger-600 transition-colors hover:bg-danger-50"
                            >
                              <X size={16} />
                            </button>
                          </Tooltip>
                        </>
                      )}
                      {(request.status === 'PENDING' || request.status === 'APPROVED') && (
                        <Tooltip label="Cancel">
                          <button
                            type="button"
                            aria-label={`Cancel ${request.employeeName}'s request`}
                            onClick={() => setConfirmAction({ type: 'cancel', request })}
                            className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                          >
                            <Ban size={16} />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip label="View details">
                        <button
                          type="button"
                          aria-label={`View ${request.employeeName}'s request details`}
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

      {/* Details modal */}
      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Leave request details"
        footer={
          detailTarget?.status === 'PENDING' ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmAction({ type: 'reject', request: detailTarget });
                  setDetailTarget(null);
                }}
              >
                <X size={14} />
                Reject
              </Button>
              <Button
                onClick={() => {
                  setConfirmAction({ type: 'approve', request: detailTarget });
                  setDetailTarget(null);
                }}
              >
                <Check size={14} />
                Approve
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setDetailTarget(null)}>
              Close
            </Button>
          )
        }
      >
        {detailTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={detailTarget.employeeName} size="md" />
              <div>
                <p className="text-sm font-semibold text-ink-900">{detailTarget.employeeName}</p>
                <p className="text-[13px] text-ink-500">{detailTarget.department}</p>
              </div>
              <StatusBadge status={detailTarget.status} className="ml-auto" />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-canvas p-4 text-[13px]">
              <div>
                <dt className="text-xs text-ink-400">Leave type</dt>
                <dd className="mt-0.5 font-medium text-ink-900">{detailTarget.leaveType}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Duration</dt>
                <dd className="mt-0.5 font-medium text-ink-900">
                  {detailTarget.numberOfDays} {detailTarget.numberOfDays === 1 ? 'day' : 'days'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">From</dt>
                <dd className="mt-0.5 font-medium text-ink-900">{formatDate(detailTarget.startDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">To</dt>
                <dd className="mt-0.5 font-medium text-ink-900">{formatDate(detailTarget.endDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Submitted</dt>
                <dd className="mt-0.5 font-medium text-ink-900">{formatDate(detailTarget.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Reviewed by</dt>
                <dd className="mt-0.5 font-medium text-ink-900">{detailTarget.reviewedBy?.name || '-'}</dd>
              </div>
            </dl>
            <div>
              <p className="text-xs font-medium text-ink-400">Reason</p>
              <p className="mt-1 text-[13px] text-ink-700">{detailTarget.reason}</p>
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

      {/* Approve / reject / cancel confirmation */}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        loading={processing}
        variant={confirmAction?.type === 'approve' ? 'primary' : 'danger'}
        title={`${ACTION_LABELS[confirmAction?.type] || 'Confirm'} leave request`}
        message={
          confirmAction
            ? `${ACTION_LABELS[confirmAction.type]} ${confirmAction.request.employeeName}'s ${confirmAction.request.leaveType.toLowerCase()} request for ${confirmAction.request.numberOfDays} ${confirmAction.request.numberOfDays === 1 ? 'day' : 'days'} (${formatDate(confirmAction.request.startDate)} – ${formatDate(confirmAction.request.endDate)})?`
            : ''
        }
        confirmLabel={ACTION_LABELS[confirmAction?.type] || 'Confirm'}
      />

      {/* Apply for leave */}
      <LeaveRequestForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={refreshAll}
      />
    </div>
  );
}
