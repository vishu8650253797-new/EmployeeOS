import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarOff, Plus, Ban, Eye, History } from 'lucide-react';
import { essLeaveService } from '../../services/essLeaveService';
import { essService } from '../../services/essService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Tooltip from '../../components/ui/Tooltip';
import LeaveRequestForm from '../../components/leave/LeaveRequestForm';
import { TableSkeleton, StatCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

export default function EssLeave() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  const { data: context } = useFetch(() => essService.getMe(), []);
  const { data: balances, loading: balanceLoading, refetch: refetchBalances } = useFetch(() => essLeaveService.getBalance(), []);
  const { data: requestsData, loading, error, refetch } = useFetch(() => essLeaveService.getRequests({ page: 1, limit: 5 }), []);

  const requests = requestsData?.data || [];

  function refreshAll() {
    refetch();
    refetchBalances();
  }

  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_APPROVED, refreshAll, [refreshAll]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_REJECTED, refreshAll, [refreshAll]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_CANCELLED, refreshAll, [refreshAll]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_BALANCE_UPDATED, refetchBalances, [refetchBalances]);

  async function handleCancel() {
    if (!cancelTarget) return;
    setProcessing(true);
    try {
      await essLeaveService.cancelRequest(cancelTarget.id);
      toast.success('Leave request cancelled.');
      setCancelTarget(null);
      refreshAll();
    } catch (err) {
      toast.error(err.message || 'Could not cancel request.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="My Leave"
        subtitle="Track your leave balances and recent requests"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/ess/leave/history')}>
              <History size={15} />
              Full history
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={15} />
              Apply for leave
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {balanceLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (balances || []).length === 0 ? (
          <div className="col-span-full">
            <EmptyState title="No leave balances configured" message="Contact HR if you believe this is a mistake." />
          </div>
        ) : (
          balances.map((balance) => (
            <Card key={balance.id}>
              <p className="text-[13px] font-medium text-ink-500">{balance.type}</p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">
                {balance.remaining}
                <span className="ml-1 text-sm font-normal text-ink-400">/ {balance.allocated} days</span>
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${balance.allocated ? (balance.used / balance.allocated) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-ink-400">{balance.used} used · {balance.pending} pending</p>
            </Card>
          ))
        )}
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">Recent requests</h2>
        <button type="button" onClick={() => navigate('/ess/leave/history')} className="focus-ring rounded-md text-[13px] font-medium text-brand-600 hover:text-brand-700">
          View all
        </button>
      </div>
      <TableContainer>
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : requests.length === 0 ? (
          <EmptyState icon={CalendarOff} title="No leave requests" message="Apply for leave and your requests will show up here." actionLabel="Apply for leave" onAction={() => setFormOpen(true)} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Leave Type</TH>
                <TH>Duration</TH>
                <TH>Days</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {requests.map((r) => (
                <TR key={r.id}>
                  <TD><Badge tone="neutral" dot={false}>{r.leaveType}</Badge></TD>
                  <TD className="text-ink-500">{formatDate(r.startDate)} – {formatDate(r.endDate)}</TD>
                  <TD>{r.numberOfDays}</TD>
                  <TD><StatusBadge status={r.status} /></TD>
                  <TD className="text-right">
                    <span className="inline-flex items-center gap-1">
                      {(r.status === 'PENDING' || r.status === 'APPROVED') && (
                        <Tooltip label="Cancel">
                          <button
                            type="button"
                            aria-label="Cancel this request"
                            onClick={() => setCancelTarget(r)}
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
                          onClick={() => navigate(`/ess/leave/${r.id}`)}
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

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={processing}
        variant="danger"
        title="Cancel leave request"
        message={
          cancelTarget
            ? `Cancel your ${(cancelTarget.leaveType || '').toLowerCase()} request (${formatDate(cancelTarget.startDate)} – ${formatDate(cancelTarget.endDate)})?`
            : ''
        }
        confirmLabel="Cancel request"
      />

      <LeaveRequestForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={refreshAll} employeeId={context?.employeeId} />
    </div>
  );
}
