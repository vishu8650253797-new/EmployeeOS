import { useEffect, useRef, useState } from 'react';
import { Camera, Pencil, Plus, Trash2, Lock } from 'lucide-react';
import { essService } from '../../services/essService';
import { essProfileService } from '../../services/essProfileService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { ErrorState, LoadingState, EmptyState } from '../../components/ui/States';

const MAX_EMERGENCY_CONTACTS = 3;

function SectionCard({ title, children, actions }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

function ReadOnlyRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-[13px]">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value || '—'}</span>
    </div>
  );
}

function ManagedByHrNote() {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
      <Lock size={12} aria-hidden="true" />
      Managed by HR — contact HR to request a change
    </p>
  );
}

function EmergencyContactModal({ open, contact, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', relationship: '', phone: '', alternatePhone: '', email: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: contact?.name || '',
      relationship: contact?.relationship || '',
      phone: contact?.phone || '',
      alternatePhone: contact?.alternatePhone || '',
      email: contact?.email || '',
    });
    setErrors({});
  }, [open, contact]);

  function updateField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.relationship.trim()) next.relationship = 'Relationship is required';
    if (!form.phone.trim()) next.phone = 'Phone is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (contact) {
        await essProfileService.updateEmergencyContact(contact.id, form);
        toast.success('Emergency contact updated.');
      } else {
        await essProfileService.addEmergencyContact(form);
        toast.success('Emergency contact added.');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save emergency contact.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={contact ? 'Edit emergency contact' : 'Add emergency contact'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="emergency-contact-form" loading={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <form id="emergency-contact-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" required value={form.name} onChange={(v) => updateField('name', v)} error={errors.name} />
        <Input label="Relationship" required value={form.relationship} onChange={(v) => updateField('relationship', v)} error={errors.relationship} placeholder="e.g. Spouse, Parent, Sibling" />
        <Input label="Phone" required value={form.phone} onChange={(v) => updateField('phone', v)} error={errors.phone} />
        <Input label="Alternate phone (optional)" value={form.alternatePhone} onChange={(v) => updateField('alternatePhone', v)} />
        <Input label="Email (optional)" type="email" value={form.email} onChange={(v) => updateField('email', v)} />
      </form>
    </Modal>
  );
}

export default function EssProfile() {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: context } = useFetch(() => essService.getMe(), []);
  const { data: profile, loading, error, refetch } = useFetch(() => essProfileService.getProfile(), []);

  const [editingContact, setEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState(null);
  const [savingContact, setSavingContact] = useState(false);
  const [contactErrors, setContactErrors] = useState({});
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyEditTarget, setEmergencyEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!profile?.avatar || !context?.employeeId) return undefined;
    let objectUrl;
    essProfileService.getPhotoObjectUrl(context.employeeId).then((url) => {
      objectUrl = url;
      setPhotoUrl(url);
    }).catch(() => setPhotoUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.avatar, context?.employeeId]);

  function startEditingContact() {
    setContactForm({
      phone: profile.phone,
      personalEmail: profile.personalEmail,
      alternatePhone: profile.alternatePhone,
      address: { ...profile.address },
    });
    setContactErrors({});
    setEditingContact(true);
  }

  function updateContactField(name, value) {
    setContactForm((f) => ({ ...f, [name]: value }));
  }

  function updateAddressField(name, value) {
    setContactForm((f) => ({ ...f, address: { ...f.address, [name]: value } }));
  }

  const PHONE_REGEX = /^[+\d][\d\s()-]{6,}$/;

  function validateContactForm() {
    const next = {};
    if (contactForm.phone && !PHONE_REGEX.test(contactForm.phone)) next.phone = 'Enter a valid phone number';
    if (contactForm.alternatePhone && !PHONE_REGEX.test(contactForm.alternatePhone)) next.alternatePhone = 'Enter a valid phone number';
    if (contactForm.personalEmail && !/^\S+@\S+\.\S+$/.test(contactForm.personalEmail)) next.personalEmail = 'Enter a valid email';
    setContactErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSaveContact(event) {
    event.preventDefault();
    if (!validateContactForm()) return;
    setSavingContact(true);
    try {
      await essProfileService.updateProfile(contactForm);
      toast.success('Contact information updated.');
      setEditingContact(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setSavingContact(false);
    }
  }

  async function handlePhotoSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !context?.employeeId) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      await essProfileService.updatePhoto(context.employeeId, formData);
      toast.success('Profile photo updated.');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to update profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeleteContact() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await essProfileService.removeEmergencyContact(deleteTarget.id);
      toast.success('Emergency contact removed.');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to remove emergency contact.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <LoadingState label="Loading your profile…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!profile) return null;

  const fullName = `${profile.firstName} ${profile.lastName}`;
  const atMaxContacts = profile.emergencyContacts.length >= MAX_EMERGENCY_CONTACTS;

  return (
    <div>
      <PageHeader title="My Profile" subtitle="View and update your personal information" />

      <div className="mb-6 flex flex-col items-start gap-4 rounded-xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
        <div className="relative">
          <Avatar name={fullName} src={photoUrl} size="xl" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            aria-label="Change profile photo"
            className="focus-ring absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink-500 shadow-card hover:text-brand-600 disabled:opacity-60"
          >
            <Camera size={13} aria-hidden="true" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handlePhotoSelected} className="hidden" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-ink-900">{fullName}</h2>
          <p className="text-[13px] text-ink-500">{profile.employment.jobTitle}{profile.employment.departmentName ? ` · ${profile.employment.departmentName}` : ''}</p>
          <p className="mt-1 text-xs text-ink-400">Employee ID: {profile.employment.employeeCode}</p>
        </div>
        <StatusBadge status={profile.employment.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Personal Information">
          <ReadOnlyRow label="First name" value={profile.firstName} />
          <ReadOnlyRow label="Last name" value={profile.lastName} />
          <ReadOnlyRow label="Date of birth" value={profile.dateOfBirth ? formatDate(profile.dateOfBirth) : null} />
          <ReadOnlyRow label="Gender" value={profile.gender} />
          <ManagedByHrNote />
        </SectionCard>

        <SectionCard
          title="Contact Information"
          actions={!editingContact && (
            <Button size="sm" variant="secondary" onClick={startEditingContact}>
              <Pencil size={13} />
              Edit
            </Button>
          )}
        >
          {editingContact ? (
            <form onSubmit={handleSaveContact} className="space-y-3">
              <Input label="Phone" value={contactForm.phone} onChange={(v) => updateContactField('phone', v)} error={contactErrors.phone} />
              <Input label="Alternate phone" value={contactForm.alternatePhone} onChange={(v) => updateContactField('alternatePhone', v)} error={contactErrors.alternatePhone} />
              <Input label="Personal email" type="email" value={contactForm.personalEmail} onChange={(v) => updateContactField('personalEmail', v)} error={contactErrors.personalEmail} />
              <Input label="Street address" value={contactForm.address.street} onChange={(v) => updateAddressField('street', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" value={contactForm.address.city} onChange={(v) => updateAddressField('city', v)} />
                <Input label="State" value={contactForm.address.state} onChange={(v) => updateAddressField('state', v)} />
                <Input label="Postal code" value={contactForm.address.postalCode} onChange={(v) => updateAddressField('postalCode', v)} />
                <Input label="Country" value={contactForm.address.country} onChange={(v) => updateAddressField('country', v)} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" size="sm" onClick={() => setEditingContact(false)} disabled={savingContact}>Cancel</Button>
                <Button type="submit" size="sm" loading={savingContact}>{savingContact ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </form>
          ) : (
            <>
              <ReadOnlyRow label="Phone" value={profile.phone} />
              <ReadOnlyRow label="Alternate phone" value={profile.alternatePhone} />
              <ReadOnlyRow label="Personal email" value={profile.personalEmail} />
              <ReadOnlyRow
                label="Address"
                value={[profile.address.street, profile.address.city, profile.address.state, profile.address.country, profile.address.postalCode].filter(Boolean).join(', ')}
              />
            </>
          )}
        </SectionCard>

        <SectionCard title="Employment Information">
          <ReadOnlyRow label="Employee ID" value={profile.employment.employeeCode} />
          <ReadOnlyRow label="Work email" value={profile.employment.workEmail} />
          <ReadOnlyRow label="Department" value={profile.employment.departmentName} />
          <ReadOnlyRow label="Employment type" value={profile.employment.employmentType} />
          <ReadOnlyRow label="Joining date" value={formatDate(profile.employment.joiningDate)} />
          <ManagedByHrNote />
        </SectionCard>

        <SectionCard
          title="Emergency Contacts"
          actions={!atMaxContacts && (
            <Button size="sm" variant="secondary" onClick={() => { setEmergencyEditTarget(null); setEmergencyModalOpen(true); }}>
              <Plus size={13} />
              Add
            </Button>
          )}
        >
          {profile.emergencyContacts.length === 0 ? (
            <EmptyState title="No emergency contacts" message="Add someone we should reach in case of an emergency." />
          ) : (
            <div className="divide-y divide-line">
              {profile.emergencyContacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-ink-900">{contact.name}</p>
                    <p className="text-xs text-ink-500">{contact.relationship} · {contact.phone}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${contact.name}`}
                      onClick={() => { setEmergencyEditTarget(contact); setEmergencyModalOpen(true); }}
                      className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${contact.name}`}
                      onClick={() => setDeleteTarget(contact)}
                      className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {atMaxContacts && (
            <p className="mt-3 text-xs text-ink-400">You've reached the maximum of {MAX_EMERGENCY_CONTACTS} emergency contacts.</p>
          )}
        </SectionCard>
      </div>

      <EmergencyContactModal
        open={emergencyModalOpen}
        contact={emergencyEditTarget}
        onClose={() => setEmergencyModalOpen(false)}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteContact}
        loading={deleting}
        title="Remove emergency contact"
        message={deleteTarget ? `Are you sure you want to remove ${deleteTarget.name}?` : ''}
        confirmLabel="Remove"
      />
    </div>
  );
}
