import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { recruitmentJobService } from '../../services/recruitmentJobService';
import { departmentService } from '../../services/departmentService';
import PageHeader from '../../components/layout/PageHeader';
import { Briefcase, Plus, Search, Filter, MoreHorizontal } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import StatusBadge, { STATUS_TONES } from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const STATUS_OPTIONS = ['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED'];
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'];
const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID'];

export default function JobList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', department: '', employmentType: '', workMode: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [jobsRes, deptsRes] = await Promise.all([
        recruitmentJobService.getJobs(filters),
        departmentService.getDepartments(),
      ]);
      setJobs(jobsRes.data || []);
      setDepartments(deptsRes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => loadData();

  const handlePublish = async (id) => {
    try {
      await recruitmentJobService.publishJob(id);
      toast.success('Job published successfully');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleClose = async (id) => {
    try {
      await recruitmentJobService.closeJob(id);
      toast.success('Job closed successfully');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingState label="Loading jobs..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div>
      <PageHeader
        title="Job Openings"
        subtitle="Manage your job postings"
        actions={
          <Button onClick={() => navigate('/recruitment/jobs/new')} icon={<Plus size={16} />}>
            New Job
          </Button>
        }
      />

      <div className="mb-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Input
              placeholder="Search jobs..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              icon={<Search size={16} />}
            />
          </div>
          <Select
            placeholder="Status"
            value={filters.status}
            onChange={(v) => handleFilterChange('status', v)}
            options={['', ...STATUS_OPTIONS]}
          />
          <Select
            placeholder="Department"
            value={filters.department}
            onChange={(v) => handleFilterChange('department', v)}
            options={['', ...departments.map((d) => ({ value: d.id, label: d.name }))]}
          />
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
        <EmptyState title="No jobs found" message="Create your first job opening to get started" actionLabel="New Job" onAction={() => navigate('/recruitment/jobs/new')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Title</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Department</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Location</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Applications</th>
                <th className="px-4 py-3 text-right font-medium text-ink-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-line hover:bg-canvas">
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/recruitment/jobs/${job.id}`)} className="font-medium text-brand-600 hover:text-brand-700">
                      {job.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{job.departmentId?.name || '-'}</td>
                  <td className="px-4 py-3 text-ink-700">{job.location || '-'}</td>
                  <td className="px-4 py-3 text-ink-700">{job.employmentType}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-700">{job.applicationCount || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {job.status === 'DRAFT' && (
                        <Button size="sm" variant="secondary" onClick={() => handlePublish(job.id)}>
                          Publish
                        </Button>
                      )}
                      {job.status === 'PUBLISHED' && (
                        <Button size="sm" variant="dangerGhost" onClick={() => handleClose(job.id)}>
                          Close
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/recruitment/jobs/${job.id}/edit`)}>
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
