import { useCallback, useEffect, useState } from 'react';
import { Plus, Clock, MoreHorizontal, Pencil, Archive, Power } from 'lucide-react';
import { shiftService } from '../../services/shiftService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;
const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];
const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const INITIAL_FORM = {
  name: '', code: '', description: '', startTime: '09:00', endTime: '17:00', breakMinutes: 0,
};

function formatDuration(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function ShiftManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const { data, loading, error, refetch } = useFetch(
    () => (canView
      ? shiftService.getShifts({ search: debouncedSearch, status: status === 'all' ? '' : status, page, limit: PAGE_SIZE })
      : Promise.resolve(null)),
    [canView, debouncedSearch, status, page]
  );

  const shifts = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0 };

  function openCreate() {
    setEditing(null);
    setForm(INITIAL_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(shift) {
    setEditing(shift);
    setForm({
      name: shift.name, code: shift.code, description: shift.description || '',
      startTime: shift.startTime, endTime: shift.endTime, breakMinutes: shift.breakMinutes || 0,
    });
    setErrors({});
    setModalOpen(true);
  }

  function openDuplicate(shift) {
    setEditing(null);
    setForm({
      name: `${shift.name} (Copy)`, code: '', description: shift.description || '',
      startTime: shift.startTime, endTime: shift.endTime, breakMinutes: shift.breakMinutes || 0,
    });
    setErrors({});
    setModalOpen(true);
  }

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }, []);

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.code.trim()) next.code = 'Code is required';
    if (!form.startTime) next.startTime = 'Start time is required';
    if (!form.endTime) next.endTime = 'End time is required';
    if (form.breakMinutes !== '' && Number(form.breakMinutes) < 0) next.breakMinutes = 'Break minutes cannot be negative';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, breakMinutes: Number(form.breakMinutes) || 0 };
      if (editing) {
        await shiftService.updateShift(editing.id, payload);
        toast.success(`${form.name} updated.`);
      } else {
        await shiftService.createShift(payload);
        toast.success(`${form.name} created.`);
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save shift.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(shift) {
    const nextStatus = shift.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await shiftService.setShiftStatus(shift.id, nextStatus);
      toast.success(`${shift.name} ${nextStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update status.');
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await shiftService.archiveShift(archiveTarget.id);
      toast.success(`${archiveTarget.name} archived.`);
      setArchiveTarget(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to archive shift.');
    } finally {
      setArchiving(false);
    }
  }

  if (!canView) {
    return <ErrorState title="No access" message="You don't have permission to view shifts." />;
  }

  return (
    <div>
      <PageHeader
        title="Shifts"
        subtitle="Define reusable shift schedules — start/end times, breaks, and overnight configuration"
        actions={canManage && <Button onClick={openCreate}><Plus size={15} />Add Shift</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, code, or description…" className="sm:max-w-sm" />
        <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} className="sm:w-48" />
      </div>

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : shifts.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No shifts found"
            message={search || status !== 'all' ? 'Try a different search term or filter.' : 'Create shifts like Morning or Night to start scheduling employees.'}
            actionLabel={search || status !== 'all' || !canManage ? undefined : 'Add Shift'}
            onAction={search || status !== 'all' || !canManage ? undefined : openCreate}
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Code</TH>
                  <TH>Name</TH>
                  <TH>Time</TH>
                  <TH>Duration</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {shifts.map((shift) => (
                  <TR key={shift.id}>
                    <TD className="font-mono text-xs text-ink-500">{shift.code}</TD>
                    <TD className="font-medium text-ink-900">{shift.name}</TD>
                    <TD>
                      {shift.startTime} – {shift.endTime}
                      {shift.isOvernight && <span className="ml-1.5 text-xs text-ink-400">(overnight)</span>}
                    </TD>
                    <TD>{formatDuration(shift.scheduledMinutes)}</TD>
                    <TD><StatusBadge status={shift.status} /></TD>
                    <TD className="text-right">
                      {canManage && (
                        <Dropdown
                          width="w-44"
                          trigger={({ open }) => (
                            <button type="button" aria-label={`Actions for ${shift.name}`} aria-expanded={open} className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700">
                              <MoreHorizontal size={16} />
                            </button>
                          )}
                        >
                          <DropdownItem icon={Pencil} onClick={() => openEdit(shift)}>Edit</DropdownItem>
                          <DropdownItem icon={Plus} onClick={() => openDuplicate(shift)}>Duplicate</DropdownItem>
                          <DropdownItem icon={Power} onClick={() => toggleStatus(shift)}>
                            {shift.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem icon={Archive} danger onClick={() => setArchiveTarget(shift)}>Archive</DropdownItem>
                        </Dropdown>
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit shift' : 'Add shift'}
        description={editing ? `Update details for ${editing.name}` : 'Create a new reusable shift definition'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="shift-form" loading={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create shift'}</Button>
          </>
        }
      >
        <form id="shift-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" required value={form.name} onChange={(v) => updateField('name', v)} error={errors.name} placeholder="Morning Shift" />
            <Input label="Code" required value={form.code} onChange={(v) => updateField('code', v)} error={errors.code} uppercase placeholder="MORN" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start time" required type="time" value={form.startTime} onChange={(v) => updateField('startTime', v)} error={errors.startTime} />
            <Input label="End time" required type="time" value={form.endTime} onChange={(v) => updateField('endTime', v)} error={errors.endTime} hint={form.endTime && form.startTime && form.endTime <= form.startTime ? 'Overnight shift (crosses midnight)' : undefined} />
          </div>
          <Input label="Break (minutes)" type="number" value={form.breakMinutes} onChange={(v) => updateField('breakMinutes', v)} error={errors.breakMinutes} />
          <Input label="Description" textarea rows={2} value={form.description} onChange={(v) => updateField('description', v)} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        loading={archiving}
        title="Archive shift"
        message={archiveTarget ? `Are you sure you want to archive ${archiveTarget.name}? This is only possible if no employees currently have an active schedule on it. Archived shifts are hidden from new assignments but historical records remain intact.` : ''}
        confirmLabel="Archive"
      />
    </div>
  );
}
