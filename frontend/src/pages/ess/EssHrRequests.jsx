import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Eye } from 'lucide-react';
import { hrRequestService, HR_REQUEST_CATEGORIES } from '../../services/hrRequestService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Tooltip from '../../components/ui/Tooltip';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const EMPTY_FORM = { category: '', subject: '', description: '' };

function NewRequestModal({ open, onClose, onSuccess }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.category) next.category = 'Category is required';
    if (!form.subject.trim()) next.subject = 'Subject is required';
    else if (form.subject.length > 200) next.subject = 'Subject must be under 200 characters';
    if (!form.description.trim()) next.description = 'Description is required';
    else if (form.description.length > 5000) next.description = 'Description must be under 5000 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await hrRequestService.createRequest({
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
      });
      toast.success('HR request submitted.');
      setForm(EMPTY_FORM);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New HR request"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="hr-request-form" loading={submitting}>Submit request</Button>
        </>
      }
    >
      <form id="hr-request-form" onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Category"
          required
          placeholder="Select a category"
          options={HR_REQUEST_CATEGORIES}
          value={form.category}
          error={errors.category}
          onChange={(v) => update('category', v)}
        />
        <Input
          label="Subject"
          required
          value={form.subject}
          error={errors.subject}
          onChange={(v) => update('subject', v)}
          placeholder="Briefly summarize your request"
        />
        <Input
          label="Description"
          required
          textarea
          rows={4}
          value={form.description}
          error={errors.description}
          onChange={(v) => update('description', v)}
          placeholder="Add any details HR will need"
        />
      </form>
    </Modal>
  );
}

export default function EssHrRequests() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);

  const { data, loading, error, refetch } = useFetch(() => hrRequestService.getRequests({ limit: 50 }), []);
  const requests = data?.data || [];

  const refreshOnEvent = useCallback(() => refetch(), [refetch]);
  useSocketEvent(SOCKET_EVENTS.HR_REQUEST_STATUS_CHANGED, refreshOnEvent, [refreshOnEvent]);
  useSocketEvent(SOCKET_EVENTS.HR_REQUEST_MESSAGE_ADDED, refreshOnEvent, [refreshOnEvent]);

  return (
    <div>
      <PageHeader
        title="HR Requests"
        subtitle="Submit and track requests to HR"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={15} />
            New request
          </Button>
        }
      />

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : requests.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No HR requests yet" message="Submit a request and track its status here." actionLabel="New request" onAction={() => setFormOpen(true)} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Subject</TH>
                <TH>Category</TH>
                <TH>Status</TH>
                <TH>Last updated</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {requests.map((r) => (
                <TR key={r.id} className="cursor-pointer" onClick={() => navigate(`/ess/requests/${r.id}`)}>
                  <TD className="font-medium text-ink-900">{r.subject}</TD>
                  <TD><Badge tone="neutral" dot={false}>{r.category.replaceAll('_', ' ')}</Badge></TD>
                  <TD><StatusBadge status={r.status} /></TD>
                  <TD className="text-ink-500">{formatDate(r.updatedAt)}</TD>
                  <TD className="text-right">
                    <Tooltip label="View details">
                      <button
                        type="button"
                        aria-label="View request details"
                        onClick={(e) => { e.stopPropagation(); navigate(`/ess/requests/${r.id}`); }}
                        className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                      >
                        <Eye size={16} />
                      </button>
                    </Tooltip>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>

      <NewRequestModal open={formOpen} onClose={() => setFormOpen(false)} onSuccess={refetch} />
    </div>
  );
}
