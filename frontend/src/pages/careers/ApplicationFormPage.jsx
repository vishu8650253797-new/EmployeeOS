import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { publicJobService } from '../../services/publicJobService';
import { ArrowLeft, Upload, CheckCircle } from 'lucide-react';
import { LoadingState, ErrorState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const SOURCE_TYPES = ['CAREERS_PAGE', 'LINKEDIN', 'REFERRAL', 'JOB_BOARD', 'AGENCY', 'DIRECT_APPLICATION', 'OTHER'];

export default function ApplicationFormPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [job, setJob] = useState(null);
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
    source: 'CAREERS_PAGE',
    resume: null,
  });

  useEffect(() => {
    loadJob();
  }, [slug]);

  const loadJob = async () => {
    try {
      setLoading(true);
      setError(null);
      const jobRes = await publicJobService.getJobBySlug(slug);
      setJob(jobRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, resume: file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.resume) {
      setError('Please upload your resume');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const data = new FormData();
      data.append('firstName', formData.firstName);
      data.append('lastName', formData.lastName);
      data.append('email', formData.email);
      data.append('phone', formData.phone);
      data.append('location', formData.location);
      data.append('currentCompany', formData.currentCompany);
      // Backend Candidate field is `currentJobTitle`, not `currentRole`.
      data.append('currentJobTitle', formData.currentRole);
      data.append('skills', formData.skills.split(',').map((s) => s.trim()).filter(Boolean).join(','));
      data.append('summary', formData.summary);
      data.append('experience', formData.experience);
      data.append('education', formData.education);
      data.append('source', formData.source);
      data.append('resume', formData.resume);

      await publicJobService.applyToJob(job.id, data);
      navigate('/careers/success');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading application form..." />;
  if (error) return <ErrorState message={error} onRetry={loadJob} />;
  if (!job) return <div className="p-8 text-center text-ink-500">Job not found</div>;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Button variant="ghost" onClick={() => navigate(`/careers/jobs/${slug}`)} icon={<ArrowLeft size={16} />} className="mb-6">
          Back to Job
        </Button>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-ink-900">Apply for {job.title}</h1>
          <p className="mt-2 text-ink-600">Complete the form below to submit your application</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-line bg-surface p-8">
          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-sm font-semibold text-ink-900">Personal Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="First Name" required value={formData.firstName} onChange={(v) => setFormData({ ...formData, firstName: v })} />
                <Input label="Last Name" required value={formData.lastName} onChange={(v) => setFormData({ ...formData, lastName: v })} />
                <Input label="Email" type="email" required value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} />
                <Input label="Phone" value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} />
                <Input label="Location" value={formData.location} onChange={(v) => setFormData({ ...formData, location: v })} />
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold text-ink-900">Professional Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Current Role" value={formData.currentRole} onChange={(v) => setFormData({ ...formData, currentRole: v })} />
                <Input label="Current Company" value={formData.currentCompany} onChange={(v) => setFormData({ ...formData, currentCompany: v })} />
              </div>
              <div className="mt-4 space-y-4">
                <Input label="Summary" textarea rows={3} value={formData.summary} onChange={(v) => setFormData({ ...formData, summary: v })} />
                <Input label="Skills (comma-separated)" value={formData.skills} onChange={(v) => setFormData({ ...formData, skills: v })} />
                <Input label="Experience" textarea rows={3} value={formData.experience} onChange={(v) => setFormData({ ...formData, experience: v })} />
                <Input label="Education" textarea rows={3} value={formData.education} onChange={(v) => setFormData({ ...formData, education: v })} />
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold text-ink-900">Resume</h3>
              <div className="rounded-lg border-2 border-dashed border-line p-6 text-center">
                <Upload size={32} className="mx-auto mb-2 text-ink-400" />
                <p className="text-sm text-ink-600">
                  {formData.resume ? formData.resume.name : 'Upload your resume (PDF, DOC, DOCX - Max 10MB)'}
                </p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-ink-500">How did you hear about this position?</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900"
              >
                {SOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => navigate(`/careers/jobs/${slug}`)}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting} icon={<CheckCircle size={16} />}>
                Submit Application
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
