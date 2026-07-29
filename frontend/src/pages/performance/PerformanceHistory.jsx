import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/Badge';
import { TrendingUp, Calendar, Award, BarChart3 } from 'lucide-react';
import { performanceAnalyticsService } from '../../services/performanceAnalyticsService';

export default function PerformanceHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPerformanceHistory();
  }, []);

  const loadPerformanceHistory = async () => {
    if (!user?.employeeId) return;
    
    try {
      setLoading(true);
      const response = await performanceAnalyticsService.getPerformanceTrends(user.employeeId);
      setTrends(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load performance history');
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
        title="Performance History"
        description="View your performance trends over time"
      />

      {trends.length > 0 ? (
        <div className="space-y-4">
          {trends.map((trend, index) => (
            <HistoryCard key={trend.cycleId} trend={trend} index={index} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-ink-500">No performance history found</p>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ trend, index }) {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRatingLabel = (score) => {
    if (score >= 90) return 'Outstanding';
    if (score >= 80) return 'Exceeds Expectations';
    if (score >= 70) return 'Meets Expectations';
    if (score >= 60) return 'Needs Improvement';
    return 'Needs Significant Improvement';
  };

  const getRatingColor = (score) => {
    if (score >= 90) return 'text-success-600';
    if (score >= 80) return 'text-brand-600';
    if (score >= 70) return 'text-info-600';
    if (score >= 60) return 'text-warning-600';
    return 'text-danger-600';
  };

  return (
    <div className="bg-surface rounded-lg border border-line p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink-900">{trend.cycleName}</h3>
          <p className="text-sm text-ink-500 mt-1">
            {formatDate(trend.cycleStartDate)} - {formatDate(trend.cycleEndDate)}
          </p>
        </div>
        {trend.completedAt && (
          <div className="text-sm text-ink-500">
            {formatDate(trend.completedAt)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-canvas rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award size={18} className="text-brand-600" />
            <span className="text-sm text-ink-600">Overall Score</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">{trend.overallScore}</p>
          <p className={`text-sm font-medium ${getRatingColor(trend.overallScore)}`}>
            {getRatingLabel(trend.overallScore)}
          </p>
        </div>

        <div className="bg-canvas rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={18} className="text-brand-600" />
            <span className="text-sm text-ink-600">Rating</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">{trend.overallRating}/5</p>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                className={`w-4 h-4 rounded-sm ${
                  star <= trend.overallRating ? 'bg-warning-400' : 'bg-ink-200'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-canvas rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-brand-600" />
            <span className="text-sm text-ink-600">Trend</span>
          </div>
          {index > 0 ? (
            <p className={`text-lg font-bold ${
              trend.overallScore >= trends[index - 1].overallScore
                ? 'text-success-600'
                : 'text-danger-600'
            }`}>
              {trend.overallScore >= trends[index - 1].overallScore ? '+' : ''}
              {trend.overallScore - trends[index - 1].overallScore}
            </p>
          ) : (
            <p className="text-lg font-bold text-ink-500">Baseline</p>
          )}
        </div>
      </div>
    </div>
  );
}
