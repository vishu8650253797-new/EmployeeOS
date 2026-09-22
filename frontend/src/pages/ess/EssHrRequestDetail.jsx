import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban, Send } from 'lucide-react';
import { hrRequestService } from '../../services/hrRequestService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { ErrorState, LoadingState } from '../../components/ui/States';

const CANCELLABLE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];
const LOCKED_STATUSES = ['CLOSED', 'CANCELLED'];

export default function EssHrRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const { data: req, loading, error, refetch } = useFetch(() => hrRequestService.getRequestById(id), [id]);

  async function handleCancel() {
    setProcessing(true);
    try {
      await hrRequestService.cancelRequest(id);
      toast.success('Request cancelled.');
      setCancelOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Could not cancel request.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await hrRequestService.addMessage(id, message.trim());
      setMessage('');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingState label="Loading request…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!req) return null;

  const canCancel = CANCELLABLE_STATUSES.includes(req.status);
  const isLocked = LOCKED_STATUSES.includes(req.status);

  return (
    <div>
      <PageHeader
        title={req.subject}
        subtitle={`Submitted ${formatDate(req.createdAt)}`}
        actions={
          <>
            <StatusBadge status={req.status} />
            {canCancel && (
              <Button variant="dangerGhost" onClick={() => setCancelOpen(true)}>
                <Ban size={14} />
                Cancel request
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate('/ess/requests')}>Back to requests</Button>
          </>
        }
      />

      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Badge tone="neutral" dot={false}>{req.category.replaceAll('_', ' ')}</Badge>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <p className="text-xs font-medium text-ink-400">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-700">{req.description}</p>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Conversation</h2>
          {req.messages.length === 0 ? (
            <p className="text-[13px] text-ink-500">No messages yet.</p>
          ) : (
            <div className="space-y-3">
              {req.messages.map((m) => {
                const isMe = m.authorId === user?.id;
                return (
                  <div
                    key={m._id || m.createdAt}
                    className={`rounded-xl border p-4 text-[13px] shadow-card ${
                      isMe ? 'border-brand-200 bg-brand-50' : 'border-line bg-surface'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs text-ink-400">
                      <span className="font-medium text-ink-700">{isMe ? 'You' : 'HR'}</span>
                      <span>{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-ink-700">{m.message}</p>
                  </div>
                );
              })}
            </div>
          )}

          {isLocked ? (
            <p className="mt-4 text-[13px] text-ink-500">This request is {req.status.toLowerCase()} and no longer accepts messages.</p>
          ) : (
            <form onSubmit={handleSendMessage} className="mt-4 flex items-end gap-2">
              <div className="flex-1">
                <Input
                  value={message}
                  onChange={setMessage}
                  placeholder="Write a follow-up message…"
                  textarea
                  rows={2}
                />
              </div>
              <Button type="submit" loading={sending} disabled={!message.trim()}>
                <Send size={14} />
                Send
              </Button>
            </form>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        loading={processing}
        variant="danger"
        title="Cancel HR request"
        message={`Cancel "${req.subject}"?`}
        confirmLabel="Cancel request"
      />
    </div>
  );
}
