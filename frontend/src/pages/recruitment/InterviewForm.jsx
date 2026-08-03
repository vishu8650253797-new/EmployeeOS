import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { interviewService } from '../../services/interviewService';
import { candidateService } from '../../services/candidateService';
import { recruitmentJobService } from '../../services/recruitmentJobService';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { LoadingState, ErrorState } from '../../components/ui/States';

const INTERVIEW_TYPES = ['PHONE', 'VIDEO', 'ONSITE', 'TECHNICAL', 'PANEL', 'GROUP'];

export default function InterviewForm() {
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
    type: 'VIDEO',
    scheduledDate: '',
    duration: 60,
    location: '',
    description: '',
    interviewerIds: [],
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
        const interviewRes = await interviewService.getInterview(id);
        const interview = interviewRes;
        setFormData({
          candidateId: interview.candidateId?.id || '',
          jobId: interview.jobId?.id || '',
          type: interview.type || 'VIDEO',
          scheduledDate: interview.scheduledDate ? interview.scheduledDate.slice(0, 16) : '',
          duration: interview.duration || 60,
          location: interview.location || '',
          description: interview.description || '',
          interviewerIds: interview.interviewers?.map((i) => i.id) || [],
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
        scheduledDate: new Date(formData.scheduledDate).toISOString(),
        duration: Number(formData.duration),
        interviewerIds: formData.interviewerIds.filter(Boolean),
      };

      if (isEdit) {
        await interviewService.rescheduleInterview(id, payload);
        toast.success('Interview rescheduled successfully');
      } else {
        await interviewService.createInterview(payload);
        toast.success('Interview scheduled successfully');
      }
      navigate('/recruitment/interviews');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label={isEdit ? 'Loading interview...' : 'Preparing form...'} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Reschedule Interview' : 'Schedule Interview'}
        subtitle={isEdit ? 'Update interview details' : 'Schedule a new interview'}
        actions={
          <Button variant="secondary" onClick={() => navigate('/recruitment/interviews')}>
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Interview Details</h3>
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
            <Select
              label="Interview Type"
              value={formData.type}
              onChange={(v) => setFormData({ ...formData, type: v })}
              options={INTERVIEW_TYPES}
            />
            <Input
              label="Duration (minutes)"
              type="number"
              min="15"
              step="15"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
            />
            <Input
              label="Date & Time"
              type="datetime-local"
              required
              value={formData.scheduledDate}
              onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            />
            <Input
              label="Location / Meeting Link"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., https://zoom.us/j/..."
            />
          </div>
          <div className="mt-4">
            <Input
              label="Description / Notes"
              textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Interviewers</h3>
          <p className="mb-3 text-xs text-ink-500">Select interviewers (comma-separated IDs)</p>
          <Input
            label="Interviewer IDs"
            value={formData.interviewerIds.join(', ')}
            onChange={(e) => setFormData({ ...formData, interviewerIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            placeholder="e.g., user1, user2, user3"
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/recruitment/interviews')}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? 'Update Interview' : 'Schedule Interview'}
          </Button>
        </div>
      </form>
    </div>
  );
}
