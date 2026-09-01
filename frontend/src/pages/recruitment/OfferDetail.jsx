import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { offerService } from '../../services/offerService';
import { candidateService } from '../../services/candidateService';
import { recruitmentJobService } from '../../services/recruitmentJobService';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/Badge';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { DollarSign, Calendar, Briefcase, Edit, Send, XCircle, Copy } from 'lucide-react';

const STATUS_OPTIONS = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'];
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'];

export default function OfferDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offer, setOffer] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const offerRes = await offerService.getOffer(id);
      setOffer(offerRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      await offerService.sendOffer(id);
      toast.success('Offer sent successfully');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleWithdraw = async () => {
    try {
      await offerService.withdrawOffer(id);
      toast.success('Offer withdrawn');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const copyOfferLink = () => {
    if (offer.publicToken) {
      const link = `${window.location.origin}/careers/offer/${offer.publicToken}`;
      navigator.clipboard.writeText(link);
      toast.success('Offer link copied to clipboard');
    }
  };

  if (loading) return <LoadingState label="Loading offer..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title="Offer Details"
        subtitle={offer.jobId?.title}
        actions={
          <div className="flex gap-2">
            {offer.status === 'DRAFT' && (
              <Button onClick={handleSend} icon={<Send size={16} />}>
                Send Offer
              </Button>
            )}
            {(offer.status === 'DRAFT' || offer.status === 'SENT') && (
              <Button variant="dangerGhost" onClick={handleWithdraw} icon={<XCircle size={16} />}>
                Withdraw
              </Button>
            )}
            {offer.publicToken && (
              <Button variant="secondary" onClick={copyOfferLink} icon={<Copy size={16} />}>
                Copy Link
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/recruitment/offers/${id}/edit`)} icon={<Edit size={16} />}>
              Edit
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Offer Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign size={16} className="text-ink-400" />
                <span className="text-ink-700">
                  {offer.currency} {offer.salary}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={16} className="text-ink-400" />
                <span className="text-ink-700">Start: {offer.startDate ? new Date(offer.startDate).toLocaleDateString() : 'TBD'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Briefcase size={16} className="text-ink-400" />
                <span className="text-ink-700">{offer.employmentType}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-500">Status:</span>
                <StatusBadge status={offer.status} />
              </div>
            </div>
            {offer.expiryDate && (
              <div className="mt-4 text-sm">
                <span className="text-ink-500">Expires: </span>
                <span className="text-ink-700">{new Date(offer.expiryDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Candidate</h3>
            <button
              onClick={() => navigate(`/recruitment/candidates/${offer.candidateId?.id}`)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {offer.candidateId?.firstName} {offer.candidateId?.lastName}
            </button>
            <p className="mt-1 text-xs text-ink-500">{offer.candidateId?.email}</p>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Job</h3>
            <button
              onClick={() => navigate(`/recruitment/jobs/${offer.jobId?.id}`)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {offer.jobId?.title}
            </button>
            <p className="mt-1 text-xs text-ink-500">{offer.jobId?.departmentId?.name}</p>
          </div>

          {offer.benefits && offer.benefits.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="mb-4 text-sm font-semibold text-ink-900">Benefits</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-ink-700">
                {offer.benefits.map((benefit, idx) => (
                  <li key={idx}>{benefit}</li>
                ))}
              </ul>
            </div>
          )}

          {offer.notes && (
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="mb-4 text-sm font-semibold text-ink-900">Notes</h3>
              <p className="text-sm text-ink-700">{offer.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Status</h3>
            <StatusBadge status={offer.status} />
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate(`/recruitment/candidates/${offer.candidateId?.id}`)}
              >
                View Candidate
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate(`/recruitment/jobs/${offer.jobId?.id}`)}
              >
                View Job
              </Button>
              {offer.status === 'ACCEPTED' && (
                <Button
                  className="w-full"
                  onClick={() => navigate(`/recruitment/candidates/${offer.candidateId?.id}`)}
                >
                  Convert to Employee
                </Button>
              )}
            </div>
          </div>

          {offer.publicToken && (
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="mb-4 text-sm font-semibold text-ink-900">Public Link</h3>
              <p className="mb-2 text-xs text-ink-500">Share this link with the candidate to view and respond to the offer</p>
              <Button variant="secondary" className="w-full" onClick={copyOfferLink} icon={<Copy size={14} />}>
                Copy Offer Link
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
