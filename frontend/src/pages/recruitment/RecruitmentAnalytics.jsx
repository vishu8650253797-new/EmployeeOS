import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { recruitmentAnalyticsService } from '../../services/recruitmentAnalyticsService';
import PageHeader from '../../components/layout/PageHeader';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { TrendingUp, Users, FileText, Clock, Briefcase } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function RecruitmentAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [sources, setSources] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [timeToHire, setTimeToHire] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [overviewRes, funnelRes, sourcesRes, jobsRes, timeToHireRes] = await Promise.all([
        recruitmentAnalyticsService.getOverview(),
        recruitmentAnalyticsService.getFunnel(),
        recruitmentAnalyticsService.getSources(),
        recruitmentAnalyticsService.getJobs(),
        recruitmentAnalyticsService.getTimeToHire(),
      ]);
      setOverview(overviewRes);
      setFunnel(funnelRes);
      setSources(sourcesRes);
      setJobs(jobsRes);
      setTimeToHire(timeToHireRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState label="Loading analytics..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const funnelData = funnel?.stages?.map((stage) => ({
    name: stage.stage,
    count: stage.count,
    percentage: stage.percentage,
  })) || [];

  const sourceData = sources?.sources?.map((source) => ({
    name: source.source,
    value: source.count,
    percentage: source.percentage,
  })) || [];

  const jobsData = jobs?.jobs?.map((job) => ({
    name: job.title,
    applications: job.applicationCount,
    interviews: job.interviewCount,
    offers: job.offerCount,
    hires: job.hireCount,
  })) || [];

  const timeToHireData = timeToHire?.byStage?.map((stage) => ({
    name: stage.stage,
    days: stage.avgDays,
  })) || [];

  return (
    <div>
      <PageHeader
        title="Recruitment Analytics"
        subtitle="Track your hiring metrics and performance"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Briefcase size={20} />
            </div>
            <div>
              <p className="text-[13px] text-ink-500">Open Positions</p>
              <p className="text-xl font-semibold text-ink-900">{overview?.openPositions || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-50 text-info-600">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[13px] text-ink-500">Total Candidates</p>
              <p className="text-xl font-semibold text-ink-900">{overview?.totalCandidates || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50 text-success-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[13px] text-ink-500">Hires This Month</p>
              <p className="text-xl font-semibold text-ink-900">{overview?.hiresThisMonth || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-50 text-warning-600">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[13px] text-ink-500">Avg Time to Hire</p>
              <p className="text-xl font-semibold text-ink-900">{overview?.avgTimeToHireDays ? `${overview.avgTimeToHireDays}d` : 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Hiring Funnel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="Candidates" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Candidate Sources</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {sourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Job Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={jobsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="applications" fill="#3b82f6" name="Applications" />
              <Bar dataKey="interviews" fill="#10b981" name="Interviews" />
              <Bar dataKey="offers" fill="#f59e0b" name="Offers" />
              <Bar dataKey="hires" fill="#ef4444" name="Hires" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Time to Hire by Stage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeToHireData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="days" stroke="#3b82f6" name="Days" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
