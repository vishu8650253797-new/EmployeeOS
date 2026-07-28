import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeeService } from '../../services/employeeService';
import { departmentService } from '../../services/departmentService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from '../../data/employees';
import { ROLES } from '../../config/roles';
import { formatDateForInput, fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Avatar from '../../components/ui/Avatar';
import { LoadingState, ErrorState } from '../../components/ui/States';

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  departmentId: '',
  jobTitle: '',
  role: 'EMPLOYEE',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  joiningDate: '',
  manager: '',
  dateOfBirth: '',
  gender: '',
  address: { street: '', city: '', state: '', country: '', postalCode: '' },
  emergencyContact: { name: '', relationship: '', phone: '' },
};

export default function EmployeeForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);

  const { data: departments } = useFetch(() => departmentService.getDepartments(), []);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    setLoading(true);
    employeeService
      .getEmployeeById(id)
      .then((employee) => {
        if (cancelled) return;
        setForm({
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone || '',
          departmentId: employee.departmentId || '',
          jobTitle: employee.jobTitle,
          role: employee.role,
          employmentType: employee.employmentType,
          status: employee.status,
          joiningDate: formatDateForInput(employee.joiningDate),
          manager: employee.manager || '',
          dateOfBirth: formatDateForInput(employee.dateOfBirth),
          gender: employee.gender || '',
          address: {
            street: employee.address?.street || '',
            city: employee.address?.city || '',
            state: employee.address?.state || '',
            country: employee.address?.country || '',
            postalCode: employee.address?.postalCode || '',
          },
          emergencyContact: {
            name: employee.emergencyContact?.name || '',
            relationship: employee.emergencyContact?.relationship || '',
            phone: employee.emergencyContact?.phone || '',
          },
        });
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }

  function setNested(parent, name, value) {
    setForm((f) => ({ ...f, [parent]: { ...f[parent], [name]: value } }));
    setErrors((e) => ({ ...e, [parent]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required';
    if (!form.lastName.trim()) next.lastName = 'Last name is required';
    if (!form.email.trim()) next.email = 'Work email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (form.phone && !/^[+\d][\d\s()-]{6,}$/.test(form.phone)) next.phone = 'Enter a valid phone number';
    if (!form.jobTitle.trim()) next.jobTitle = 'Job title is required';
    if (!form.role) next.role = 'Role is required';
    if (!form.joiningDate) next.joiningDate = 'Joining date is required';
    if (form.dateOfBirth && new Date(form.dateOfBirth) > new Date())
      next.dateOfBirth = 'Date of birth cannot be in the future';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const isValid =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.email.trim() &&
    form.jobTitle.trim() &&
    form.joiningDate;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        departmentId: form.departmentId,
        jobTitle: form.jobTitle,
        role: form.role,
        employmentType: form.employmentType,
        status: form.status,
        joiningDate: form.joiningDate,
        manager: form.manager,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        address: form.address,
        emergencyContact: form.emergencyContact,
      };
      if (isEdit) {
        await employeeService.updateEmployee(id, payload);
        toast(`${fullName(form)}'s profile has been updated.`);
        navigate(`/employees/${id}`);
      } else {
        const created = await employeeService.createEmployee(payload);
        toast(`${fullName(form)} has been added to the team.`);
        navigate(`/employees/${created.id}`);
      }
    } catch (err) {
      toast(err.message || 'Failed to save employee. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading employee…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => navigate('/employees')} />;

  const departmentOptions = (departments || []).map((d) => ({ value: d.id, label: d.name }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
        subtitle={
          isEdit
            ? 'Update employment details for this team member'
            : 'Create a new employee record for your organization'
        }
        breadcrumbs={[
          { label: 'Employees', to: '/employees' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
      />

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar name={`${form.firstName} ${form.lastName}`} size="xl" />
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-ink-900">
                  {form.firstName || form.lastName ? fullName(form) : 'New Employee'}
                </h2>
                <p className="text-[13px] text-ink-500">{form.jobTitle || 'Job title'}</p>
              </div>
            </div>

            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-ink-900">Personal information</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="First name"
                  required
                  value={form.firstName}
                  onChange={(e) => setField('firstName', e.target.value)}
                  error={errors.firstName}
                  placeholder="e.g. Aarav"
                />
                <Input
                  label="Last name"
                  required
                  value={form.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                  error={errors.lastName}
                  placeholder="e.g. Sharma"
                />
                <Input
                  label="Work email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  error={errors.email}
                  placeholder="name@company.com"
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  error={errors.phone}
                  placeholder="+91 98XXX XXXXX"
                />
                <Input
                  label="Date of birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setField('dateOfBirth', e.target.value)}
                  error={errors.dateOfBirth}
                />
                <Select
                  label="Gender"
                  value={form.gender}
                  onChange={(e) => setField('gender', e.target.value)}
                  options={['Male', 'Female', 'Other', 'Prefer not to say']}
                  placeholder="Select gender"
                />
              </div>
            </fieldset>
          </Card>

          <Card className="space-y-5">
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-ink-900">Employment details</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Department"
                  value={form.departmentId}
                  onChange={(e) => setField('departmentId', e.target.value)}
                  error={errors.departmentId}
                  options={departmentOptions}
                  placeholder="Select department"
                />
                <Input
                  label="Job title"
                  required
                  value={form.jobTitle}
                  onChange={(e) => setField('jobTitle', e.target.value)}
                  error={errors.jobTitle}
                  placeholder="e.g. Software Engineer"
                />
                <Select
                  label="Role"
                  required
                  value={form.role}
                  onChange={(e) => setField('role', e.target.value)}
                  error={errors.role}
                  options={Object.entries(ROLES).map(([value, label]) => ({ value, label }))}
                />
                <Select
                  label="Employment type"
                  value={form.employmentType}
                  onChange={(e) => setField('employmentType', e.target.value)}
                  options={EMPLOYMENT_TYPES}
                />
                <Input
                  label="Joining date"
                  type="date"
                  required
                  value={form.joiningDate}
                  onChange={(e) => setField('joiningDate', e.target.value)}
                  error={errors.joiningDate}
                />
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  options={EMPLOYEE_STATUSES}
                />
                <Input
                  label="Reporting manager"
                  value={form.manager}
                  onChange={(e) => setField('manager', e.target.value)}
                  placeholder="e.g. Rohan Verma"
                  className="sm:col-span-2"
                />
              </div>
            </fieldset>
          </Card>

          <Card className="space-y-5">
            <CardHeader title="Address" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Street"
                value={form.address.street}
                onChange={(e) => setNested('address', 'street', e.target.value)}
                className="sm:col-span-2"
              />
              <Input
                label="City"
                value={form.address.city}
                onChange={(e) => setNested('address', 'city', e.target.value)}
              />
              <Input
                label="State / Province"
                value={form.address.state}
                onChange={(e) => setNested('address', 'state', e.target.value)}
              />
              <Input
                label="Country"
                value={form.address.country}
                onChange={(e) => setNested('address', 'country', e.target.value)}
              />
              <Input
                label="Postal code"
                value={form.address.postalCode}
                onChange={(e) => setNested('address', 'postalCode', e.target.value)}
              />
            </div>
          </Card>

          <Card className="space-y-5">
            <CardHeader title="Emergency contact" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Contact name"
                value={form.emergencyContact.name}
                onChange={(e) => setNested('emergencyContact', 'name', e.target.value)}
              />
              <Input
                label="Relationship"
                value={form.emergencyContact.relationship}
                onChange={(e) => setNested('emergencyContact', 'relationship', e.target.value)}
              />
              <Input
                label="Phone"
                type="tel"
                value={form.emergencyContact.phone}
                onChange={(e) => setNested('emergencyContact', 'phone', e.target.value)}
                className="sm:col-span-2"
              />
            </div>
          </Card>
        </div>

        <Card className="mt-5">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => navigate(-1)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={!isValid || saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add employee'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
