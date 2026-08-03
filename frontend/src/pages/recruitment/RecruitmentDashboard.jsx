import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { recruitmentAnalyticsService } from '../../services/recruitmentAnalyticsService';
import { recruitmentJobService } from '../../services/recruitmentJobService';
import { candidateService } from '../../services/candidateService';
import { interviewService } from '../../services/interviewService';
import { offerService } from '../../services/offerService';
import PageHeader from '../../components/layout/PageHeader';
import { Briefcase, Users, FileText, Clock, Send, CheckCircle, TrendingUp } from 'lucide-react';
import { LoadingState, ErrorState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export default function RecruitmentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const overview = await recruitmentAnalyticsService.getOverview();
      setData(overview);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState label="Loading recruitment dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={loadDashboard} />;

  const cards = [
    { label: 'Open Positions', value: data.openPositions, icon: Briefcase, color: 'brand' },
    { label: 'Total Candidates', value: data.totalCandidates, icon: Users, color: 'info' },
    { label: 'New Applications', value: data.newApplications, icon: FileText, color: 'warning' },
    { label: 'In Screening', value: data.inScreening, icon: Clock, color: 'neutral' },
    { label: 'Interviews This Week', value: data.interviewsThisWeek, icon: Clock, color: 'success' },
    { label: 'Offers Sent', value: data.offersSent, icon: Send, color: 'brand' },
    { label: 'Hires This Month', value: data.hiresThisMonth, icon: CheckCircle, color: 'success' },
    { label: 'Avg Time to Hire', value: data.avgTimeToHireDays ? `${data.avgTimeToHireDays}d` : 'N/A', icon: TrendingUp, color: 'info' },
  ];

  return (
    <div>
      <PageHeader
        title="Recruitment Dashboard"
        subtitle="Overview of your hiring pipeline"
        actions={
          <Button onClick={() => navigate('/recruitment/jobs/new')} icon={<Briefcase size={16} />}>
            Post Job
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${card.color}-50 text-${card.color}-600`}>
                <card.icon size={20} />
              </div>
              <div>
                <p className="text-[13px] text-ink-500">{card.label}</p>
                <p className="text-xl font-semibold text-ink-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-ink-900">Quick Actions</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => navigate('/recruitment/jobs')} className="w-full">
              Manage Jobs
            </Button>
            <Button variant="secondary" onClick={() => navigate('/recruitment/candidates')} className="w-full">
              View Candidates
            </Button>
            <Button variant="secondary" onClick={() => navigate('/recruitment/interviews')} className="w-full">
              Schedule Interview
            </Button>
            <Button variant="secondary" onClick={() => navigate('/recruitment/analytics')} className="w-full">
              View Analytics
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-ink-900">Hiring Metrics</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-500">Time to Hire</span>
              <span className="text-sm font-medium text-ink-900">{data.avgTimeToHireDays ? `${data.avgTimeToHireDays} days` : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-500">Hires This Month</span>
              <span className="text-sm font-medium text-ink-900">{data.hiresThisMonth}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-500">Offers Sent</span>
              <span className="text-sm font-medium text-ink-900">{data.offersSent}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
