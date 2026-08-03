import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { candidateService } from '../../services/candidateService';
import { applicationService } from '../../services/applicationService';
import PageHeader from '../../components/layout/PageHeader';
import { Kanban, Plus, Search } from 'lucide-react';
import { LoadingState, ErrorState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import StatusBadge, { STATUS_TONES } from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const PIPELINE_STAGES = [
  { key: 'NEW', label: 'New', color: 'info' },
  { key: 'SCREENING', label: 'Screening', color: 'warning' },
  { key: 'INTERVIEWING', label: 'Interviewing', color: 'brand' },
  { key: 'OFFER', label: 'Offer', color: 'success' },
  { key: 'HIRED', label: 'Hired', color: 'success' },
  { key: 'REJECTED', label: 'Rejected', color: 'danger' },
];

export default function CandidatePipeline() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [candidatesRes, appsRes] = await Promise.all([
        candidateService.getCandidates({}),
        applicationService.getApplications({}),
      ]);
      setCandidates(candidatesRes.data || []);
      setApplications(appsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (candidateId, newStatus) => {
    try {
      await candidateService.updateCandidate(candidateId, { status: newStatus });
      toast.success('Status updated');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      c.firstName?.toLowerCase().includes(searchLower) ||
      c.lastName?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower)
    );
  });

  const getCandidatesByStage = (stage) => {
    return filteredCandidates.filter((c) => c.status === stage);
  };

  if (loading) return <LoadingState label="Loading pipeline..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title="Candidate Pipeline"
        subtitle="Kanban view of your hiring pipeline"
        actions={
          <Button onClick={() => navigate('/recruitment/candidates/new')} icon={<Plus size={16} />}>
            Add Candidate
          </Button>
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search candidates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={16} />}
        />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const stageCandidates = getCandidatesByStage(stage.key);
          return (
            <div key={stage.key} className="flex min-w-[280px] flex-col rounded-xl border border-line bg-surface">
              <div className="border-b border-line p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink-900">{stage.label}</h3>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-600">{stageCandidates.length}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 p-3">
                {stageCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="cursor-pointer rounded-lg border border-line bg-canvas p-3 hover:border-brand-300"
                    onClick={() => navigate(`/recruitment/candidates/${candidate.id}`)}
                  >
                    <p className="text-sm font-medium text-ink-900">
                      {candidate.firstName} {candidate.lastName}
                    </p>
                    <p className="text-xs text-ink-500">{candidate.email}</p>
                    {candidate.currentRole && (
                      <p className="mt-1 text-xs text-ink-600">{candidate.currentRole}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <StatusBadge status={candidate.status} />
                      <select
                        className="text-xs text-ink-600"
                        value={candidate.status}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleStatusChange(candidate.id, e.target.value);
                        }}
                      >
                        {PIPELINE_STAGES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {stageCandidates.length === 0 && (
                  <p className="text-center text-xs text-ink-400">No candidates</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
