import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MoreHorizontal, Eye, Pencil, Trash2, Users, SlidersHorizontal } from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { departmentService } from '../../services/departmentService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from '../../data/employees';
import { ROLES } from '../../config/roles';
import { formatDate, fullName, roleLabel } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import {
  TableContainer,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
} from '../../components/ui/Table';

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

function toApiSort(column) {
  const map = {
    name: 'firstName',
    department: 'departmentId',
    status: 'status',
    joiningDate: 'joiningDate',
    employeeId: 'employeeId',
  };
  return map[column] || 'createdAt';
}

export default function EmployeeList() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [employmentType, setEmploymentType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: deptData, loading: deptLoading } = useFetch(
    () => departmentService.getDepartments(),
    []
  );
  const departments = deptData || [];

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const { data, loading, error, refetch } = useFetch(
    () =>
      employeeService.getEmployees({
        search: debouncedSearch,
        department: department === 'all' ? '' : department,
        role: role === 'all' ? '' : role,
        status: status === 'all' ? '' : status,
        employmentType: employmentType === 'all' ? '' : employmentType,
        sortBy: toApiSort(sortBy),
        sortDir,
        page,
        limit: PAGE_SIZE,
      }),
    [debouncedSearch, department, role, status, employmentType, sortBy, sortDir, page]
  );

  const employees = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };

  const hasFilters =
    search ||
    department !== 'all' ||
    role !== 'all' ||
    status !== 'all' ||
    employmentType !== 'all';

  function handleSort(column) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  }

  function updateFilter(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await employeeService.deleteEmployee(deleteTarget.id);
      toast(`${fullName(deleteTarget)} has been removed.`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to delete employee. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const departmentOptions = [
    { value: 'all', label: 'All departments' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const roleOptions = [
    { value: 'all', label: 'All roles' },
    ...Object.entries(ROLES).map(([value, label]) => ({ value, label })),
  ];

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    ...EMPLOYEE_STATUSES,
  ];

  const employmentTypeOptions = [
    { value: 'all', label: 'All types' },
    ...EMPLOYMENT_TYPES,
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage your organization's workforce"
        actions={
          <Button onClick={() => navigate('/employees/new')}>
            <Plus size={15} />
            Add Employee
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(value) => setSearch(value)}
            placeholder="Search by name, email, ID, or title…"
            className="flex-1 sm:max-w-sm"
          />
          <Button
            variant="secondary"
            className="sm:hidden"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={15} />
            Filters
          </Button>
        </div>
        <div className={`grid-cols-2 gap-2 sm:flex sm:flex-wrap ${filtersOpen ? 'grid' : 'hidden sm:flex'}`}>
          <Select
            aria-label="Filter by department"
            value={department}
            onChange={(e) => updateFilter(setDepartment)(e.target.value)}
            options={departmentOptions}
            disabled={deptLoading}
            className="sm:w-48"
          />
          <Select
            aria-label="Filter by role"
            value={role}
            onChange={(e) => updateFilter(setRole)(e.target.value)}
            options={roleOptions}
            className="sm:w-44"
          />
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => updateFilter(setStatus)(e.target.value)}
            options={statusOptions}
            className="sm:w-40"
          />
          <Select
            aria-label="Filter by employment type"
            value={employmentType}
            onChange={(e) => updateFilter(setEmploymentType)(e.target.value)}
            options={employmentTypeOptions}
            className="sm:w-44"
          />
        </div>
      </div>

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees found"
            message={
              hasFilters
                ? 'Try adjusting your search or filters.'
                : 'Get started by adding your first employee.'
            }
            actionLabel={hasFilters ? undefined : 'Add Employee'}
            onAction={hasFilters ? undefined : () => navigate('/employees/new')}
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH sortable sortDir={sortBy === 'name' ? sortDir : null} onSort={() => handleSort('name')}>
                    Employee
                  </TH>
                  <TH sortable sortDir={sortBy === 'employeeId' ? sortDir : null} onSort={() => handleSort('employeeId')}>
                    Employee ID
                  </TH>
                  <TH sortable sortDir={sortBy === 'department' ? sortDir : null} onSort={() => handleSort('department')}>
                    Department
                  </TH>
                  <TH>Job Title</TH>
                  <TH>Role</TH>
                  <TH sortable sortDir={sortBy === 'status' ? sortDir : null} onSort={() => handleSort('status')}>
                    Status
                  </TH>
                  <TH sortable sortDir={sortBy === 'joiningDate' ? sortDir : null} onSort={() => handleSort('joiningDate')}>
                    Joined
                  </TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {employees.map((employee) => (
                  <TR key={employee.id}>
                    <TD>
                      <Link
                        to={`/employees/${employee.id}`}
                        className="focus-ring flex items-center gap-3 rounded-lg"
                      >
                        <Avatar name={fullName(employee)} size="sm" />
                        <span>
                          <span className="block font-medium text-ink-900">{fullName(employee)}</span>
                          <span className="block text-xs text-ink-400">{employee.email}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="text-ink-500">{employee.employeeId}</TD>
                    <TD>{employee.department}</TD>
                    <TD>{employee.jobTitle}</TD>
                    <TD>
                      <span className="text-ink-700">{roleLabel(employee.role, ROLES)}</span>
                    </TD>
                    <TD>
                      <StatusBadge status={employee.status} />
                    </TD>
                    <TD className="text-ink-500">{formatDate(employee.joiningDate)}</TD>
                    <TD className="text-right">
                      <Dropdown
                        width="w-44"
                        trigger={({ open }) => (
                          <button
                            type="button"
                            aria-label={`Actions for ${fullName(employee)}`}
                            aria-expanded={open}
                            className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        )}
                      >
                        <DropdownItem icon={Eye} onClick={() => navigate(`/employees/${employee.id}`)}>
                          View profile
                        </DropdownItem>
                        <DropdownItem icon={Pencil} onClick={() => navigate(`/employees/${employee.id}/edit`)}>
                          Edit
                        </DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem icon={Trash2} danger onClick={() => setDeleteTarget(employee)}>
                          Delete
                        </DropdownItem>
                      </Dropdown>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={pagination.page}
              totalItems={pagination.total}
              pageSize={pagination.limit}
              onPageChange={setPage}
            />
          </>
        )}
      </TableContainer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete employee"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${fullName(deleteTarget)} (${deleteTarget.employeeId})? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
      />
    </div>
  );
}
