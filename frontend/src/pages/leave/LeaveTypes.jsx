import { useState } from 'react';
import { Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import { leaveTypeService } from '../../services/leaveTypeService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Tooltip from '../../components/ui/Tooltip';
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

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  totalDays: 12,
  isPaid: true,
  allowHalfDay: false,
  allowCarryForward: false,
  maxCarryForwardDays: 0,
  status: 'ACTIVE',
};

export default function LeaveTypes() {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, refetch } = useFetch(
    () => leaveTypeService.getLeaveTypes({ limit: 100 }).then((res) => res.data || []),
    []
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(leaveType) {
    setEditing(leaveType);
    setForm({
      name: leaveType.name || '',
      code: leaveType.code || '',
      description: leaveType.description || '',
      totalDays: leaveType.totalDays ?? 0,
      isPaid: leaveType.isPaid !== false,
      allowHalfDay: Boolean(leaveType.allowHalfDay),
      allowCarryForward: Boolean(leaveType.allowCarryForward),
      maxCarryForwardDays: leaveType.maxCarryForwardDays ?? 0,
      status: leaveType.status || 'ACTIVE',
    });
    setErrors({});
    setFormOpen(true);
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.code.trim()) next.code = 'Code is required';
    if (form.totalDays === '' || Number(form.totalDays) < 0) {
      next.totalDays = 'Total days must be zero or greater';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      totalDays: Number(form.totalDays),
      isPaid: form.isPaid,
      allowHalfDay: form.allowHalfDay,
      allowCarryForward: form.allowCarryForward,
      maxCarryForwardDays: Number(form.maxCarryForwardDays) || 0,
      status: form.status,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await leaveTypeService.updateLeaveType(editing.id, payload);
        toast('Leave type updated.');
      } else {
        await leaveTypeService.createLeaveType(payload);
        toast('Leave type created.');
      }
      setFormOpen(false);
      refetch();
    } catch (err) {
      const message = err?.response?.data?.message || 'Could not save leave type.';
      toast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await leaveTypeService.deleteLeaveType(deleteTarget.id);
      toast(`${deleteTarget.name} deactivated.`, 'info');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      const message = err?.response?.data?.message || 'Could not deactivate leave type.';
      toast(message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Leave Types"
        subtitle="Configure the leave categories available to your organization"
        actions={
          <Button onClick={openCreate}>
            <Plus size={15} />
            New leave type
          </Button>
        }
      />

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No leave types yet"
            message="Create your first leave type to start accepting leave requests."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Code</TH>
                <TH>Annual days</TH>
                <TH>Options</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {data.map((leaveType) => (
                <TR key={leaveType.id}>
                  <TD>
                    <span className="block font-medium text-ink-900">{leaveType.name}</span>
                    {leaveType.description && (
                      <span className="block max-w-64 truncate text-xs text-ink-400">
                        {leaveType.description}
                      </span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone="neutral" dot={false}>{leaveType.code}</Badge>
                  </TD>
                  <TD>{leaveType.totalDays}</TD>
                  <TD>
                    <span className="flex flex-wrap gap-1">
                      {leaveType.isPaid && <Badge tone="success" dot={false}>Paid</Badge>}
                      {leaveType.allowHalfDay && <Badge tone="info" dot={false}>Half day</Badge>}
                      {leaveType.allowCarryForward && (
                        <Badge tone="brand" dot={false}>Carry forward</Badge>
                      )}
                    </span>
                  </TD>
                  <TD>
                    <StatusBadge status={leaveType.status} />
                  </TD>
                  <TD className="text-right">
                    <span className="inline-flex items-center gap-1">
                      <Tooltip label="Edit">
                        <button
                          type="button"
                          aria-label={`Edit ${leaveType.name}`}
                          onClick={() => openEdit(leaveType)}
                          className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                        >
                          <Pencil size={16} />
                        </button>
                      </Tooltip>
                      {leaveType.status === 'ACTIVE' && (
                        <Tooltip label="Deactivate">
                          <button
                            type="button"
                            aria-label={`Deactivate ${leaveType.name}`}
                            onClick={() => setDeleteTarget(leaveType)}
                            className="focus-ring rounded-lg p-1.5 text-danger-600 transition-colors hover:bg-danger-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </Tooltip>
                      )}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit leave type' : 'New leave type'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="leave-type-form" loading={submitting}>
              {editing ? 'Save changes' : 'Create leave type'}
            </Button>
          </>
        }
      >
        <form id="leave-type-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              required
              value={form.name}
              error={errors.name}
              placeholder="Annual Leave"
              onChange={(e) => update('name', e.target.value)}
            />
            <Input
              label="Code"
              required
              value={form.code}
              error={errors.code}
              placeholder="ANL"
              onChange={(e) => update('code', e.target.value.toUpperCase())}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              type="number"
              min="0"
              label="Annual days"
              required
              value={form.totalDays}
              error={errors.totalDays}
              onChange={(e) => update('totalDays', e.target.value)}
            />
            <Select
              label="Status"
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="leave-type-description" className="mb-1.5 block text-[13px] font-medium text-ink-700">
              Description
            </label>
            <textarea
              id="leave-type-description"
              rows={2}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Optional details about this leave type"
              className="focus-ring w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink-900 transition-colors placeholder:text-ink-400 hover:border-ink-400"
            />
          </div>

          <fieldset className="space-y-2.5 rounded-lg border border-line bg-canvas p-3">
            <legend className="px-1 text-xs font-medium text-ink-500">Options</legend>
            <label className="flex items-center gap-2 text-[13px] text-ink-700">
              <input
                type="checkbox"
                checked={form.isPaid}
                onChange={(e) => update('isPaid', e.target.checked)}
                className="focus-ring h-4 w-4 rounded border-line-strong"
              />
              Paid leave
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink-700">
              <input
                type="checkbox"
                checked={form.allowHalfDay}
                onChange={(e) => update('allowHalfDay', e.target.checked)}
                className="focus-ring h-4 w-4 rounded border-line-strong"
              />
              Allow half-day requests
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink-700">
              <input
                type="checkbox"
                checked={form.allowCarryForward}
                onChange={(e) => update('allowCarryForward', e.target.checked)}
                className="focus-ring h-4 w-4 rounded border-line-strong"
              />
              Allow carry forward
            </label>
            {form.allowCarryForward && (
              <Input
                type="number"
                min="0"
                label="Max carry forward days"
                value={form.maxCarryForwardDays}
                onChange={(e) => update('maxCarryForwardDays', e.target.value)}
              />
            )}
          </fieldset>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        variant="danger"
        title="Deactivate leave type"
        message={
          deleteTarget
            ? `Deactivate "${deleteTarget.name}"? Employees will no longer be able to request this leave type.`
            : ''
        }
        confirmLabel="Deactivate"
      />
    </div>
  );
}
