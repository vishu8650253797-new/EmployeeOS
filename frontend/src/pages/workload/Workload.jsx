import { useState } from 'react';
import { Users, Clock, AlertCircle, TrendingUp, Filter } from 'lucide-react';
import { workloadService } from '../../services/workloadService';
import { departmentService } from '../../services/departmentService';
import { useFetch } from '../../hooks/useFetch';
import { fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Avatar from '../../components/ui/Avatar';
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

export default function Workload() {
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data: workloadData, loading, error, refetch } = useFetch(
    () => workloadService.getWorkload({ department: departmentFilter || undefined, status: statusFilter === 'ALL' ? undefined : statusFilter }),
    [departmentFilter, statusFilter]
  );
  
  const { data: deptResponse } = useFetch(() => departmentService.getDepartments({ limit: 1000 }), []);
  
  if (loading) return <CardSkeleton count={6} />;
  
  // Initialize workload as empty array by default
  let workload = [];
  
  // Extract data safely with multiple fallback paths
  if (workloadData) {
    if (Array.isArray(workloadData?.data?.data)) {
      workload = workloadData.data.data;
    } else if (Array.isArray(workloadData?.data)) {
      workload = workloadData.data;
    } else if (Array.isArray(workloadData)) {
      workload = workloadData;
    }
  }

  const departments = Array.isArray(deptResponse?.data) ? deptResponse.data : (Array.isArray(deptResponse) ? deptResponse : []);
  const departmentOptions = [{ value: '', label: 'All Departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))];

  // Safe reduce operations with explicit array check
  const totalActiveTasks = Array.isArray(workload) ? workload.reduce((sum, w) => sum + (w.activeTasks || 0), 0) : 0;
  const totalOverdueTasks = Array.isArray(workload) ? workload.reduce((sum, w) => sum + (w.overdueTasks || 0), 0) : 0;
  const totalEstimatedHours = Array.isArray(workload) ? workload.reduce((sum, w) => sum + (w.estimatedHours || 0), 0) : 0;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workload"
        subtitle="View and manage employee workload across the organization"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{workload.length}</div>
              <div className="text-sm text-gray-500">Team Members</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalActiveTasks}</div>
              <div className="text-sm text-gray-500">Active Tasks</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalOverdueTasks}</div>
              <div className="text-sm text-gray-500">Overdue Tasks</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalEstimatedHours}h</div>
              <div className="text-sm text-gray-500">Estimated Hours</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={departmentFilter} onChange={setDepartmentFilter} options={departmentOptions} className="w-64" />
        <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="w-48" />
      </div>

      {workload.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No workload data"
          message="No employees found matching the current filters"
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Active</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Overdue</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Completed</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Est. Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {workload.map((item) => (
                <tr key={item.employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={item.employee.avatar} name={fullName(item.employee)} size="sm" />
                      <div>
                        <div className="font-medium text-gray-900">{fullName(item.employee)}</div>
                        <div className="text-xs text-gray-500">{item.employee.employeeId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.employee.department || 'None'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                      {item.activeTasks}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.overdueTasks > 0 ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-full text-sm font-medium">
                        {item.overdueTasks}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 rounded-full text-sm font-medium">
                      {item.completedTasks}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600">{item.estimatedHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
