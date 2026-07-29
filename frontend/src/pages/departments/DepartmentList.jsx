import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Building2, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { DEPARTMENT_STATUSES } from '../../data/departments';
import { fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';

const INITIAL_FORM = { name: '', code: '', headId: '', description: '', status: 'ACTIVE' };

export default function DepartmentList() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, refetch } = useFetch(
    () => departmentService.getDepartments({ search }),
    [search]
  );
  const departments = data || [];

  const { data: empResponse } = useFetch(
    () => employeeService.getEmployees({ limit: 1000 }),
    []
  );
  const employees = empResponse?.data || [];
  const managerOptions = employees.map((e) => ({ value: e.id, label: fullName(e) }));

  function openCreate() {
    setEditing(null);
    setForm(INITIAL_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(department) {
    setEditing(department);
    setForm({
      name: department.name,
      code: department.code,
      headId: department.headId || '',
      description: department.description,
      status: department.status || 'ACTIVE',
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
    if (!form.name.trim()) next.name = 'Department name is required';
    if (!form.code.trim()) next.code = 'Short code is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = { ...form, headId: form.headId || undefined };
    try {
      if (editing) {
        await departmentService.updateDepartment(editing.id, payload);
        toast(`${form.name} department updated.`);
      } else {
        await departmentService.createDepartment(payload);
        toast(`${form.name} department created.`);
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to save department. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await departmentService.deleteDepartment(deleteTarget.id);
      toast(`${deleteTarget.name} department deleted.`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to delete department. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Organize your company into functional teams"
        actions={
          <Button onClick={openCreate}>
            <Plus size={15} />
            Add Department
          </Button>
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search departments or heads…"
        className="mb-4 sm:max-w-sm"
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} lines={3} />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments found"
          message={search ? 'Try a different search term.' : 'Create your first department to organize employees.'}
          actionLabel={search ? undefined : 'Add Department'}
          onAction={search ? undefined : openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <div
              key={department.id}
              className="group relative rounded-xl border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-card-md"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Building2 size={18} aria-hidden="true" />
                </span>
                <Dropdown
                  width="w-44"
                  trigger={({ open }) => (
                    <button
                      type="button"
                      aria-label={`Actions for ${department.name}`}
                      aria-expanded={open}
                      className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  )}
                >
                  <DropdownItem icon={Eye} onClick={() => navigate(`/departments/${department.id}`)}>
                    View details
                  </DropdownItem>
                  <DropdownItem icon={Pencil} onClick={() => openEdit(department)}>
                    Edit
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem icon={Trash2} danger onClick={() => setDeleteTarget(department)}>
                    Delete
                  </DropdownItem>
                </Dropdown>
              </div>

              <Link to={`/departments/${department.id}`} className="focus-ring mt-3 block rounded-md">
                <h3 className="text-[15px] font-semibold text-ink-900 group-hover:text-brand-700">
                  {department.name}
                </h3>
              </Link>
              <p className="mt-1 line-clamp-2 text-[13px] text-ink-500">{department.description}</p>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <div className="flex items-center gap-2">
                  <Avatar name={department.head} size="xs" />
                  <div>
                    <p className="text-xs text-ink-400">Head</p>
                    <p className="text-[13px] font-medium text-ink-900">{department.head || '—'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-400">Members</p>
                  <p className="text-[13px] font-medium text-ink-900">{department.employeeCount}</p>
                </div>
                <StatusBadge status={department.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit department' : 'Add department'}
        description={editing ? `Update details for ${editing.name}` : 'Create a new functional team'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="department-form" loading={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create department'}
            </Button>
          </>
        }
      >
        <form id="department-form" onSubmit={handleSave} noValidate className="space-y-4">
          <Input
            label="Department name"
            required
            value={form.name}
            onChange={(v) => updateField('name', v)}
            error={errors.name}
            placeholder="e.g. Customer Success"
          />
          <Input
            label="Short code"
            required
            value={form.code}
            onChange={(v) => updateField('code', v)}
            error={errors.code}
            placeholder="e.g. CS"
            maxLength={10}
            uppercase
          />
          <Select
            label="Department head"
            value={form.headId}
            onChange={(v) => updateField('headId', v)}
            placeholder="Select a lead"
            options={[{ value: '', label: 'Select a lead' }, ...managerOptions]}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => updateField('status', v)}
            options={DEPARTMENT_STATUSES}
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(v) => updateField('description', v)}
            placeholder="What does this team own?"
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete department"
        message={
          deleteTarget
            ? `Are you sure you want to delete the ${deleteTarget.name} department? Employees in this department will need to be reassigned.`
            : ''
        }
        confirmLabel="Delete"
      />
    </div>
  );
}
