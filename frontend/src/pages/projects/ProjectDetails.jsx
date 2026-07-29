import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderKanban, List, Users, Calendar, TrendingUp, Plus, MoreHorizontal, Edit, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { projectService } from '../../services/projectService';
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
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const { data: project, loading, error, refetch } = useFetch(() => projectService.getProjectById(id), [id]);
  const { data: stats } = useFetch(() => projectService.getProjectStatistics(id), [id]);
  const { data: empResponse } = useFetch(() => employeeService.getEmployees({ limit: 1000 }), []);
  const employees = empResponse?.data || [];
  const employeeOptions = employees.map((e) => ({ value: e.id, label: fullName(e) }));

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectService.deleteProject(id);
      toast.success('Project deleted successfully');
      navigate('/projects');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddMember() {
    if (!selectedEmployeeId) return;
    setAddingMember(true);
    try {
      await projectService.addProjectMember(id, selectedEmployeeId);
      toast.success('Member added successfully');
      setMemberModalOpen(false);
      setSelectedEmployeeId('');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(employeeId) {
    try {
      await projectService.removeProjectMember(id, employeeId);
      toast.success('Member removed successfully');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    }
  }

  if (loading) return <CardSkeleton count={1} />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!project) return <EmptyState title="Project not found" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        subtitle={`${project.key} • ${project.description || 'No description'}`}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
        actions={
          <div className="flex gap-2">
            <Link to={`/projects/${id}/board`}>
              <Button variant="outline" icon={<FolderKanban />}>
                Kanban
              </Button>
            </Link>
            <Link to={`/projects/${id}/tasks`}>
              <Button variant="outline" icon={<List />}>
                Tasks
              </Button>
            </Link>
            <Dropdown
              trigger={() => (
                <Button variant="ghost" icon={<MoreHorizontal />}>
                  More
                </Button>
              )}
            >
              <DropdownItem onClick={() => navigate(`/projects/${id}/edit`)} icon={Edit}>
                Edit Project
              </DropdownItem>
              <DropdownItem onClick={() => setMemberModalOpen(true)} icon={UserPlus}>
                Add Member
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onClick={() => setDeleteTarget(project)} icon={Trash2} className="text-red-600">
                Delete Project
              </DropdownItem>
            </Dropdown>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Project Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <div className="mt-1"><StatusBadge status={project.status} /></div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Priority</label>
                <div className="mt-1"><PriorityBadge priority={project.priority} /></div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Owner</label>
                <div className="mt-1 flex items-center gap-2">
                  <Avatar src={project.owner?.avatar} name={fullName(project.owner)} size="sm" />
                  <span className="text-sm">{fullName(project.owner)}</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Department</label>
                <div className="mt-1 text-sm">{project.department?.name || 'None'}</div>
              </div>
              {project.startDate && (
                <div>
                  <label className="text-sm text-gray-500">Start Date</label>
                  <div className="mt-1 text-sm">{new Date(project.startDate).toLocaleDateString()}</div>
                </div>
              )}
              {project.dueDate && (
                <div>
                  <label className="text-sm text-gray-500">Due Date</label>
                  <div className="mt-1 text-sm">{new Date(project.dueDate).toLocaleDateString()}</div>
                </div>
              )}
            </div>
          </div>

          {stats && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Task Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{stats.totalTasks}</div>
                  <div className="text-sm text-gray-500">Total Tasks</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                  <div className="text-sm text-gray-500">Completed</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
                  <div className="text-sm text-gray-500">In Progress</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                  <div className="text-sm text-gray-500">Overdue</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Progress</h3>
              <span className="text-2xl font-bold text-blue-600">{project.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Team</h3>
              <Button variant="ghost" size="sm" icon={<UserPlus />} onClick={() => setMemberModalOpen(true)}>
                Add
              </Button>
            </div>
            <div className="space-y-3">
              {project.members?.length > 0 ? (
                project.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar src={member.avatar} name={fullName(member)} size="sm" />
                      <span className="text-sm">{fullName(member)}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No members yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={memberModalOpen} onClose={() => setMemberModalOpen(false)} title="Add Team Member" size="sm">
        <div className="space-y-4">
          <Select
            label="Select Employee"
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
            options={employeeOptions}
            placeholder="Choose an employee"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setMemberModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMember} loading={addingMember}>Add Member</Button>
          </div>
        </div>
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
