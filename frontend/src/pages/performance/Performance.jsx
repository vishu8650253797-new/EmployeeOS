import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/Badge';
import { TrendingUp, Target, Award, AlertTriangle, Users, BarChart3 } from 'lucide-react';
import { performanceAnalyticsService } from '../../services/performanceAnalyticsService';
import { performanceReviewService } from '../../services/performanceReviewService';
import { goalService } from '../../services/goalService';
import { kpiService } from '../../services/kpiService';

export default function Performance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeCycle, setActiveCycle] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [myGoals, setMyGoals] = useState([]);
  const [myKPIs, setMyKPIs] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const isHR = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN';
  const isManager = user?.role === 'MANAGER' || isHR;
  const isEmployee = user?.role === 'EMPLOYEE' || isManager;

  useEffect(() => {
    loadPerformanceData();
  }, []);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      
      const [cycleData, analyticsData] = await Promise.all([
        performanceAnalyticsService.getOverviewAnalytics(),
        performanceAnalyticsService.getOverviewAnalytics()
      ]);

      setActiveCycle(cycleData.data);
      setAnalytics(analyticsData.data);

      if (user?.employeeId) {
        const [goalsData, kpisData, reviewsData] = await Promise.all([
          goalService.getMyGoals(),
          kpiService.getEmployeeKPIs(user.employeeId),
          performanceReviewService.getMyReviews()
        ]);

        setMyGoals(goalsData.data || []);
        setMyKPIs(kpisData.data || []);
        setMyReviews(reviewsData.data || []);
      }
    } catch (error) {
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

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
        title="Performance Management"
        description="Track goals, KPIs, and performance reviews"
      />

      {isHR && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Average Score"
            value={analytics.averageScore}
            icon={Award}
            color="brand"
            suffix="/100"
          />
          <MetricCard
            title="Goal Completion"
            value={analytics.goalCompletionRate}
            icon={Target}
            color="success"
            suffix="%"
          />
          <MetricCard
            title="Review Completion"
            value={analytics.reviewCompletionRate}
            icon={Users}
            color="info"
            suffix="%"
          />
          <MetricCard
            title="At Risk"
            value={analytics.atRiskEmployeesCount}
            icon={AlertTriangle}
            color="danger"
          />
        </div>
      )}

      {isManager && !isHR && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Team Goals"
            value={myGoals.length}
            icon={Target}
            color="brand"
          />
          <MetricCard
            title="Active Reviews"
            value={myReviews.filter(r => r.status === 'IN_PROGRESS').length}
            icon={Users}
            color="info"
          />
          <MetricCard
            title="Completed Reviews"
            value={myReviews.filter(r => r.status === 'COMPLETED').length}
            icon={Award}
            color="success"
          />
        </div>
      )}

      {isEmployee && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="My Goals"
            value={myGoals.length}
            icon={Target}
            color="brand"
          />
          <MetricCard
            title="Goal Progress"
            value={myGoals.length > 0 
              ? Math.round(myGoals.reduce((sum, g) => sum + g.progressPercentage, 0) / myGoals.length)
              : 0}
            icon={TrendingUp}
            color="success"
            suffix="%"
          />
          <MetricCard
            title="My KPIs"
            value={myKPIs.length}
            icon={BarChart3}
            color="info"
          />
        </div>
      )}

      {isEmployee && myGoals.length > 0 && (
        <div className="bg-surface rounded-lg border border-line p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">My Goals</h3>
          <div className="space-y-4">
            {myGoals.slice(0, 5).map((goal) => (
              <GoalCard key={goal._id} goal={goal} />
            ))}
          </div>
        </div>
      )}

      {isEmployee && myKPIs.length > 0 && (
        <div className="bg-surface rounded-lg border border-line p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">My KPIs</h3>
          <div className="space-y-4">
            {myKPIs.slice(0, 5).map((kpi) => (
              <KPICard key={kpi._id} kpi={kpi} />
            ))}
          </div>
        </div>
      )}

      {isEmployee && myReviews.length > 0 && (
        <div className="bg-surface rounded-lg border border-line p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">My Reviews</h3>
          <div className="space-y-4">
            {myReviews.slice(0, 5).map((review) => (
              <ReviewCard key={review._id} review={review} />
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

function GoalCard({ goal }) {
  return (
    <div className="flex items-center justify-between p-4 bg-canvas rounded-lg border border-line">
      <div className="flex-1">
        <p className="font-medium text-ink-900">{goal.title}</p>
        <p className="text-sm text-ink-500 mt-1">{goal.category}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-ink-900">{goal.progressPercentage}%</p>
          <div className="w-24 h-2 bg-ink-200 rounded-full mt-1">
            <div
              className="h-2 bg-brand-500 rounded-full"
              style={{ width: `${goal.progressPercentage}%` }}
            />
          </div>
        </div>
        <StatusBadge status={goal.status} />
      </div>
    </div>
  );
}

function KPICard({ kpi }) {
  return (
    <div className="flex items-center justify-between p-4 bg-canvas rounded-lg border border-line">
      <div className="flex-1">
        <p className="font-medium text-ink-900">{kpi.name}</p>
        <p className="text-sm text-ink-500 mt-1">{kpi.category}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-ink-900">{kpi.score}</p>
          <p className="text-xs text-ink-500">/ 100</p>
        </div>
        <StatusBadge status={kpi.status} />
      </div>
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <div className="flex items-center justify-between p-4 bg-canvas rounded-lg border border-line">
      <div className="flex-1">
        <p className="font-medium text-ink-900">{review.reviewType}</p>
        <p className="text-sm text-ink-500 mt-1">
          {review.cycleId?.name || 'Performance Cycle'}
        </p>
      </div>
      <div className="flex items-center gap-4">
        {review.overallScore && (
          <div className="text-right">
            <p className="text-sm font-medium text-ink-900">{review.overallScore}</p>
            <p className="text-xs text-ink-500">/ 100</p>
          </div>
        )}
        <StatusBadge status={review.status} />
      </div>
    </div>
  );
}
