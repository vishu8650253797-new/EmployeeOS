import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { candidateService } from '../../services/candidateService';
import { applicationService } from '../../services/applicationService';
import { interviewService } from '../../services/interviewService';
import { offerService } from '../../services/offerService';
import { departmentService } from '../../services/departmentService';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import StatusBadge, { STATUS_TONES } from '../../components/ui/Badge';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { Mail, Phone, MapPin, Briefcase, Calendar, Download, Edit, Plus, Clock, Send, UserCheck, X } from 'lucide-react';

const SOURCE_TYPES = ['CAREER_PAGE', 'REFERRAL', 'LINKEDIN', 'INDEED', 'OTHER'];
const STATUS_OPTIONS = ['NEW', 'SCREENING', 'INTERVIEWING', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'];

export default function CandidateDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [applications, setApplications] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [offers, setOffers] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteIsPrivate, setNoteIsPrivate] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [candidateRes, appsRes, interviewsRes, offersRes, notesRes, activitiesRes, deptsRes] = await Promise.all([
        candidateService.getCandidate(id),
        applicationService.getApplications({ candidateId: id }),
        interviewService.getInterviews({ candidateId: id }),
        offerService.getOffers({ candidateId: id }),
        candidateService.getCandidateNotes(id),
        candidateService.getCandidateActivities(id),
        departmentService.getDepartments(),
      ]);
      setCandidate(candidateRes);
      setApplications(appsRes.data || []);
      setInterviews(interviewsRes.data || []);
      setOffers(offersRes.data || []);
      setNotes(notesRes || []);
      setActivities(activitiesRes || []);
      setDepartments(deptsRes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    try {
      await candidateService.updateCandidate(id, { status });
      toast.success('Status updated');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAssignRecruiter = async (recruiterId) => {
    try {
      await candidateService.assignRecruiter(id, { recruiterId });
      toast.success('Recruiter assigned');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    try {
      await candidateService.addCandidateNote(id, { content: noteContent, isPrivate: noteIsPrivate });
      toast.success('Note added');
      setNoteContent('');
      setNoteIsPrivate(false);
      setShowNoteForm(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleConvertToEmployee = async () => {
    try {
      await candidateService.convertToEmployee(id);
      toast.success('Candidate converted to employee');
      navigate('/employees');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDownloadResume = async () => {
    try {
      const url = await candidateService.downloadResume(id);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingState label="Loading candidate..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title={`${candidate.firstName} ${candidate.lastName}`}
        subtitle={candidate.email}
        actions={
          <div className="flex gap-2">
            {candidate.resumeFileId && (
              <Button variant="secondary" onClick={handleDownloadResume} icon={<Download size={16} />}>
                Resume
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/recruitment/candidates/${id}/edit`)} icon={<Edit size={16} />}>
              Edit
            </Button>
            {candidate.status !== 'HIRED' && (
              <Button onClick={handleConvertToEmployee} icon={<UserCheck size={16} />}>
                Hire
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Personal Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail size={16} className="text-ink-400" />
                <span className="text-ink-700">{candidate.email}</span>
              </div>
              {candidate.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={16} className="text-ink-400" />
                  <span className="text-ink-700">{candidate.phone}</span>
                </div>
              )}
              {candidate.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={16} className="text-ink-400" />
                  <span className="text-ink-700">{candidate.location}</span>
                </div>
              )}
              {candidate.currentRole && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase size={16} className="text-ink-400" />
                  <span className="text-ink-700">{candidate.currentRole}</span>
                </div>
              )}
              {candidate.currentCompany && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase size={16} className="text-ink-400" />
                  <span className="text-ink-700">{candidate.currentCompany}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-500">Source:</span>
                <span className="text-ink-700">{candidate.source}</span>
              </div>
            </div>
            {candidate.summary && (
              <div className="mt-4">
                <p className="text-sm text-ink-700">{candidate.summary}</p>
              </div>
            )}
          </div>

          {candidate.skills && candidate.skills.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="mb-4 text-sm font-semibold text-ink-900">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill) => (
                  <span key={skill} className="rounded-full bg-canvas px-3 py-1 text-xs text-ink-700">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Applications</h3>
              <Button size="sm" variant="secondary" onClick={() => navigate('/recruitment/jobs/new')}>
                Apply to Job
              </Button>
            </div>
            {applications.length === 0 ? (
              <p className="text-sm text-ink-500">No applications yet</p>
            ) : (
              <div className="space-y-2">
                {applications.map((app) => (
                  <div key={app.id} className="flex items-center justify-between rounded-lg bg-canvas p-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{app.jobId?.title}</p>
                      <p className="text-xs text-ink-500">Applied {new Date(app.appliedDate).toLocaleDateString()}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Interviews</h3>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/recruitment/interviews/new?candidateId=${id}`)} icon={<Plus size={14} />}>
                Schedule
              </Button>
            </div>
            {interviews.length === 0 ? (
              <p className="text-sm text-ink-500">No interviews scheduled</p>
            ) : (
              <div className="space-y-2">
                {interviews.map((interview) => (
                  <div key={interview.id} className="flex items-center justify-between rounded-lg bg-canvas p-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{interview.type}</p>
                      <p className="text-xs text-ink-500">{new Date(interview.scheduledDate).toLocaleString()}</p>
                    </div>
                    <StatusBadge status={interview.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Offers</h3>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/recruitment/offers/new?candidateId=${id}`)} icon={<Plus size={14} />}>
                Create Offer
              </Button>
            </div>
            {offers.length === 0 ? (
              <p className="text-sm text-ink-500">No offers sent</p>
            ) : (
              <div className="space-y-2">
                {offers.map((offer) => (
                  <div key={offer.id} className="flex items-center justify-between rounded-lg bg-canvas p-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{offer.jobId?.title}</p>
                      <p className="text-xs text-ink-500">{offer.salaryCurrency} {offer.salaryMin} - {offer.salaryMax}</p>
                    </div>
                    <StatusBadge status={offer.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Activity Timeline</h3>
            </div>
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas">
                    <Clock size={14} className="text-ink-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-ink-900">{activity.description}</p>
                    <p className="text-xs text-ink-500">{new Date(activity.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Status</h3>
            <Select
              value={candidate.status}
              onChange={handleUpdateStatus}
              options={STATUS_OPTIONS}
            />
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Assigned Recruiter</h3>
            <Select
              placeholder="Assign recruiter"
              onChange={handleAssignRecruiter}
              options={departments.flatMap((d) => d.employees?.map((e) => ({ value: e.id, label: e.name })) || [])}
            />
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Notes</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowNoteForm(!showNoteForm)} icon={<Plus size={14} />}>
                Add
              </Button>
            </div>
            {showNoteForm && (
              <form onSubmit={handleAddNote} className="mb-4 space-y-3">
                <Input
                  textarea
                  rows={3}
                  placeholder="Add a note..."
                  value={noteContent}
                  onChange={(v) => setNoteContent(v)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={noteIsPrivate}
                    onChange={(e) => setNoteIsPrivate(e.target.checked)}
                  />
                  <span className="text-ink-700">Private note</span>
                </label>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setShowNoteForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="rounded-lg bg-canvas p-3">
                  <p className="text-sm text-ink-900">{note.content}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-ink-500">{note.authorId?.name}</p>
                    {note.isPrivate && <span className="text-xs text-ink-400">Private</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
