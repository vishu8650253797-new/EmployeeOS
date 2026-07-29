import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Calendar, Clock, User, Tag, MessageSquare, History, Plus } from 'lucide-react';
import { taskService } from '../../services/taskService';
import { taskCommentService } from '../../services/taskCommentService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import TaskComments from '../../components/tasks/TaskComments';
import ActivityTimeline from '../../components/tasks/ActivityTimeline';

const STATUS_OPTIONS = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function TaskDetails() {
  const { id, taskId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState([]);

  const { data: task, loading, error, refetch } = useFetch(() => taskService.getTaskById(taskId), [taskId]);
  const { data: empResponse } = useFetch(() => fetch('/api/employees?limit=1000').then(r => r.json()), []);
  const employees = empResponse?.data || [];
  const assigneeOptions = employees.map((e) => ({ value: e.id, label: fullName(e) }));

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await taskService.deleteTask(taskId);
      toast.success('Task deleted successfully');
      navigate(`/projects/${id}/tasks`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete task');
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange() {
    if (!selectedStatus) return;
    try {
      await taskService.updateTaskStatus(taskId, selectedStatus);
      toast.success('Task status updated');
      setStatusModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  }

  async function handleAssign() {
    try {
      await taskService.assignTask(taskId, selectedAssignees);
      toast.success('Task assigned successfully');
      setAssignModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign task');
    }
  }

  if (loading) return <CardSkeleton count={1} />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!task) return <EmptyState title="Task not found" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={task.title}
        subtitle={`${task.taskKey} • ${task.project?.name || 'Project'}`}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: task.project?.name || 'Project', href: `/projects/${id}` },
          { label: 'Tasks', href: `/projects/${id}/tasks` },
          { label: task.taskKey },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" icon={<Edit />} onClick={() => navigate(`/projects/${id}/tasks/${taskId}/edit`)}>
              Edit
            </Button>
            <Button variant="ghost" icon={<Trash2 />} onClick={() => setDeleteTarget(task)} className="text-red-600">
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Task Details</h3>
            {task.description && (
              <div className="mb-6">
                <label className="text-sm text-gray-500 block mb-2">Description</label>
                <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={task.status} />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Priority</label>
                <div className="mt-1">
                  <PriorityBadge priority={task.priority} />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Reporter</label>
                <div className="mt-1 flex items-center gap-2">
                  <Avatar src={task.reporter?.avatar} name={fullName(task.reporter)} size="sm" />
                  <span className="text-sm">{fullName(task.reporter)}</span>
                </div>
              </div>
              {task.parentTaskId && (
                <div>
                  <label className="text-sm text-gray-500">Parent Task</label>
                  <div className="mt-1 text-sm">{task.parentTask?.taskKey}</div>
                </div>
              )}
              {task.startDate && (
                <div>
                  <label className="text-sm text-gray-500">Start Date</label>
                  <div className="mt-1 text-sm flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(task.startDate).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
              {task.dueDate && (
                <div>
                  <label className="text-sm text-gray-500">Due Date</label>
                  <div className="mt-1 text-sm flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
              {task.estimatedHours && (
                <div>
                  <label className="text-sm text-gray-500">Estimated Hours</label>
                  <div className="mt-1 text-sm flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{task.estimatedHours}h</span>
                  </div>
                </div>
              )}
              {task.actualHours && (
                <div>
                  <label className="text-sm text-gray-500">Actual Hours</label>
                  <div className="mt-1 text-sm flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{task.actualHours}h</span>
                  </div>
                </div>
              )}
            </div>
            {task.labels?.length > 0 && (
              <div className="mt-4">
                <label className="text-sm text-gray-500 block mb-2">Labels</label>
                <div className="flex flex-wrap gap-2">
                  {task.labels.map((label) => (
                    <span key={label} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      <Tag className="w-3 h-3" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <TaskComments taskId={taskId} />
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Assignees</h3>
              <Button variant="ghost" size="sm" icon={<User />} onClick={() => setAssignModalOpen(true)}>
                Assign
              </Button>
            </div>
            {task.assigneeIds?.length > 0 ? (
              <div className="space-y-3">
                {task.assigneeIds.map((assignee) => (
                  <div key={assignee.id} className="flex items-center gap-2">
                    <Avatar src={assignee.avatar} name={fullName(assignee)} size="sm" />
                    <span className="text-sm">{fullName(assignee)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No assignees</p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Status</h3>
              <Button variant="ghost" size="sm" icon={<Edit />} onClick={() => { setSelectedStatus(task.status); setStatusModalOpen(true); }}>
                Change
              </Button>
            </div>
            <StatusBadge status={task.status} size="lg" />
          </div>

          <ActivityTimeline taskId={taskId} />
        </div>
      </div>

      <Modal open={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="Change Status" size="sm">
        <div className="space-y-4">
          <Select
            label="New Status"
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={STATUS_OPTIONS}
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusChange}>Update Status</Button>
          </div>
        </div>
      </Modal>

      <Modal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Task" size="md">
        <div className="space-y-4">
          <Select
            label="Assignees"
            value={selectedAssignees}
            onChange={setSelectedAssignees}
            options={assigneeOptions}
            multiple
            placeholder="Select assignees"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign}>Assign</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
      />
    </div>
  );
}
