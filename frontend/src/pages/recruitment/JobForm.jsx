import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { recruitmentJobService } from '../../services/recruitmentJobService';
import { departmentService } from '../../services/departmentService';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { LoadingState, ErrorState } from '../../components/ui/States';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'];
const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID'];
const EXPERIENCE_LEVELS = ['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR'];

export default function JobForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    departmentId: '',
    location: '',
    employmentType: 'FULL_TIME',
    workMode: 'ONSITE',
    experienceLevel: 'MID',
    salaryMin: '',
    salaryMax: '',
    salaryCurrency: 'USD',
    description: '',
    responsibilities: '',
    requirements: '',
    qualifications: '',
    skills: '',
    benefits: '',
    numberOfOpenings: 1,
    closingDate: '',
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const deptsRes = await departmentService.getDepartments();
      setDepartments(deptsRes || []);

      if (isEdit) {
        const jobRes = await recruitmentJobService.getJob(id);
        const job = jobRes;
        setFormData({
          title: job.title || '',
          departmentId: job.departmentId || '',
          location: job.location || '',
          employmentType: job.employmentType || 'FULL_TIME',
          workMode: job.workMode || 'ONSITE',
          experienceLevel: job.experienceLevel || 'MID',
          salaryMin: job.salaryMin || '',
          salaryMax: job.salaryMax || '',
          salaryCurrency: job.salaryCurrency || 'USD',
          description: job.description || '',
          responsibilities: (job.responsibilities || []).join('\n'),
          requirements: (job.requirements || []).join('\n'),
          qualifications: (job.qualifications || []).join('\n'),
          skills: (job.skills || []).join(', '),
          benefits: (job.benefits || []).join('\n'),
          numberOfOpenings: job.numberOfOpenings || 1,
          closingDate: job.closingDate ? job.closingDate.split('T')[0] : '',
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
        responsibilities: formData.responsibilities.split('\n').filter(Boolean),
        requirements: formData.requirements.split('\n').filter(Boolean),
        qualifications: formData.qualifications.split('\n').filter(Boolean),
        skills: formData.skills.split(',').map((s) => s.trim()).filter(Boolean),
        benefits: formData.benefits.split('\n').filter(Boolean),
        salaryMin: formData.salaryMin ? Number(formData.salaryMin) : undefined,
        salaryMax: formData.salaryMax ? Number(formData.salaryMax) : undefined,
        numberOfOpenings: Number(formData.numberOfOpenings),
        closingDate: formData.closingDate || undefined,
      };

      if (isEdit) {
        await recruitmentJobService.updateJob(id, payload);
        toast.success('Job updated successfully');
      } else {
        await recruitmentJobService.createJob(payload);
        toast.success('Job created successfully');
      }
      navigate('/recruitment/jobs');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label={isEdit ? 'Loading job...' : 'Preparing form...'} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Job' : 'New Job Opening'}
        subtitle={isEdit ? 'Update job details' : 'Create a new job posting'}
        actions={
          <Button variant="secondary" onClick={() => navigate('/recruitment/jobs')}>
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Basic Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Job Title" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            <Select
              label="Department"
              value={formData.departmentId}
              onChange={(v) => setFormData({ ...formData, departmentId: v })}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Input label="Location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
            <Input label="Number of Openings" type="number" min="1" value={formData.numberOfOpenings} onChange={(e) => setFormData({ ...formData, numberOfOpenings: e.target.value })} />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Job Details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select
              label="Employment Type"
              value={formData.employmentType}
              onChange={(v) => setFormData({ ...formData, employmentType: v })}
              options={EMPLOYMENT_TYPES}
            />
            <Select
              label="Work Mode"
              value={formData.workMode}
              onChange={(v) => setFormData({ ...formData, workMode: v })}
              options={WORK_MODES}
            />
            <Select
              label="Experience Level"
              value={formData.experienceLevel}
              onChange={(v) => setFormData({ ...formData, experienceLevel: v })}
              options={EXPERIENCE_LEVELS}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Salary Min" type="number" value={formData.salaryMin} onChange={(e) => setFormData({ ...formData, salaryMin: e.target.value })} />
            <Input label="Salary Max" type="number" value={formData.salaryMax} onChange={(e) => setFormData({ ...formData, salaryMax: e.target.value })} />
            <Input label="Currency" value={formData.salaryCurrency} onChange={(e) => setFormData({ ...formData, salaryCurrency: e.target.value })} />
          </div>
          <div className="mt-4">
            <Input label="Closing Date" type="date" value={formData.closingDate} onChange={(e) => setFormData({ ...formData, closingDate: e.target.value })} />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Description</h3>
          <div className="space-y-4">
            <Input label="Description" textarea rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            <Input label="Responsibilities (one per line)" textarea rows={3} value={formData.responsibilities} onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })} />
            <Input label="Requirements (one per line)" textarea rows={3} value={formData.requirements} onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} />
            <Input label="Qualifications (one per line)" textarea rows={3} value={formData.qualifications} onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })} />
            <Input label="Skills (comma-separated)" value={formData.skills} onChange={(e) => setFormData({ ...formData, skills: e.target.value })} />
            <Input label="Benefits (one per line)" textarea rows={3} value={formData.benefits} onChange={(e) => setFormData({ ...formData, benefits: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/recruitment/jobs')}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? 'Update Job' : 'Create Job'}
          </Button>
        </div>
      </form>
    </div>
  );
}
