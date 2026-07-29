import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, MoreHorizontal, GripVertical, Calendar, Clock, User } from 'lucide-react';
import { taskService } from '../../services/taskService';
import { employeeService } from '../../services/employeeService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

const COLUMNS = [
  { id: 'TODO', label: 'To Do', color: 'bg-gray-100' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-100' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-100' },
  { id: 'BLOCKED', label: 'Blocked', color: 'bg-red-100' },
  { id: 'DONE', label: 'Done', color: 'bg-green-100' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const INITIAL_FORM = { title: '', description: '', priority: 'MEDIUM', assigneeIds: [], dueDate: '' };

export default function KanbanBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [draggedTask, setDraggedTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: tasksResponse, loading, error, refetch } = useFetch(
    () => taskService.getTasks({ projectId: id }),
    [id]
  );
  const tasks = tasksResponse?.data || [];

  const { data: empResponse } = useFetch(() => employeeService.getEmployees({ limit: 1000 }), []);
  const employees = empResponse?.data || [];
  const assigneeOptions = employees.map((e) => ({ value: e.id, label: fullName(e) }));

  function getTasksByStatus(status) {
    return tasks.filter((t) => t.status === status);
  }

  function handleDragStart(e, task) {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e, newStatus) {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === newStatus) return;
    try {
      await taskService.updateTaskStatus(draggedTask.id, newStatus);
      toast.success('Task status updated');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    } finally {
      setDraggedTask(null);
    }
  }

  function openCreate() {
    setForm(INITIAL_FORM);
    setErrors({});
    setModalOpen(true);
  }

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }, []);

  function validate() {
    const next = {};
    if (!form.title.trim()) next.title = 'Task title is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await taskService.createTask({ ...form, projectId: id });
      toast.success('Task created successfully');
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <CardSkeleton count={5} />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kanban Board"
        subtitle="Drag and drop tasks to update their status"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: 'Board' },
        ]}
        actions={
          <Button onClick={openCreate} icon={<Plus />}>
            New Task
          </Button>
        }
      />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className={`${column.color} rounded-t-lg px-4 py-3 flex items-center justify-between`}>
              <h3 className="font-semibold text-gray-900">{column.label}</h3>
              <span className="text-sm text-gray-600 bg-white px-2 py-0.5 rounded-full">
                {getTasksByStatus(column.id).length}
              </span>
            </div>
            <div className="bg-gray-50 rounded-b-lg p-3 min-h-[400px] space-y-3">
              {getTasksByStatus(column.id).map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md cursor-move transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-mono text-gray-500">{task.taskKey}</span>
                    </div>
                    <Dropdown
                      trigger={() => (
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreHorizontal className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                    >
                      <DropdownItem onClick={() => navigate(`/projects/${id}/tasks/${task.id}`)} icon={User}>
                        View Details
                      </DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem onClick={() => navigate(`/projects/${id}/tasks/${task.id}/edit`)} icon={Plus}>
                        Edit Task
                      </DropdownItem>
                    </Dropdown>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">{task.title}</h4>
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <PriorityBadge priority={task.priority} />
                    {task.assigneeIds?.length > 0 && (
                      <div className="flex -space-x-2">
                        {task.assigneeIds.slice(0, 3).map((assignee) => (
                          <Avatar
                            key={assignee.id}
                            src={assignee.avatar}
                            name={fullName(assignee)}
                            size="xs"
                            className="border-2 border-white"
                          />
                        ))}
                        {task.assigneeIds.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs text-gray-600">
                            +{task.assigneeIds.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {task.dueDate && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ))}
              {getTasksByStatus(column.id).length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">No tasks</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Task" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Task Title" value={form.title} onChange={(v) => updateField('title', v)} error={errors.title} required />
          <Input label="Description" value={form.description} onChange={(v) => updateField('description', v)} textarea rows={3} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Priority" value={form.priority} onChange={(v) => updateField('priority', v)} options={PRIORITY_OPTIONS} />
            <Input label="Due Date" type="date" value={form.dueDate} onChange={(v) => updateField('dueDate', v)} />
          </div>
          <Select
            label="Assignees"
            value={form.assigneeIds}
            onChange={(v) => updateField('assigneeIds', v)}
            options={assigneeOptions}
            multiple
            placeholder="Select assignees"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Task</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
