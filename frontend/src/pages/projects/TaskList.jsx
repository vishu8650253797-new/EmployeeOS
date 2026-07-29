import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, List, Filter, MoreHorizontal, Eye, Pencil, Trash2, Calendar, User } from 'lucide-react';
import { taskService } from '../../services/taskService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
];

const PRIORITY_OPTIONS = [
  { value: 'ALL', label: 'All Priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function TaskList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const { data, loading, error, refetch } = useFetch(
    () => taskService.getTasks({ projectId: id, search, status: statusFilter === 'ALL' ? undefined : statusFilter, priority: priorityFilter === 'ALL' ? undefined : priorityFilter }),
    [id, search, statusFilter, priorityFilter]
  );
  const tasks = data?.data || [];

  if (loading) return <CardSkeleton count={6} />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="View and manage all tasks in this project"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: 'Tasks' },
        ]}
        actions={
          <div className="flex gap-2">
            <Link to={`/projects/${id}/board`}>
              <Button variant="outline" icon={<List />}>
                Kanban View
              </Button>
            </Link>
            <Button icon={<Plus />} onClick={() => navigate(`/projects/${id}/tasks/new`)}>
              New Task
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tasks..." className="flex-1" />
        <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="sm:w-48" />
        <Select value={priorityFilter} onChange={setPriorityFilter} options={PRIORITY_OPTIONS} className="sm:w-48" />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<List className="w-12 h-12" />}
          title="No tasks found"
          description={search ? 'Try adjusting your search or filters' : 'Create your first task to start tracking work'}
          action={search ? null : <Button icon={<Plus />} onClick={() => navigate(`/projects/${id}/tasks/new`)}>Create Task</Button>}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignees</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-1">{task.taskKey}</div>
                        <Link to={`/projects/${id}/tasks/${task.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                          {task.title}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-6 py-4">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-6 py-4">
                    {task.assigneeIds?.length > 0 ? (
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
                    ) : (
                      <span className="text-sm text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {task.dueDate ? (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No due date</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Dropdown
                      trigger={
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreHorizontal className="w-5 h-5 text-gray-500" />
                        </button>
                      }
                    >
                      <DropdownItem onClick={() => navigate(`/projects/${id}/tasks/${task.id}`)} icon={<Eye />}>
                        View Details
                      </DropdownItem>
                      <DropdownItem onClick={() => navigate(`/projects/${id}/tasks/${task.id}/edit`)} icon={<Pencil />}>
                        Edit Task
                      </DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem onClick={() => {}} icon={<Trash2 />} className="text-red-600">
                        Delete
                      </DropdownItem>
                    </Dropdown>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
