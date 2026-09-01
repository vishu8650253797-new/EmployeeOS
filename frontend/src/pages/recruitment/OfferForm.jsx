import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { offerService } from '../../services/offerService';
import { applicationService } from '../../services/applicationService';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { LoadingState, ErrorState } from '../../components/ui/States';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'];
const CLOSED_STATUSES = ['REJECTED', 'WITHDRAWN', 'HIRED'];

export default function OfferForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [applications, setApplications] = useState([]);
  const [offerCandidateName, setOfferCandidateName] = useState('');
  const [offerJobTitle, setOfferJobTitle] = useState('');
  const [formData, setFormData] = useState({
    applicationId: '',
    salary: '',
    currency: 'USD',
    employmentType: 'FULL_TIME',
    startDate: '',
    offerExpiryDate: '',
    benefits: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (isEdit) {
        const offer = await offerService.getOffer(id);
        setOfferCandidateName(offer.candidateId ? `${offer.candidateId.firstName} ${offer.candidateId.lastName}` : '');
        setOfferJobTitle(offer.jobId?.title || '');
        setFormData({
          applicationId: offer.applicationId?._id || offer.applicationId || '',
          salary: offer.salary ?? '',
          currency: offer.currency || 'USD',
          employmentType: offer.employmentType || 'FULL_TIME',
          startDate: offer.startDate ? offer.startDate.split('T')[0] : '',
          offerExpiryDate: offer.offerExpiryDate ? offer.offerExpiryDate.split('T')[0] : '',
          benefits: (offer.benefits || []).join('\n'),
          notes: offer.notes || '',
        });
      } else {
        const candidateId = searchParams.get('candidateId') || '';
        const appsRes = await applicationService.getApplications({
          candidate: candidateId || undefined,
          limit: 200,
        });
        const openApps = (appsRes.data || []).filter((a) => !CLOSED_STATUSES.includes(a.status));
        setApplications(openApps);
        setFormData((f) => ({ ...f, applicationId: openApps.length === 1 ? openApps[0].id : '' }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !formData.applicationId) {
      toast.error('Select an application to make an offer for');
      return;
    }
    if (formData.salary === '' || Number(formData.salary) < 0) {
      toast.error('Enter a valid salary');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        salary: Number(formData.salary),
        benefits: formData.benefits.split('\n').filter(Boolean),
        startDate: formData.startDate || undefined,
        offerExpiryDate: formData.offerExpiryDate || undefined,
      };

      if (isEdit) {
        delete payload.applicationId; // not editable after creation
        await offerService.updateOffer(id, payload);
        toast.success('Offer updated successfully');
      } else {
        await offerService.createOffer(payload);
        toast.success('Offer created successfully');
      }
      navigate('/recruitment/offers');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label={isEdit ? 'Loading offer...' : 'Preparing form...'} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Offer' : 'Create Offer'}
        subtitle={isEdit ? 'Update offer details' : 'Create a new job offer for an application'}
        actions={
          <Button variant="secondary" onClick={() => navigate('/recruitment/offers')}>
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Offer Details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isEdit ? (
              <Input label="Candidate & Job" value={`${offerCandidateName} — ${offerJobTitle}`} disabled className="sm:col-span-2" />
            ) : (
              <Select
                label="Application"
                required
                value={formData.applicationId}
                onChange={(v) => setFormData({ ...formData, applicationId: v })}
                options={applications.map((a) => ({
                  value: a.id,
                  label: `${a.candidateId?.firstName} ${a.candidateId?.lastName} — ${a.jobId?.title}`,
                }))}
                placeholder="Select an application"
                className="sm:col-span-2"
              />
            )}
            <Input
              label="Salary"
              type="number"
              required
              value={formData.salary}
              onChange={(v) => setFormData({ ...formData, salary: v })}
            />
            <Input
              label="Currency"
              value={formData.currency}
              onChange={(v) => setFormData({ ...formData, currency: v })}
            />
            <Select
              label="Employment Type"
              value={formData.employmentType}
              onChange={(v) => setFormData({ ...formData, employmentType: v })}
              options={EMPLOYMENT_TYPES}
            />
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(v) => setFormData({ ...formData, startDate: v })}
            />
            <Input
              label="Offer Expiry Date"
              type="date"
              value={formData.offerExpiryDate}
              onChange={(v) => setFormData({ ...formData, offerExpiryDate: v })}
              hint="Defaults to 14 days from now if left blank"
            />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Additional Details</h3>
          <div className="space-y-4">
            <Input
              label="Benefits (one per line)"
              textarea
              rows={4}
              value={formData.benefits}
              onChange={(v) => setFormData({ ...formData, benefits: v })}
              placeholder="e.g., Health insurance, 401(k), Remote work"
            />
            <Input
              label="Notes"
              textarea
              rows={3}
              value={formData.notes}
              onChange={(v) => setFormData({ ...formData, notes: v })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/recruitment/offers')}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? 'Update Offer' : 'Create Offer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
