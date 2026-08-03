import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { offerService } from '../../services/offerService';
import { candidateService } from '../../services/candidateService';
import { recruitmentJobService } from '../../services/recruitmentJobService';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { LoadingState, ErrorState } from '../../components/ui/States';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'];
const SALARY_PERIODS = ['YEARLY', 'MONTHLY', 'HOURLY'];

export default function OfferForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [formData, setFormData] = useState({
    candidateId: searchParams.get('candidateId') || '',
    jobId: '',
    salaryMin: '',
    salaryMax: '',
    salaryCurrency: 'USD',
    salaryPeriod: 'YEARLY',
    employmentType: 'FULL_TIME',
    startDate: '',
    expiryDate: '',
    benefits: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [candidatesRes, jobsRes] = await Promise.all([
        candidateService.getCandidates({}),
        recruitmentJobService.getJobs({}),
      ]);
      setCandidates(candidatesRes.data || []);
      setJobs(jobsRes.data || []);

      if (isEdit) {
        const offerRes = await offerService.getOffer(id);
        const offer = offerRes;
        setFormData({
          candidateId: offer.candidateId?.id || '',
          jobId: offer.jobId?.id || '',
          salaryMin: offer.salaryMin || '',
          salaryMax: offer.salaryMax || '',
          salaryCurrency: offer.salaryCurrency || 'USD',
          salaryPeriod: offer.salaryPeriod || 'YEARLY',
          employmentType: offer.employmentType || 'FULL_TIME',
          startDate: offer.startDate ? offer.startDate.split('T')[0] : '',
          expiryDate: offer.expiryDate ? offer.expiryDate.split('T')[0] : '',
          benefits: (offer.benefits || []).join('\n'),
          notes: offer.notes || '',
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        salaryMin: formData.salaryMin ? Number(formData.salaryMin) : undefined,
        salaryMax: formData.salaryMax ? Number(formData.salaryMax) : undefined,
        benefits: formData.benefits.split('\n').filter(Boolean),
        startDate: formData.startDate || undefined,
        expiryDate: formData.expiryDate || undefined,
      };

      if (isEdit) {
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
        subtitle={isEdit ? 'Update offer details' : 'Create a new job offer'}
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
            <Select
              label="Candidate"
              value={formData.candidateId}
              onChange={(v) => setFormData({ ...formData, candidateId: v })}
              options={candidates.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName} - ${c.email}` }))}
            />
            <Select
              label="Job"
              value={formData.jobId}
              onChange={(v) => setFormData({ ...formData, jobId: v })}
              options={jobs.map((j) => ({ value: j.id, label: j.title }))}
            />
            <Input
              label="Salary Min"
              type="number"
              value={formData.salaryMin}
              onChange={(e) => setFormData({ ...formData, salaryMin: e.target.value })}
            />
            <Input
              label="Salary Max"
              type="number"
              value={formData.salaryMax}
              onChange={(e) => setFormData({ ...formData, salaryMax: e.target.value })}
            />
            <Input
              label="Currency"
              value={formData.salaryCurrency}
              onChange={(e) => setFormData({ ...formData, salaryCurrency: e.target.value })}
            />
            <Select
              label="Salary Period"
              value={formData.salaryPeriod}
              onChange={(v) => setFormData({ ...formData, salaryPeriod: v })}
              options={SALARY_PERIODS}
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
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
            <Input
              label="Expiry Date"
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
              placeholder="e.g., Health insurance, 401(k), Remote work"
            />
            <Input
              label="Notes"
              textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
