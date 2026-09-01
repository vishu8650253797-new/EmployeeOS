import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicJobService } from '../../services/publicJobService';
import { Briefcase, MapPin, Clock, Search, Filter } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'];
const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID'];

export default function CareersPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({ search: '', employmentType: '', workMode: '', department: '' });

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const jobsRes = await publicJobService.getJobs(filters);
      setJobs(jobsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => loadJobs();

  if (loading) return <LoadingState label="Loading jobs..." />;
  if (error) return <ErrorState message={error} onRetry={loadJobs} />;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-ink-900">Join Our Team</h1>
          <p className="mt-2 text-lg text-ink-600">Discover exciting career opportunities</p>
        </div>

        <div className="mb-6 rounded-xl border border-line bg-surface p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Input
                placeholder="Search jobs..."
                value={filters.search}
                onChange={(v) => handleFilterChange('search', v)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                icon={<Search size={16} />}
              />
            </div>
            <Select
              placeholder="Employment Type"
              value={filters.employmentType}
              onChange={(v) => handleFilterChange('employmentType', v)}
              options={['', ...EMPLOYMENT_TYPES]}
            />
            <Select
              placeholder="Work Mode"
              value={filters.workMode}
              onChange={(v) => handleFilterChange('workMode', v)}
              options={['', ...WORK_MODES]}
            />
          </div>
        </div>

        {jobs.length === 0 ? (
          <EmptyState title="No jobs found" message="Check back later for new opportunities" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="cursor-pointer rounded-xl border border-line bg-surface p-6 transition-shadow hover:shadow-lg"
                onClick={() => navigate(`/careers/jobs/${job.slug}`)}
              >
                <h3 className="text-lg font-semibold text-ink-900">{job.title}</h3>
                <p className="mt-1 text-sm text-ink-600">{job.departmentId?.name}</p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-ink-500">
                    <MapPin size={14} />
                    <span>{job.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-ink-500">
                    <Briefcase size={14} />
                    <span>{job.employmentType}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-ink-500">
                    <Clock size={14} />
                    <span>{job.workMode}</span>
                  </div>
                </div>
                {job.salaryMin && (
                  <div className="mt-4 text-sm font-medium text-ink-900">
                    {job.salaryCurrency} {job.salaryMin} - {job.salaryMax}
                  </div>
                )}
                <Button className="mt-4 w-full">View Details</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
