import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { BarChart3, TrendingUp, Award, AlertTriangle, Users, Building2 } from 'lucide-react';
import { performanceAnalyticsService } from '../../services/performanceAnalyticsService';

export default function PerformanceAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [atRiskEmployees, setAtRiskEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const canViewAnalytics = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    if (canViewAnalytics) {
      loadAnalytics();
    }
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [overviewData, departmentsData, topPerformersData, atRiskData] = await Promise.all([
        performanceAnalyticsService.getOverviewAnalytics(),
        performanceAnalyticsService.getDepartmentAnalytics(),
        performanceAnalyticsService.getTopPerformers(),
        performanceAnalyticsService.getAtRiskEmployees()
      ]);

      setOverview(overviewData.data.data);
      setDepartments(departmentsData.data.data || []);
      setTopPerformers(topPerformersData.data.data || []);
      setAtRiskEmployees(atRiskData.data.data || []);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (!canViewAnalytics) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-500">You don't have permission to view analytics</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Analytics"
        description="Organization-wide performance insights"
      />

      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Average Score"
            value={overview.averageScore}
            icon={Award}
            color="brand"
            suffix="/100"
          />
          <MetricCard
            title="Goal Completion"
            value={overview.goalCompletionRate}
            icon={TrendingUp}
            color="success"
            suffix="%"
          />
          <MetricCard
            title="Review Completion"
            value={overview.reviewCompletionRate}
            icon={Users}
            color="info"
            suffix="%"
          />
          <MetricCard
            title="At Risk"
            value={overview.atRiskEmployeesCount}
            icon={AlertTriangle}
            color="danger"
          />
        </div>
      )}

      {departments.length > 0 && (
        <div className="bg-surface rounded-lg border border-line p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">Department Performance</h3>
          <div className="space-y-4">
            {departments.map((dept) => (
              <DepartmentRow key={dept.department} dept={dept} />
            ))}
          </div>
        </div>
      )}

      {topPerformers.length > 0 && (
        <div className="bg-surface rounded-lg border border-line p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">Top Performers</h3>
          <div className="space-y-3">
            {topPerformers.map((performer, index) => (
              <PerformerRow key={performer.employeeId} performer={performer} rank={index + 1} />
            ))}
          </div>
        </div>
      )}

      {atRiskEmployees.length > 0 && (
        <div className="bg-surface rounded-lg border border-line p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">At Risk Employees</h3>
          <div className="space-y-3">
            {atRiskEmployees.map((employee) => (
              <AtRiskRow key={employee.employeeId} employee={employee} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color, suffix = '' }) {
  const colorClasses = {
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-success-50 text-success-700',
    info: 'bg-info-50 text-info-700',
    danger: 'bg-danger-50 text-danger-700',
  };

  return (
    <div className="bg-surface rounded-lg border border-line p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-ink-900">
            {value}{suffix}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

function DepartmentRow({ dept }) {
  return (
    <div className="flex items-center justify-between p-4 bg-canvas rounded-lg">
      <div className="flex items-center gap-3">
        <Building2 size={20} className="text-ink-500" />
        <div>
          <p className="font-medium text-ink-900">{dept.department}</p>
          <p className="text-sm text-ink-500">{dept.employeeCount} employees</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-sm text-ink-500">Goal Completion</p>
          <p className="font-medium text-ink-900">{dept.goalCompletionRate}%</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-ink-500">Avg Score</p>
          <p className="font-medium text-ink-900">{dept.averageScore}</p>
        </div>
      </div>
    </div>
  );
}

function PerformerRow({ performer, rank }) {
  return (
    <div className="flex items-center justify-between p-4 bg-canvas rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
          rank === 1 ? 'bg-warning-400 text-white' : 'bg-ink-200 text-ink-700'
        }`}>
          {rank}
        </div>
        <div>
          <p className="font-medium text-ink-900">{performer.employeeName}</p>
          <p className="text-sm text-ink-500">{performer.department}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-sm text-ink-500">Score</p>
          <p className="font-medium text-ink-900">{performer.overallScore}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-ink-500">Rating</p>
          <p className="font-medium text-ink-900">{performer.overallRating}/5</p>
        </div>
      </div>
    </div>
  );
}

function AtRiskRow({ employee }) {
  return (
    <div className="flex items-center justify-between p-4 bg-canvas rounded-lg border border-danger-200">
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} className="text-danger-600" />
        <div>
          <p className="font-medium text-ink-900">{employee.employeeName}</p>
          <p className="text-sm text-ink-500">{employee.department}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-sm text-ink-500">At Risk Goals</p>
          <p className="font-medium text-danger-600">{employee.atRiskGoals}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-ink-500">At Risk KPIs</p>
          <p className="font-medium text-danger-600">{employee.atRiskKPIs}</p>
        </div>
      </div>
    </div>
  );
}
