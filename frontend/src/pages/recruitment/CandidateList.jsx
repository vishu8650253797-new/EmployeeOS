import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { candidateService } from '../../services/candidateService';
import { departmentService } from '../../services/departmentService';
import PageHeader from '../../components/layout/PageHeader';
import { Users, Plus, Search, Filter, Download } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import StatusBadge, { STATUS_TONES } from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const STATUS_OPTIONS = ['NEW', 'SCREENING', 'INTERVIEWING', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'];
const SOURCE_TYPES = ['CAREER_PAGE', 'REFERRAL', 'LINKEDIN', 'INDEED', 'OTHER'];

export default function CandidateList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', source: '', department: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [candidatesRes, deptsRes] = await Promise.all([
        candidateService.getCandidates(filters),
        departmentService.getDepartments(),
      ]);
      setCandidates(candidatesRes.data || []);
      setDepartments(deptsRes || []);
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

  const handleDownloadResume = async (candidateId) => {
    try {
      const url = await candidateService.downloadResume(candidateId);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingState label="Loading candidates..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title="Candidates"
        subtitle="Manage your candidate pool"
        actions={
          <Button onClick={() => navigate('/recruitment/candidates/new')} icon={<Plus size={16} />}>
            Add Candidate
          </Button>
        }
      />

      <div className="mb-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Input
              placeholder="Search candidates..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
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
            placeholder="Source"
            value={filters.source}
            onChange={(v) => handleFilterChange('source', v)}
            options={['', ...SOURCE_TYPES]}
          />
          <Select
            placeholder="Department"
            value={filters.department}
            onChange={(v) => handleFilterChange('department', v)}
            options={['', ...departments.map((d) => ({ value: d.id, label: d.name }))]}
          />
        </div>
      </div>

      {candidates.length === 0 ? (
        <EmptyState title="No candidates found" message="Add candidates to start tracking" actionLabel="Add Candidate" onAction={() => navigate('/recruitment/candidates/new')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Current Role</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Source</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-ink-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="border-t border-line hover:bg-canvas">
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/recruitment/candidates/${candidate.id}`)} className="font-medium text-brand-600 hover:text-brand-700">
                      {candidate.firstName} {candidate.lastName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{candidate.email}</td>
                  <td className="px-4 py-3 text-ink-700">{candidate.phone || '-'}</td>
                  <td className="px-4 py-3 text-ink-700">{candidate.currentRole || '-'}</td>
                  <td className="px-4 py-3 text-ink-700">{candidate.source}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={candidate.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {candidate.resumeFileId && (
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadResume(candidate.id)} icon={<Download size={14} />}>
                          Resume
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/recruitment/candidates/${candidate.id}`)}>
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
