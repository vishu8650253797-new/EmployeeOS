import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { publicJobService } from '../../services/publicJobService';
import { CheckCircle, XCircle, DollarSign, Calendar, Briefcase, ArrowLeft } from 'lucide-react';
import { LoadingState, ErrorState } from '../../components/ui/States';
import Button from '../../components/ui/Button';

export default function OfferResponsePage() {
  const navigate = useNavigate();
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [offer, setOffer] = useState(null);
  const [response, setResponse] = useState(null);

  useEffect(() => {
    loadOffer();
  }, [token]);

  const loadOffer = async () => {
    try {
      setLoading(true);
      setError(null);
      const offerRes = await publicJobService.getOffer(token);
      setOffer(offerRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (decision) => {
    try {
      setSubmitting(true);
      setError(null);
      if (decision === 'ACCEPTED') {
        await publicJobService.acceptOffer(token);
      } else {
        await publicJobService.rejectOffer(token);
      }
      setResponse({ ...response, submitted: true, decision });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading offer..." />;
  if (error) return <ErrorState message={error} onRetry={loadOffer} />;
  if (!offer) return <div className="p-8 text-center text-ink-500">Offer not found or expired</div>;

  if (response?.submitted) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-xl border border-line bg-surface p-8 text-center">
            <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${response.decision === 'ACCEPTED' ? 'bg-success-50' : 'bg-danger-50'}`}>
              {response.decision === 'ACCEPTED' ? (
                <CheckCircle size={40} className="text-success-600" />
              ) : (
                <XCircle size={40} className="text-danger-600" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-ink-900">
              {response.decision === 'ACCEPTED' ? 'Offer Accepted!' : 'Offer Declined'}
            </h1>
            <p className="mt-4 text-lg text-ink-600">
              {response.decision === 'ACCEPTED'
                ? 'Congratulations! We will be in touch with next steps regarding your onboarding.'
                : 'Thank you for your response. We appreciate your time and consideration.'}
            </p>
            <div className="mt-8 flex justify-center">
              <Button onClick={() => navigate('/')}>Go to Homepage</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Button variant="ghost" onClick={() => navigate('/')} icon={<ArrowLeft size={16} />} className="mb-6">
          Back to Home
        </Button>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-ink-900">Job Offer</h1>
          <p className="mt-2 text-ink-600">Please review the offer details and respond</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-ink-900">{offer.jobId?.title}</h2>
            <p className="mt-1 text-ink-600">{offer.jobId?.departmentId?.name}</p>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <DollarSign size={16} className="text-ink-400" />
              <span>
                {offer.currency} {offer.salary}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <Calendar size={16} className="text-ink-400" />
              <span>Start: {offer.startDate ? new Date(offer.startDate).toLocaleDateString() : 'TBD'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <Briefcase size={16} className="text-ink-400" />
              <span>{offer.employmentType}</span>
            </div>
            {offer.expiryDate && (
              <div className="flex items-center gap-2 text-sm text-ink-600">
                <span className="text-ink-500">Expires:</span>
                <span>{new Date(offer.expiryDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {offer.benefits && offer.benefits.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-ink-900">Benefits</h3>
              <ul className="list-inside list-disc space-y-2 text-ink-700">
                {offer.benefits.map((benefit, idx) => (
                  <li key={idx}>{benefit}</li>
                ))}
              </ul>
            </div>
          )}

          {offer.notes && (
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-ink-900">Additional Notes</h3>
              <p className="text-ink-700 whitespace-pre-line">{offer.notes}</p>
            </div>
          )}

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-ink-900">Comments (Optional)</label>
            <textarea
              rows={3}
              value={response?.comments || ''}
              onChange={(e) => setResponse({ ...response, comments: e.target.value })}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900"
              placeholder="Add any comments or questions..."
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="danger"
              onClick={() => handleRespond('REJECTED')}
              loading={submitting}
              icon={<XCircle size={16} />}
              className="w-full sm:w-auto"
            >
              Decline Offer
            </Button>
            <Button
              onClick={() => handleRespond('ACCEPTED')}
              loading={submitting}
              icon={<CheckCircle size={16} />}
              className="w-full sm:w-auto"
            >
              Accept Offer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
