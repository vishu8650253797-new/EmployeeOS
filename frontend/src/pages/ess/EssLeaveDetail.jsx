import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban } from 'lucide-react';
import { essLeaveService } from '../../services/essLeaveService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { ErrorState, LoadingState } from '../../components/ui/States';

export default function EssLeaveDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { data: request, loading, error, refetch } = useFetch(() => essLeaveService.getRequestById(id), [id]);

  async function handleCancel() {
    setProcessing(true);
    try {
      await essLeaveService.cancelRequest(id);
      toast.success('Leave request cancelled.');
      setCancelOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Could not cancel request.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) return <LoadingState label="Loading leave request…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!request) return null;

  const canCancel = request.status === 'PENDING' || request.status === 'APPROVED';

  return (
    <div>
      <PageHeader
        title="Leave Request"
        subtitle={`Submitted ${formatDate(request.createdAt)}`}
        actions={
          <>
            <StatusBadge status={request.status} />
            {canCancel && (
              <Button variant="dangerGhost" onClick={() => setCancelOpen(true)}>
                <Ban size={14} />
                Cancel request
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate('/ess/leave/history')}>Back to history</Button>
          </>
        }
      />

      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Badge tone="neutral" dot={false}>{request.leaveType}</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-5 text-[13px] shadow-card">
          <div>
            <dt className="text-xs text-ink-400">From</dt>
            <dd className="mt-0.5 font-medium text-ink-900">{formatDate(request.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-400">To</dt>
            <dd className="mt-0.5 font-medium text-ink-900">{formatDate(request.endDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-400">Days</dt>
            <dd className="mt-0.5 font-medium text-ink-900">{request.numberOfDays} {request.numberOfDays === 1 ? 'day' : 'days'}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-400">Duration type</dt>
            <dd className="mt-0.5 font-medium text-ink-900">{request.durationType === 'HALF_DAY' ? 'Half day' : 'Full day'}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-400">Reviewed by</dt>
            <dd className="mt-0.5 font-medium text-ink-900">{request.reviewedBy?.name || '—'}</dd>
          </div>
          {request.cancelledAt && (
            <div>
              <dt className="text-xs text-ink-400">Cancelled on</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{formatDate(request.cancelledAt)}</dd>
            </div>
          )}
        </dl>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <p className="text-xs font-medium text-ink-400">Reason</p>
          <p className="mt-1 text-[13px] text-ink-700">{request.reason || '—'}</p>
        </div>

        {request.rejectionReason && (
          <div className="rounded-xl border border-danger-600/20 bg-danger-50 p-4">
            <p className="text-xs font-medium text-danger-700">Rejection note</p>
            <p className="mt-1 text-[13px] text-danger-700">{request.rejectionReason}</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        loading={processing}
        variant="danger"
        title="Cancel leave request"
        message={`Cancel your ${(request.leaveType || '').toLowerCase()} request (${formatDate(request.startDate)} – ${formatDate(request.endDate)})?`}
        confirmLabel="Cancel request"
      />
    </div>
  );
}
