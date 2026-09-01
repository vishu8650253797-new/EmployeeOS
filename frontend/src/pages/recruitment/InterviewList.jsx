import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { interviewService } from '../../services/interviewService';
import { candidateService } from '../../services/candidateService';
import { recruitmentJobService } from '../../services/recruitmentJobService';
import PageHeader from '../../components/layout/PageHeader';
import { Calendar, Plus, Search, Filter, Clock, CheckCircle, XCircle } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import StatusBadge, { STATUS_TONES } from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const STATUS_OPTIONS = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
const INTERVIEW_TYPES = ['PHONE', 'VIDEO', 'ONSITE', 'TECHNICAL', 'PANEL', 'GROUP'];

export default function InterviewList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', type: '', candidateId: '', jobId: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [interviewsRes, candidatesRes, jobsRes] = await Promise.all([
        interviewService.getInterviews(filters),
        candidateService.getCandidates({}),
        recruitmentJobService.getJobs({}),
      ]);
      setInterviews(interviewsRes.data || []);
      setCandidates(candidatesRes.data || []);
      setJobs(jobsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => loadData();

  const handleComplete = async (id) => {
    try {
      await interviewService.completeInterview(id);
      toast.success('Interview marked as completed');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCancel = async (id) => {
    try {
      await interviewService.cancelInterview(id);
      toast.success('Interview cancelled');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingState label="Loading interviews..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title="Interviews"
        subtitle="Manage interview schedules"
        actions={
          <Button onClick={() => navigate('/recruitment/interviews/new')} icon={<Plus size={16} />}>
            Schedule Interview
          </Button>
        }
      />

      <div className="mb-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Input
              placeholder="Search interviews..."
              value={filters.search}
              onChange={(v) => handleFilterChange('search', v)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              icon={<Search size={16} />}
            />
          </div>
          <Select
            placeholder="Status"
            value={filters.status}
            onChange={(v) => handleFilterChange('status', v)}
            options={['', ...STATUS_OPTIONS]}
          />
          <Select
            placeholder="Type"
            value={filters.type}
            onChange={(v) => handleFilterChange('type', v)}
            options={['', ...INTERVIEW_TYPES]}
          />
          <Select
            placeholder="Candidate"
            value={filters.candidateId}
            onChange={(v) => handleFilterChange('candidateId', v)}
            options={['', ...candidates.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))]}
          />
        </div>
      </div>

      {interviews.length === 0 ? (
        <EmptyState title="No interviews found" message="Schedule your first interview to get started" actionLabel="Schedule Interview" onAction={() => navigate('/recruitment/interviews/new')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Candidate</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Job</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Date & Time</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Location</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-ink-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {interviews.map((interview) => (
                <tr key={interview.id} className="border-t border-line hover:bg-canvas">
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/recruitment/candidates/${interview.candidateId?.id}`)} className="font-medium text-brand-600 hover:text-brand-700">
                      {interview.candidateId?.firstName} {interview.candidateId?.lastName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{interview.jobId?.title || '-'}</td>
                  <td className="px-4 py-3 text-ink-700">{interview.type}</td>
                  <td className="px-4 py-3 text-ink-700">
                    {new Date(interview.scheduledDate).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{interview.location || '-'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={interview.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {interview.status === 'SCHEDULED' && (
                        <>
                          <Button size="sm" variant="successGhost" onClick={() => handleComplete(interview.id)} icon={<CheckCircle size={14} />}>
                            Complete
                          </Button>
                          <Button size="sm" variant="dangerGhost" onClick={() => handleCancel(interview.id)} icon={<XCircle size={14} />}>
                            Cancel
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/recruitment/interviews/${interview.id}`)}>
                        View
                      </Button>
                    </div>
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
