import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { interviewService } from '../../services/interviewService';
import { candidateService } from '../../services/candidateService';
import { recruitmentJobService } from '../../services/recruitmentJobService';
import { applicationService } from '../../services/applicationService';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { LoadingState, ErrorState } from '../../components/ui/States';

const INTERVIEW_TYPES = [
  { value: 'PHONE_SCREEN', label: 'Phone Screen' },
  { value: 'HR_INTERVIEW', label: 'HR Interview' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'BEHAVIORAL', label: 'Behavioral' },
  { value: 'MANAGERIAL', label: 'Managerial' },
  { value: 'FINAL', label: 'Final' },
  { value: 'OTHER', label: 'Other' },
];

function extractId(ref) {
  if (!ref) return '';
  return (ref._id || ref.id || '').toString();
}

function toLocalInputValue(date) {
  if (!date) return '';
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

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
    interviewType: 'TECHNICAL',
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
        const interview = await interviewService.getInterview(id);
        const start = interview.scheduledStart ? new Date(interview.scheduledStart) : null;
        const end = interview.scheduledEnd ? new Date(interview.scheduledEnd) : null;
        setFormData({
          candidateId: extractId(interview.candidateId),
          jobId: extractId(interview.jobId),
          interviewType: interview.interviewType || 'TECHNICAL',
          scheduledDate: toLocalInputValue(start),
          duration: start && end ? Math.round((end - start) / 60000) : 60,
          location: interview.location || '',
          description: interview.notes || '',
          interviewerIds: (interview.interviewerIds || []).map(extractId),
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
    if (!formData.candidateId || !formData.jobId) {
      toast.error('Please select a candidate and a job');
      return;
    }

    try {
      setSubmitting(true);
      const start = new Date(formData.scheduledDate);
      const end = new Date(start.getTime() + Number(formData.duration) * 60000);

      if (isEdit) {
        await interviewService.rescheduleInterview(id, {
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
        });
        toast.success('Interview rescheduled successfully');
      } else {
        const applicationsRes = await applicationService.getApplications({
          candidate: formData.candidateId,
          job: formData.jobId,
        });
        const application = (applicationsRes.data || [])[0];
        if (!application) {
          toast.error('This candidate has not applied to this job — interviews can only be scheduled for an existing application.');
          setSubmitting(false);
          return;
        }

        await interviewService.createInterview({
          applicationId: application.id,
          interviewType: formData.interviewType,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          location: formData.location,
          notes: formData.description,
          interviewerIds: formData.interviewerIds.filter(Boolean),
        });
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
          {isEdit && (
            <p className="mb-4 text-xs text-ink-500">Candidate and job are locked — they can't be changed after the interview is scheduled.</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Candidate"
              required
              disabled={isEdit}
              placeholder="Select a candidate"
              value={formData.candidateId}
              onChange={(v) => setFormData({ ...formData, candidateId: v })}
              options={candidates.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName} - ${c.email}` }))}
            />
            <Select
              label="Job"
              required
              disabled={isEdit}
              placeholder="Select a job"
              value={formData.jobId}
              onChange={(v) => setFormData({ ...formData, jobId: v })}
              options={jobs.map((j) => ({ value: j.id, label: j.title }))}
            />
            <Select
              label="Interview Type"
              value={formData.interviewType}
              onChange={(v) => setFormData({ ...formData, interviewType: v })}
              options={INTERVIEW_TYPES}
            />
            <Input
              label="Duration (minutes)"
              type="number"
              min="15"
              step="15"
              value={formData.duration}
              onChange={(v) => setFormData({ ...formData, duration: v })}
            />
            <Input
              label="Date & Time"
              type="datetime-local"
              required
              value={formData.scheduledDate}
              onChange={(v) => setFormData({ ...formData, scheduledDate: v })}
            />
            <Input
              label="Location / Meeting Link"
              value={formData.location}
              onChange={(v) => setFormData({ ...formData, location: v })}
              placeholder="e.g., https://zoom.us/j/..."
            />
          </div>
          <div className="mt-4">
            <Input
              label="Description / Notes"
              textarea
              rows={3}
              value={formData.description}
              onChange={(v) => setFormData({ ...formData, description: v })}
            />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Interviewers</h3>
          <p className="mb-3 text-xs text-ink-500">Select interviewers (comma-separated IDs)</p>
          <Input
            label="Interviewer IDs"
            value={formData.interviewerIds.join(', ')}
            onChange={(v) => setFormData({ ...formData, interviewerIds: v.split(',').map((s) => s.trim()).filter(Boolean) })}
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
