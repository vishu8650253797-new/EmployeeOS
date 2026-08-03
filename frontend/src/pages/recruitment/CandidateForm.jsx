import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { candidateService } from '../../services/candidateService';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { LoadingState, ErrorState } from '../../components/ui/States';

const SOURCE_TYPES = ['CAREER_PAGE', 'REFERRAL', 'LINKEDIN', 'INDEED', 'OTHER'];
const STATUS_OPTIONS = ['NEW', 'SCREENING', 'INTERVIEWING', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'];

export default function CandidateForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    currentRole: '',
    currentCompany: '',
    summary: '',
    skills: '',
    experience: '',
    education: '',
    source: 'CAREER_PAGE',
    status: 'NEW',
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (isEdit) {
        const candidateRes = await candidateService.getCandidate(id);
        const candidate = candidateRes;
        setFormData({
          firstName: candidate.firstName || '',
          lastName: candidate.lastName || '',
          email: candidate.email || '',
          phone: candidate.phone || '',
          location: candidate.location || '',
          currentRole: candidate.currentRole || '',
          currentCompany: candidate.currentCompany || '',
          summary: candidate.summary || '',
          skills: (candidate.skills || []).join(', '),
          experience: candidate.experience || '',
          education: candidate.education || '',
          source: candidate.source || 'CAREER_PAGE',
          status: candidate.status || 'NEW',
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
        skills: formData.skills.split(',').map((s) => s.trim()).filter(Boolean),
      };

      if (isEdit) {
        await candidateService.updateCandidate(id, payload);
        toast.success('Candidate updated successfully');
      } else {
        await candidateService.createCandidate(payload);
        toast.success('Candidate created successfully');
      }
      navigate('/recruitment/candidates');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label={isEdit ? 'Loading candidate...' : 'Preparing form...'} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Candidate' : 'Add Candidate'}
        subtitle={isEdit ? 'Update candidate information' : 'Add a new candidate to your pool'}
        actions={
          <Button variant="secondary" onClick={() => navigate('/recruitment/candidates')}>
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Personal Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="First Name" required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
            <Input label="Last Name" required value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
            <Input label="Email" type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            <Input label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            <Input label="Location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
            <Select
              label="Source"
              value={formData.source}
              onChange={(v) => setFormData({ ...formData, source: v })}
              options={SOURCE_TYPES}
            />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Professional Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Current Role" value={formData.currentRole} onChange={(e) => setFormData({ ...formData, currentRole: e.target.value })} />
            <Input label="Current Company" value={formData.currentCompany} onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })} />
          </div>
          <div className="mt-4 space-y-4">
            <Input label="Summary" textarea rows={3} value={formData.summary} onChange={(e) => setFormData({ ...formData, summary: e.target.value })} />
            <Input label="Skills (comma-separated)" value={formData.skills} onChange={(e) => setFormData({ ...formData, skills: e.target.value })} />
            <Input label="Experience" textarea rows={3} value={formData.experience} onChange={(e) => setFormData({ ...formData, experience: e.target.value })} />
            <Input label="Education" textarea rows={3} value={formData.education} onChange={(e) => setFormData({ ...formData, education: e.target.value })} />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Status</h3>
          <Select
            label="Status"
            value={formData.status}
            onChange={(v) => setFormData({ ...formData, status: v })}
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/recruitment/candidates')}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? 'Update Candidate' : 'Add Candidate'}
          </Button>
        </div>
      </form>
    </div>
  );
}
