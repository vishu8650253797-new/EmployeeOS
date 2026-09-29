import { useEffect, useState } from 'react';
import { Plus, CalendarClock, MoreHorizontal, Pencil, Ban } from 'lucide-react';
import { employeeScheduleService } from '../../services/employeeScheduleService';
import { departmentService } from '../../services/departmentService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { fullName } from '../../utils/format';
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
import AssignShiftModal from '../../components/scheduling/AssignShiftModal';

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;
const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUPERSEDED', label: 'Superseded' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDaysOfWeek(days) {
  if (!days || days.length === 0) return '—';
  if (days.length === 7) return 'Every day';
  return [...days].sort().map((d) => DAY_LABELS[d]).join(', ');
}

function isEditable(schedule) {
  return schedule.status === 'ACTIVE' && new Date(schedule.effectiveFrom) > new Date();
}

export default function EmployeeScheduling() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [page, setPage] = useState(1);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ effectiveFrom: '', effectiveTo: '', reason: '' });
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, departmentId]);

  const { data: departments } = useFetch(
    () => (canView ? departmentService.getDepartments() : Promise.resolve(null)),
    [canView]
  );

  const { data, loading, error, refetch } = useFetch(
    () => (canView
      ? employeeScheduleService.getSchedules({
          search: debouncedSearch, status: status === 'all' ? '' : status,
          departmentId: departmentId === 'all' ? '' : departmentId, page, limit: PAGE_SIZE,
        })
      : Promise.resolve(null)),
    [canView, debouncedSearch, status, departmentId, page]
  );

  const schedules = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0 };

  function openEdit(schedule) {
    setEditTarget(schedule);
    setEditForm({
      effectiveFrom: schedule.effectiveFrom.slice(0, 10),
      effectiveTo: schedule.effectiveTo ? schedule.effectiveTo.slice(0, 10) : '',
      reason: schedule.reason || '',
    });
    setEditErrors({});
  }

  async function handleEditSave(event) {
    event.preventDefault();
    if (!editForm.effectiveFrom) {
      setEditErrors({ effectiveFrom: 'Start date is required' });
      return;
    }
    setSaving(true);
    try {
      await employeeScheduleService.updateSchedule(editTarget.id, {
        effectiveFrom: editForm.effectiveFrom, effectiveTo: editForm.effectiveTo || undefined, reason: editForm.reason,
      });
      toast.success('Assignment updated.');
      setEditTarget(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update assignment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await employeeScheduleService.cancel(cancelTarget.id);
      toast.success('Assignment cancelled.');
      setCancelTarget(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to cancel assignment.');
    } finally {
      setCancelling(false);
    }
  }

  if (!canView) {
    return <ErrorState title="No access" message="You don't have permission to view employee schedules." />;
  }

  return (
    <div>
      <PageHeader
        title="Employee Scheduling"
        subtitle="Assign shifts to employees for specific dates or date ranges"
        actions={<Button onClick={() => setAssignModalOpen(true)}><Plus size={15} />Assign Shift</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by employee name or code…" className="sm:max-w-sm" />
        <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} className="sm:w-44" />
        <Select
          value={departmentId}
          onChange={setDepartmentId}
          options={[{ value: 'all', label: 'All departments' }, ...(departments || []).map((d) => ({ value: d.id, label: d.name }))]}
          className="sm:w-48"
        />
      </div>

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : schedules.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No schedule assignments found"
            message={search || status !== 'all' || departmentId !== 'all' ? 'Try a different search term or filter.' : 'Assign a shift to an employee to get started.'}
            actionLabel={search || status !== 'all' || departmentId !== 'all' ? undefined : 'Assign Shift'}
            onAction={search || status !== 'all' || departmentId !== 'all' ? undefined : () => setAssignModalOpen(true)}
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Employee</TH>
                  <TH>Shift</TH>
                  <TH>Effective</TH>
                  <TH>Days</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {schedules.map((schedule) => (
                  <TR key={schedule.id}>
                    <TD>
                      <p className="font-medium text-ink-900">{fullName(schedule.employeeId)}</p>
                      <p className="text-xs text-ink-400">{schedule.employeeId?.employeeId}</p>
                    </TD>
                    <TD>
                      <p className="text-ink-900">{schedule.shiftId?.name}</p>
                      <p className="text-xs text-ink-400">{schedule.shiftId?.startTime}–{schedule.shiftId?.endTime}{schedule.shiftId?.isOvernight ? ' (overnight)' : ''}</p>
                    </TD>
                    <TD>
                      {new Date(schedule.effectiveFrom).toLocaleDateString()}
                      {' – '}
                      {schedule.effectiveTo ? new Date(schedule.effectiveTo).toLocaleDateString() : 'ongoing'}
                    </TD>
                    <TD className="text-xs text-ink-500">{formatDaysOfWeek(schedule.daysOfWeek)}</TD>
                    <TD><StatusBadge status={schedule.status} /></TD>
                    <TD className="text-right">
                      {(isEditable(schedule) || schedule.status === 'ACTIVE') && (
                        <Dropdown
                          width="w-40"
                          trigger={({ open }) => (
                            <button type="button" aria-label={`Actions for ${fullName(schedule.employeeId)}`} aria-expanded={open} className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700">
                              <MoreHorizontal size={16} />
                            </button>
                          )}
                        >
                          {isEditable(schedule) && <DropdownItem icon={Pencil} onClick={() => openEdit(schedule)}>Edit</DropdownItem>}
                          {isEditable(schedule) && <DropdownSeparator />}
                          {schedule.status === 'ACTIVE' && (
                            <DropdownItem icon={Ban} danger onClick={() => setCancelTarget(schedule)}>Cancel</DropdownItem>
                          )}
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

      <AssignShiftModal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} onDone={refetch} />

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit assignment"
        description={editTarget ? `${fullName(editTarget.employeeId)} — this hasn't started yet, so it can still be changed` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="edit-schedule-form" loading={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </>
        }
      >
        <form id="edit-schedule-form" onSubmit={handleEditSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Effective from" required type="date" value={editForm.effectiveFrom} onChange={(v) => setEditForm((f) => ({ ...f, effectiveFrom: v }))} error={editErrors.effectiveFrom} />
            <Input label="Effective to (optional)" type="date" value={editForm.effectiveTo} onChange={(v) => setEditForm((f) => ({ ...f, effectiveTo: v }))} />
          </div>
          <Input label="Reason" textarea rows={2} value={editForm.reason} onChange={(v) => setEditForm((f) => ({ ...f, reason: v }))} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={cancelling}
        title="Cancel assignment"
        message={cancelTarget ? `Are you sure you want to cancel ${fullName(cancelTarget.employeeId)}'s ${cancelTarget.shiftId?.name} assignment?` : ''}
        confirmLabel="Cancel assignment"
      />
    </div>
  );
}
