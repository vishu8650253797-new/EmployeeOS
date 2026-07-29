import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderKanban, MoreHorizontal, Eye, Pencil, Trash2, Users, Calendar, TrendingUp } from 'lucide-react';
import { projectService } from '../../services/projectService';
import { employeeService } from '../../services/employeeService';
import { departmentService } from '../../services/departmentService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';

const INITIAL_FORM = { name: '', key: '', description: '', ownerId: '', departmentId: '', priority: 'MEDIUM', status: 'PLANNING', startDate: '', dueDate: '' };

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: 'ALL', label: 'All Priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function Projects() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, refetch } = useFetch(
    () => projectService.getProjects({ search, status: statusFilter === 'ALL' ? undefined : statusFilter, priority: priorityFilter === 'ALL' ? undefined : priorityFilter }),
    [search, statusFilter, priorityFilter]
  );
  const projects = data?.data?.data || [];

  const { data: empResponse } = useFetch(() => employeeService.getEmployees({ limit: 1000 }), []);
  const employees = empResponse?.data?.data || [];
  const ownerOptions = employees.map((e) => ({ value: e.id, label: fullName(e) }));

  const { data: deptResponse } = useFetch(() => departmentService.getDepartments({ limit: 1000 }), []);
  const departments = deptResponse?.data?.data || [];
  const departmentOptions = departments.map((d) => ({ value: d.id, label: d.name }));

  function openCreate() {
    setEditing(null);
    setForm(INITIAL_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(project) {
    setEditing(project);
    setForm({
      name: project.name,
      key: project.key,
      description: project.description,
      ownerId: project.ownerId,
      departmentId: project.departmentId || '',
      priority: project.priority,
      status: project.status,
      startDate: project.startDate ? project.startDate.slice(0, 10) : '',
      dueDate: project.dueDate ? project.dueDate.slice(0, 10) : '',
    });
    setErrors({});
    setModalOpen(true);
  }

  function updateField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Project name is required';
    if (!form.key.trim()) next.key = 'Project key is required';
    if (!form.ownerId) next.ownerId = 'Owner is required';
    if (form.startDate && form.dueDate && new Date(form.dueDate) < new Date(form.startDate)) {
      next.dueDate = 'Due date cannot be before start date';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await projectService.updateProject(editing.id, form);
        toast.success('Project updated successfully');
      } else {
        await projectService.createProject(form);
        toast.success('Project created successfully');
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectService.deleteProject(deleteTarget.id);
      toast.success('Project deleted successfully');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <CardSkeleton count={6} />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Manage your organization's projects and track progress"
        actions={
          <Button onClick={openCreate} icon={<Plus />}>
            New Project
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects..." className="flex-1" />
        <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="sm:w-48" />
        <Select value={priorityFilter} onChange={setPriorityFilter} options={PRIORITY_OPTIONS} className="sm:w-48" />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          message={search ? 'Try adjusting your search or filters' : 'Create your first project to start managing work'}
          actionLabel={search ? null : 'Create Project'}
          onAction={search ? null : openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{project.key}</span>
                    <StatusBadge status={project.status} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{project.name}</h3>
                </div>
                <Dropdown
                  trigger={
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <MoreHorizontal className="w-5 h-5 text-gray-500" />
                    </button>
                  }
                >
                  <DropdownItem onClick={() => navigate(`/projects/${project.id}`)} icon={<Eye />}>
                    View Details
                  </DropdownItem>
                  <DropdownItem onClick={() => navigate(`/projects/${project.id}/board`)} icon={<FolderKanban />}>
                    Kanban Board
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem onClick={() => openEdit(project)} icon={<Pencil />}>
                    Edit
                  </DropdownItem>
                  <DropdownItem onClick={() => setDeleteTarget(project)} icon={<Trash2 />} className="text-red-600">
                    Delete
                  </DropdownItem>
                </Dropdown>
              </div>

              {project.description && <p className="text-sm text-gray-600 mb-4 line-clamp-2">{project.description}</p>}

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{project.members?.length || 0}</span>
                  </div>
                  {project.dueDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(project.dueDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <PriorityBadge priority={project.priority} />
                  <Avatar src={project.owner?.avatar} name={fullName(project.owner)} size="sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Project' : 'New Project'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Project Name" value={form.name} onChange={(v) => updateField('name', v)} error={errors.name} required />
            <Input label="Project Key" value={form.key} onChange={(v) => updateField('key', v)} error={errors.key} required uppercase />
          </div>
          <Input label="Description" value={form.description} onChange={(v) => updateField('description', v)} textarea rows={3} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Owner" value={form.ownerId} onChange={(v) => updateField('ownerId', v)} options={ownerOptions} error={errors.ownerId} required />
            <Select label="Department" value={form.departmentId} onChange={(v) => updateField('departmentId', v)} options={departmentOptions} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Status" value={form.status} onChange={(v) => updateField('status', v)} options={STATUS_OPTIONS.filter((o) => o.value !== 'ALL')} />
            <Select label="Priority" value={form.priority} onChange={(v) => updateField('priority', v)} options={PRIORITY_OPTIONS.filter((o) => o.value !== 'ALL')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={form.startDate} onChange={(v) => updateField('startDate', v)} />
            <Input label="Due Date" type="date" value={form.dueDate} onChange={(v) => updateField('dueDate', v)} error={errors.dueDate} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
      />
    </div>
  );
}
