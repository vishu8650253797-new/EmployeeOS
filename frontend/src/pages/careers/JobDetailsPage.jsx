import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { publicJobService } from '../../services/publicJobService';
import { MapPin, Briefcase, Clock, DollarSign, ArrowLeft, Send } from 'lucide-react';
import { LoadingState, ErrorState } from '../../components/ui/States';
import Button from '../../components/ui/Button';

export default function JobDetailsPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [job, setJob] = useState(null);

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

  const handleApply = () => {
    navigate(`/careers/jobs/${slug}/apply`);
  };

  if (loading) return <LoadingState label="Loading job details..." />;
  if (error) return <ErrorState message={error} onRetry={loadJob} />;
  if (!job) return <div className="p-8 text-center text-ink-500">Job not found</div>;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Button variant="ghost" onClick={() => navigate('/careers')} icon={<ArrowLeft size={16} />} className="mb-6">
          Back to Jobs
        </Button>

        <div className="rounded-xl border border-line bg-surface p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-ink-900">{job.title}</h1>
            <p className="mt-2 text-lg text-ink-600">{job.departmentId?.name}</p>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <MapPin size={16} className="text-ink-400" />
              <span>{job.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <Briefcase size={16} className="text-ink-400" />
              <span>{job.employmentType}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <Clock size={16} className="text-ink-400" />
              <span>{job.workMode}</span>
            </div>
            {job.salaryMin && (
              <div className="flex items-center gap-2 text-sm text-ink-600">
                <DollarSign size={16} className="text-ink-400" />
                <span>{job.salaryCurrency} {job.salaryMin} - {job.salaryMax}</span>
              </div>
            )}
          </div>

          {job.description && (
            <div className="mb-6">
              <h2 className="mb-3 text-xl font-semibold text-ink-900">About the Role</h2>
              <p className="text-ink-700 whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {job.responsibilities && job.responsibilities.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-xl font-semibold text-ink-900">Responsibilities</h2>
              <ul className="list-inside list-disc space-y-2 text-ink-700">
                {job.responsibilities.map((resp, idx) => (
                  <li key={idx}>{resp}</li>
                ))}
              </ul>
            </div>
          )}

          {job.requirements && job.requirements.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-xl font-semibold text-ink-900">Requirements</h2>
              <ul className="list-inside list-disc space-y-2 text-ink-700">
                {job.requirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {job.qualifications && job.qualifications.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-xl font-semibold text-ink-900">Qualifications</h2>
              <ul className="list-inside list-disc space-y-2 text-ink-700">
                {job.qualifications.map((qual, idx) => (
                  <li key={idx}>{qual}</li>
                ))}
              </ul>
            </div>
          )}

          {job.skills && job.skills.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-xl font-semibold text-ink-900">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <span key={skill} className="rounded-full bg-canvas px-3 py-1 text-sm text-ink-700">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {job.benefits && job.benefits.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-ink-900">Benefits</h2>
              <ul className="list-inside list-disc space-y-2 text-ink-700">
                {job.benefits.map((benefit, idx) => (
                  <li key={idx}>{benefit}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="lg" onClick={handleApply} icon={<Send size={18} />}>
              Apply Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
