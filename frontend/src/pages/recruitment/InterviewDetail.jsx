import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { interviewService } from '../../services/interviewService';
import { candidateService } from '../../services/candidateService';
import { recruitmentJobService } from '../../services/recruitmentJobService';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import StatusBadge from '../../components/ui/Badge';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { Calendar, Clock, MapPin, Users, Edit, CheckCircle, XCircle, Send } from 'lucide-react';

const STATUS_OPTIONS = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
const INTERVIEW_TYPES = ['PHONE', 'VIDEO', 'ONSITE', 'TECHNICAL', 'PANEL', 'GROUP'];
const RECOMMENDATION_OPTIONS = ['STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE'];

export default function InterviewDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [interview, setInterview] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 3,
    recommendation: '',
    strengths: '',
    weaknesses: '',
    comments: '',
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const interviewRes = await interviewService.getInterview(id);
      setInterview(interviewRes);
      if (interviewRes.feedback) {
        setFeedback(interviewRes.feedback);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      await interviewService.completeInterview(id);
      toast.success('Interview marked as completed');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCancel = async () => {
    try {
      await interviewService.cancelInterview(id);
      toast.success('Interview cancelled');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    try {
      await interviewService.submitFeedback(id, feedbackForm);
      toast.success('Feedback submitted');
      setShowFeedbackForm(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingState label="Loading interview..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title="Interview Details"
        subtitle={interview.type}
        actions={
          <div className="flex gap-2">
            {interview.status === 'SCHEDULED' && (
              <>
                <Button variant="secondary" onClick={handleComplete} icon={<CheckCircle size={16} />}>
                  Complete
                </Button>
                <Button variant="dangerGhost" onClick={handleCancel} icon={<XCircle size={16} />}>
                  Cancel
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={() => navigate(`/recruitment/interviews/${id}/edit`)} icon={<Edit size={16} />}>
              Reschedule
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Interview Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={16} className="text-ink-400" />
                <span className="text-ink-700">{new Date(interview.scheduledDate).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} className="text-ink-400" />
                <span className="text-ink-700">{interview.duration} minutes</span>
              </div>
              {interview.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={16} className="text-ink-400" />
                  <span className="text-ink-700">{interview.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-500">Type:</span>
                <span className="text-ink-700">{interview.type}</span>
              </div>
            </div>
            {interview.description && (
              <div className="mt-4">
                <p className="text-sm text-ink-700">{interview.description}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Candidate</h3>
            <button
              onClick={() => navigate(`/recruitment/candidates/${interview.candidateId?.id}`)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {interview.candidateId?.firstName} {interview.candidateId?.lastName}
            </button>
            <p className="mt-1 text-xs text-ink-500">{interview.candidateId?.email}</p>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Job</h3>
            <button
              onClick={() => navigate(`/recruitment/jobs/${interview.jobId?.id}`)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {interview.jobId?.title}
            </button>
            <p className="mt-1 text-xs text-ink-500">{interview.jobId?.departmentId?.name}</p>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Interviewers</h3>
            </div>
            <div className="space-y-2">
              {interview.interviewers?.map((interviewer) => (
                <div key={interviewer.id} className="flex items-center gap-3 rounded-lg bg-canvas p-3">
                  <Users size={16} className="text-ink-400" />
                  <div>
                    <p className="text-sm font-medium text-ink-900">{interviewer.name}</p>
                    <p className="text-xs text-ink-500">{interviewer.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Feedback</h3>
              {interview.status === 'COMPLETED' && !feedback && (
                <Button size="sm" variant="secondary" onClick={() => setShowFeedbackForm(true)} icon={<Send size={14} />}>
                  Submit Feedback
                </Button>
              )}
            </div>
            {showFeedbackForm && (
              <form onSubmit={handleSubmitFeedback} className="mb-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-ink-500">Rating (1-5)</label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      value={feedbackForm.rating}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, rating: Number(e.target.value) })}
                    />
                  </div>
                  <Select
                    label="Recommendation"
                    value={feedbackForm.recommendation}
                    onChange={(v) => setFeedbackForm({ ...feedbackForm, recommendation: v })}
                    options={RECOMMENDATION_OPTIONS}
                  />
                </div>
                <Input
                  label="Strengths"
                  textarea
                  rows={2}
                  value={feedbackForm.strengths}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })}
                />
                <Input
                  label="Weaknesses"
                  textarea
                  rows={2}
                  value={feedbackForm.weaknesses}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, weaknesses: e.target.value })}
                />
                <Input
                  label="Comments"
                  textarea
                  rows={3}
                  value={feedbackForm.comments}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, comments: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    Submit
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setShowFeedbackForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            {feedback && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-500">Rating:</span>
                  <span className="text-sm font-medium text-ink-900">{feedback.rating}/5</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-500">Recommendation:</span>
                  <span className="text-sm font-medium text-ink-900">{feedback.recommendation}</span>
                </div>
                {feedback.strengths && (
                  <div>
                    <p className="text-xs text-ink-500">Strengths:</p>
                    <p className="text-sm text-ink-700">{feedback.strengths}</p>
                  </div>
                )}
                {feedback.weaknesses && (
                  <div>
                    <p className="text-xs text-ink-500">Weaknesses:</p>
                    <p className="text-sm text-ink-700">{feedback.weaknesses}</p>
                  </div>
                )}
                {feedback.comments && (
                  <div>
                    <p className="text-xs text-ink-500">Comments:</p>
                    <p className="text-sm text-ink-700">{feedback.comments}</p>
                  </div>
                )}
              </div>
            )}
            {!feedback && !showFeedbackForm && (
              <p className="text-sm text-ink-500">No feedback submitted yet</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Status</h3>
            <StatusBadge status={interview.status} />
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate(`/recruitment/candidates/${interview.candidateId?.id}`)}
              >
                View Candidate
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate(`/recruitment/jobs/${interview.jobId?.id}`)}
              >
                View Job
              </Button>
              {interview.status === 'COMPLETED' && !feedback && (
                <Button
                  className="w-full"
                  onClick={() => setShowFeedbackForm(true)}
                >
                  Submit Feedback
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
