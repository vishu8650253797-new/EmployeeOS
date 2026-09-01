import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { offerService } from '../../services/offerService';
import { candidateService } from '../../services/candidateService';
import { recruitmentJobService } from '../../services/recruitmentJobService';
import PageHeader from '../../components/layout/PageHeader';
import { Send, Plus, Search, Filter, CheckCircle, XCircle } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import StatusBadge, { STATUS_TONES } from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const STATUS_OPTIONS = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'];
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'];

export default function OfferList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offers, setOffers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', candidateId: '', jobId: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [offersRes, candidatesRes, jobsRes] = await Promise.all([
        offerService.getOffers(filters),
        candidateService.getCandidates({}),
        recruitmentJobService.getJobs({}),
      ]);
      setOffers(offersRes.data || []);
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

  const handleSend = async (id) => {
    try {
      await offerService.sendOffer(id);
      toast.success('Offer sent successfully');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleWithdraw = async (id) => {
    try {
      await offerService.withdrawOffer(id);
      toast.success('Offer withdrawn');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingState label="Loading offers..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title="Job Offers"
        subtitle="Manage job offers to candidates"
        actions={
          <Button onClick={() => navigate('/recruitment/offers/new')} icon={<Plus size={16} />}>
            Create Offer
          </Button>
        }
      />

      <div className="mb-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Input
              placeholder="Search offers..."
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
            placeholder="Candidate"
            value={filters.candidateId}
            onChange={(v) => handleFilterChange('candidateId', v)}
            options={['', ...candidates.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))]}
          />
        </div>
      </div>

      {offers.length === 0 ? (
        <EmptyState title="No offers found" message="Create your first job offer to get started" actionLabel="Create Offer" onAction={() => navigate('/recruitment/offers/new')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Candidate</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Job</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Salary</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Start Date</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-ink-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id} className="border-t border-line hover:bg-canvas">
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/recruitment/candidates/${offer.candidateId?.id}`)} className="font-medium text-brand-600 hover:text-brand-700">
                      {offer.candidateId?.firstName} {offer.candidateId?.lastName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{offer.jobId?.title || '-'}</td>
                  <td className="px-4 py-3 text-ink-700">
                    {offer.currency} {offer.salary}
                  </td>
                  <td className="px-4 py-3 text-ink-700">
                    {offer.startDate ? new Date(offer.startDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={offer.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {offer.status === 'DRAFT' && (
                        <Button size="sm" onClick={() => handleSend(offer.id)} icon={<Send size={14} />}>
                          Send
                        </Button>
                      )}
                      {(offer.status === 'DRAFT' || offer.status === 'SENT') && (
                        <Button size="sm" variant="dangerGhost" onClick={() => handleWithdraw(offer.id)} icon={<XCircle size={14} />}>
                          Withdraw
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/recruitment/offers/${offer.id}`)}>
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
