import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send, CheckCircle2, XCircle, Ban, LayoutGrid, ShieldCheck, Package, MessageSquare,
  Users2, FolderOpen, Lock, Wallet, History as HistoryIcon, Calendar, UserRound,
  Building2, FileText, Clock,
} from 'lucide-react';
import { offboardingService } from '../../services/offboardingService';
import { documentCategoryService } from '../../services/documentCategoryService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate, fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import Modal from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import ReturnAssetModal from '../../components/assets/ReturnAssetModal';

const FULL_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];
const ACCESS_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];
const SETTLEMENT_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutGrid },
  { value: 'approval', label: 'Approval', icon: CheckCircle2 },
  { value: 'clearances', label: 'Clearances', icon: ShieldCheck },
  { value: 'assets', label: 'Assets', icon: Package },
  { value: 'exit-interview', label: 'Exit Interview', icon: MessageSquare },
  { value: 'knowledge-transfer', label: 'Knowledge Transfer', icon: Users2 },
  { value: 'documents', label: 'Documents', icon: FolderOpen },
  { value: 'access', label: 'Access', icon: Lock },
  { value: 'settlement', label: 'Settlement Prep', icon: Wallet },
  { value: 'timeline', label: 'Timeline', icon: HistoryIcon },
];

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-ink-400">{label}</p>
        <p className="mt-0.5 break-words text-[13px] font-medium text-ink-900">{value ?? '—'}</p>
      </div>
    </div>
  );
}

function ReasonModal({ open, onClose, onConfirm, title, label, saving }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={() => {
        setReason('');
        onClose();
      }}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" loading={saving} onClick={() => onConfirm(reason)}>
            Confirm
          </Button>
        </>
      }
    >
      <Input label={label} textarea value={reason} onChange={setReason} placeholder="Optional context" />
    </Modal>
  );
}

function NoticePeriodProgress({ offboarding }) {
  if (!offboarding.noticePeriodStartDate) {
    return <p className="text-[13px] text-ink-500">Notice period has not started yet — pending approval.</p>;
  }
  const start = new Date(offboarding.noticePeriodStartDate);
  const end = new Date(offboarding.noticePeriodEndDate || offboarding.lastWorkingDate);
  const now = new Date();
  const totalDays = Math.max(1, Math.round((end - start) / 86400000));
  const completedDays = Math.min(totalDays, Math.max(0, Math.round((now - start) / 86400000)));
  const remainingDays = Math.max(0, totalDays - completedDays);
  const pct = Math.min(100, Math.round((completedDays / totalDays) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="text-ink-500">
          {completedDays} of {totalDays} days completed · {remainingDays} remaining
        </span>
        <span className="font-medium text-ink-900">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-400/10">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function OverviewTab({ offboarding }) {
  const employee = offboarding.employeeId || {};
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Employee" />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={UserRound} label="Name" value={fullName(employee)} />
          <InfoRow icon={FileText} label="Job title" value={employee.jobTitle} />
          <InfoRow icon={Building2} label="Email" value={employee.email} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Offboarding Overview" />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={FileText} label="Type" value={<StatusBadge status={offboarding.offboardingType} />} />
          <InfoRow icon={FileText} label="Reason" value={offboarding.reason} />
          <InfoRow icon={Calendar} label="Last working date" value={formatDate(offboarding.lastWorkingDate)} />
          <InfoRow icon={UserRound} label="Initiated by" value={offboarding.initiatedBy ? fullName(offboarding.initiatedBy) : '—'} />
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Notice Period" />
        <div className="mt-3">
          <NoticePeriodProgress offboarding={offboarding} />
        </div>
      </Card>
      {(offboarding.remarks || offboarding.employeeComments || offboarding.hrComments || offboarding.managerComments) && (
        <Card className="lg:col-span-2">
          <CardHeader title="Comments" />
          <div className="mt-2 space-y-3 text-[13px] text-ink-700">
            {offboarding.remarks && <p><span className="font-medium">Remarks:</span> {offboarding.remarks}</p>}
            {offboarding.employeeComments && <p><span className="font-medium">Employee:</span> {offboarding.employeeComments}</p>}
            {offboarding.managerComments && <p><span className="font-medium">Manager:</span> {offboarding.managerComments}</p>}
            {offboarding.hrComments && <p><span className="font-medium">HR:</span> {offboarding.hrComments}</p>}
          </div>
        </Card>
      )}
    </div>
  );
}

function ApprovalTab({ offboarding, canGiveManagerApproval, canGiveHRApproval, onApprove, saving }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Manager Approval"
          action={<StatusBadge status={offboarding.managerApproval?.status || 'PENDING'} />}
        />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={UserRound} label="Required" value={offboarding.managerApproval?.required ? 'Yes' : 'No'} />
          <InfoRow icon={UserRound} label="Approved by" value={offboarding.managerApproval?.by ? fullName(offboarding.managerApproval.by) : '—'} />
          <InfoRow icon={Calendar} label="Decided on" value={formatDate(offboarding.managerApproval?.at)} />
          <InfoRow icon={FileText} label="Comments" value={offboarding.managerApproval?.comments} />
        </div>
        {canGiveManagerApproval && (
          <div className="mt-3">
            <Button size="sm" loading={saving} onClick={() => onApprove('MANAGER')}>
              <CheckCircle2 size={14} />
              Give Manager Approval
            </Button>
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="HR Approval" action={<StatusBadge status={offboarding.hrApproval?.status || 'PENDING'} />} />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={UserRound} label="Approved by" value={offboarding.hrApproval?.by ? fullName(offboarding.hrApproval.by) : '—'} />
          <InfoRow icon={Calendar} label="Decided on" value={formatDate(offboarding.hrApproval?.at)} />
          <InfoRow icon={FileText} label="Comments" value={offboarding.hrApproval?.comments} />
        </div>
        {canGiveHRApproval && (
          <div className="mt-3">
            <Button size="sm" loading={saving} onClick={() => onApprove('HR')}>
              <CheckCircle2 size={14} />
              Give HR Approval
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

const CLEARANCE_STATUSES = ['PENDING', 'IN_PROGRESS', 'CLEARED', 'REJECTED', 'NOT_APPLICABLE'];

function ClearancesTab({ offboarding, user, onUpdated }) {
  const { toast } = useToast();
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const clearances = offboarding.clearances || [];
  if (clearances.length === 0) {
    return <EmptyState icon={ShieldCheck} title="No clearances yet" message="Clearances are created once the offboarding is approved." />;
  }

  function draftFor(clearance) {
    return drafts[clearance._id] || { status: clearance.status, comments: clearance.comments || '' };
  }

  async function handleSave(clearance) {
    const draft = draftFor(clearance);
    setSavingId(clearance._id);
    try {
      await offboardingService.updateClearance(offboarding.id, clearance._id, draft);
      toast('Clearance updated.');
      onUpdated();
    } catch (err) {
      toast(err.message || 'Failed to update clearance.', 'error');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {clearances.map((clearance) => {
        const canEdit = FULL_ROLES.includes(user?.role) || clearance.assignedTo?._id === user?.employeeId || clearance.assignedTo?._id === user?.id;
        const draft = draftFor(clearance);
        return (
          <Card key={clearance._id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">{clearance.department}</p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {clearance.assignedTo ? `Assigned to ${fullName(clearance.assignedTo)}` : 'Unassigned'}
                  {clearance.dueDate ? ` · Due ${formatDate(clearance.dueDate)}` : ''}
                </p>
              </div>
              <StatusBadge status={clearance.status} />
            </div>
            {canEdit && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <Select
                  label="Status"
                  value={draft.status}
                  onChange={(v) => setDrafts((d) => ({ ...d, [clearance._id]: { ...draft, status: v } }))}
                  options={CLEARANCE_STATUSES}
                  className="sm:w-48"
                />
                <Input
                  label="Comments"
                  value={draft.comments}
                  onChange={(v) => setDrafts((d) => ({ ...d, [clearance._id]: { ...draft, comments: v } }))}
                  className="flex-1"
                />
                <Button size="sm" loading={savingId === clearance._id} onClick={() => handleSave(clearance)}>
                  Save
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function AssetsTab({ offboardingId, canManage, onChanged }) {
  const { toast } = useToast();
  const [returnTarget, setReturnTarget] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { data: assets, loading, error, refetch } = useFetch(
    () => offboardingService.getOffboardingAssets(offboardingId),
    [offboardingId]
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await offboardingService.refreshAssetClearance(offboardingId);
      toast('Asset clearance status refreshed.');
      refetch();
      onChanged();
    } catch (err) {
      toast(err.message || 'Failed to refresh asset clearance.', 'error');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) return <CardSkeleton lines={4} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" loading={refreshing} onClick={handleRefresh}>
            Refresh Clearance Status
          </Button>
        </div>
      )}
      {!assets || assets.length === 0 ? (
        <Card padding={false}>
          <EmptyState icon={Package} title="No assets assigned" message="This employee has no assets on record." />
        </Card>
      ) : (
        <Card padding={false}>
          <ul className="divide-y divide-line">
            {assets.map((asset) => (
              <li key={asset.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-[13px] font-medium text-ink-900">{asset.name}</p>
                  <p className="text-xs text-ink-400">{asset.assetTag} · {asset.categoryId?.name || 'Uncategorized'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={asset.status} />
                  {canManage && asset.status === 'ASSIGNED' && (
                    <Button size="sm" variant="secondary" onClick={() => setReturnTarget(asset)}>
                      Return
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <ReturnAssetModal
        open={Boolean(returnTarget)}
        asset={returnTarget}
        onClose={() => setReturnTarget(null)}
        onReturned={() => {
          setReturnTarget(null);
          refetch();
          onChanged();
        }}
      />
    </div>
  );
}

function ExitInterviewTab({ offboarding, user, onUpdated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ scheduledDate: '' });
  const [feedbackForm, setFeedbackForm] = useState({
    reasonForLeaving: offboarding.exitInterview?.reasonForLeaving || '',
    feedback: offboarding.exitInterview?.feedback || '',
    suggestions: offboarding.exitInterview?.suggestions || '',
    managementFeedback: offboarding.exitInterview?.managementFeedback || '',
    workplaceFeedback: offboarding.exitInterview?.workplaceFeedback || '',
    interviewerNotes: offboarding.exitInterview?.interviewerNotes || '',
    rehireEligible: offboarding.exitInterview?.rehireEligible ?? '',
  });

  const canManage = FULL_ROLES.includes(user?.role);
  const canSeeDetails = 'feedback' in (offboarding.exitInterview || {}) || canManage;
  const status = offboarding.exitInterviewStatus;

  async function handleSchedule() {
    setSaving(true);
    try {
      await offboardingService.scheduleExitInterview(offboarding.id, scheduleForm);
      toast('Exit interview scheduled.');
      onUpdated();
    } catch (err) {
      toast(err.message || 'Failed to schedule exit interview.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setSaving(true);
    try {
      await offboardingService.updateExitInterview(offboarding.id, { action: 'COMPLETE', ...feedbackForm });
      toast('Exit interview recorded.');
      onUpdated();
    } catch (err) {
      toast(err.message || 'Failed to save exit interview.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleWaive() {
    setSaving(true);
    try {
      await offboardingService.updateExitInterview(offboarding.id, { action: 'WAIVE' });
      toast('Exit interview waived.');
      onUpdated();
    } catch (err) {
      toast(err.message || 'Failed to waive exit interview.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Exit Interview" action={<StatusBadge status={status} />} />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={Calendar} label="Scheduled date" value={formatDate(offboarding.exitInterview?.scheduledDate)} />
          <InfoRow icon={UserRound} label="Interviewer" value={offboarding.exitInterview?.interviewerId ? fullName(offboarding.exitInterview.interviewerId) : '—'} />
        </div>
        {canManage && status === 'NOT_SCHEDULED' && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input label="Scheduled date" type="date" value={scheduleForm.scheduledDate} onChange={(v) => setScheduleForm({ scheduledDate: v })} className="sm:w-56" />
            <Button size="sm" loading={saving} onClick={handleSchedule}>Schedule</Button>
            <Button size="sm" variant="secondary" loading={saving} onClick={handleWaive}>Waive</Button>
          </div>
        )}
      </Card>

      {!canSeeDetails ? (
        <Card>
          <p className="text-[13px] text-ink-500">Exit interview feedback is confidential and only visible to HR and the assigned interviewer.</p>
        </Card>
      ) : (
        (status === 'SCHEDULED' || status === 'COMPLETED') && (
          <Card>
            <CardHeader title="Feedback" />
            <div className="mt-3 space-y-3">
              <Input label="Reason for leaving" textarea value={feedbackForm.reasonForLeaving} onChange={(v) => setFeedbackForm((f) => ({ ...f, reasonForLeaving: v }))} disabled={!canManage || status === 'COMPLETED'} />
              <Input label="Feedback" textarea value={feedbackForm.feedback} onChange={(v) => setFeedbackForm((f) => ({ ...f, feedback: v }))} disabled={!canManage || status === 'COMPLETED'} />
              <Input label="Suggestions" textarea value={feedbackForm.suggestions} onChange={(v) => setFeedbackForm((f) => ({ ...f, suggestions: v }))} disabled={!canManage || status === 'COMPLETED'} />
              <Input label="Management feedback" textarea value={feedbackForm.managementFeedback} onChange={(v) => setFeedbackForm((f) => ({ ...f, managementFeedback: v }))} disabled={!canManage || status === 'COMPLETED'} />
              <Input label="Workplace feedback" textarea value={feedbackForm.workplaceFeedback} onChange={(v) => setFeedbackForm((f) => ({ ...f, workplaceFeedback: v }))} disabled={!canManage || status === 'COMPLETED'} />
              <Input label="Interviewer notes" textarea value={feedbackForm.interviewerNotes} onChange={(v) => setFeedbackForm((f) => ({ ...f, interviewerNotes: v }))} disabled={!canManage || status === 'COMPLETED'} />
              {canManage && status === 'SCHEDULED' && (
                <Button size="sm" loading={saving} onClick={handleComplete}>Complete Interview</Button>
              )}
            </div>
          </Card>
        )
      )}
    </div>
  );
}

const KT_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NOT_REQUIRED'];

function KnowledgeTransferTab({ offboarding, user, onUpdated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    status: offboarding.knowledgeTransfer?.status || 'NOT_STARTED',
    projects: offboarding.knowledgeTransfer?.projects || '',
    responsibilities: offboarding.knowledgeTransfer?.responsibilities || '',
    documentationLinks: offboarding.knowledgeTransfer?.documentationLinks || '',
    pendingTasks: offboarding.knowledgeTransfer?.pendingTasks || '',
    comments: offboarding.knowledgeTransfer?.comments || '',
  });
  const canEdit = FULL_ROLES.includes(user?.role) || user?.role === 'MANAGER';

  async function handleSave() {
    setSaving(true);
    try {
      await offboardingService.updateKnowledgeTransfer(offboarding.id, form);
      toast('Knowledge transfer updated.');
      onUpdated();
    } catch (err) {
      toast(err.message || 'Failed to update knowledge transfer.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Knowledge Transfer" action={<StatusBadge status={offboarding.knowledgeTransferStatus} />} />
      <div className="mt-3 space-y-3">
        <Select label="Status" value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={KT_STATUSES} disabled={!canEdit} className="sm:w-56" />
        <Input label="Projects" textarea value={form.projects} onChange={(v) => setForm((f) => ({ ...f, projects: v }))} disabled={!canEdit} />
        <Input label="Responsibilities" textarea value={form.responsibilities} onChange={(v) => setForm((f) => ({ ...f, responsibilities: v }))} disabled={!canEdit} />
        <Input label="Documentation links" textarea value={form.documentationLinks} onChange={(v) => setForm((f) => ({ ...f, documentationLinks: v }))} disabled={!canEdit} />
        <Input label="Pending tasks" textarea value={form.pendingTasks} onChange={(v) => setForm((f) => ({ ...f, pendingTasks: v }))} disabled={!canEdit} />
        <Input label="Comments" textarea value={form.comments} onChange={(v) => setForm((f) => ({ ...f, comments: v }))} disabled={!canEdit} />
        {canEdit && <Button size="sm" loading={saving} onClick={handleSave}>Save</Button>}
      </div>
    </Card>
  );
}

function DocumentsTab({ offboarding, user, onChanged }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ categoryId: '', title: '', priority: 'MEDIUM' });
  const canRequest = FULL_ROLES.includes(user?.role);

  const { data: documents, loading, error, refetch } = useFetch(
    () => offboardingService.getDocuments(offboarding.id),
    [offboarding.id]
  );
  const { data: categories } = useFetch(
    () => (canRequest ? documentCategoryService.getCategories() : Promise.resolve(null)),
    [canRequest]
  );

  async function handleRequest(event) {
    event.preventDefault();
    if (!form.categoryId || !form.title) {
      toast('Category and title are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      await offboardingService.requestDocument(offboarding.id, form);
      toast('Document requested.');
      setForm({ categoryId: '', title: '', priority: 'MEDIUM' });
      refetch();
      onChanged();
    } catch (err) {
      toast(err.message || 'Failed to request document.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {canRequest && (
        <Card>
          <CardHeader title="Request an exit document" />
          <form onSubmit={handleRequest} noValidate className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select label="Category" required value={form.categoryId} onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))} placeholder="Select category" options={(categories || []).map((c) => ({ value: c.id, label: c.name }))} className="sm:w-56" />
            <Input label="Title" required value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="e.g. Resignation letter" className="flex-1" />
            <Button type="submit" size="sm" loading={saving}>Request</Button>
          </form>
        </Card>
      )}
      {loading ? (
        <CardSkeleton lines={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !documents || documents.length === 0 ? (
        <Card padding={false}>
          <EmptyState icon={FolderOpen} title="No documents requested" message="Exit documents requested for this offboarding will appear here." />
        </Card>
      ) : (
        <Card padding={false}>
          <ul className="divide-y divide-line">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-[13px] font-medium text-ink-900">{doc.title}</p>
                  <p className="text-xs text-ink-400">{doc.categoryId?.name || 'Uncategorized'}</p>
                </div>
                <StatusBadge status={doc.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

const ACCESS_STATUSES = ['SCHEDULED', 'DEACTIVATED', 'FAILED', 'NOT_REQUIRED'];

function AccessTab({ offboarding, user, onUpdated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [status, setStatus] = useState('DEACTIVATED');
  const canManage = ACCESS_ROLES.includes(user?.role);

  async function handleRequest() {
    setSaving(true);
    try {
      await offboardingService.requestAccessDeactivation(offboarding.id, { scheduledDate: scheduledDate || undefined });
      toast('Access deactivation requested.');
      onUpdated();
    } catch (err) {
      toast(err.message || 'Failed to request deactivation.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    setSaving(true);
    try {
      await offboardingService.updateAccessDeactivation(offboarding.id, { status });
      toast('Access status updated.');
      onUpdated();
    } catch (err) {
      toast(err.message || 'Failed to update access status.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="System Access" action={<StatusBadge status={offboarding.accessDeactivationStatus} />} />
      <div className="mt-2 divide-y divide-line">
        <InfoRow icon={Calendar} label="Requested" value={formatDate(offboarding.accessDeactivation?.requestedDate)} />
        <InfoRow icon={Calendar} label="Scheduled" value={formatDate(offboarding.accessDeactivation?.scheduledDate)} />
        <InfoRow icon={Calendar} label="Completed" value={formatDate(offboarding.accessDeactivation?.completedDate)} />
      </div>
      {canManage && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input label="Schedule deactivation for" type="date" value={scheduledDate} onChange={setScheduledDate} className="sm:w-56" />
            <Button size="sm" variant="secondary" loading={saving} onClick={handleRequest}>Request / Schedule</Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select label="Update status to" value={status} onChange={setStatus} options={ACCESS_STATUSES} className="sm:w-56" />
            <Button size="sm" loading={saving} onClick={handleUpdate}>Update</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function SettlementTab({ offboardingId, canView }) {
  const { data, loading, error, refetch } = useFetch(
    () => (canView ? offboardingService.getSettlementPreparation(offboardingId) : Promise.resolve(null)),
    [offboardingId, canView]
  );

  if (!canView) {
    return <ErrorState title="No access" message="Settlement preparation data is only visible to HR and Finance." />;
  }
  if (loading) return <CardSkeleton lines={5} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Readiness" action={<StatusBadge status={data.status} />} />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={Calendar} label="Last working date" value={formatDate(data.lastWorkingDate)} />
          <InfoRow icon={ShieldCheck} label="Clearance status" value={<StatusBadge status={data.clearanceStatus} />} />
          <InfoRow icon={Package} label="Asset clearance" value={<StatusBadge status={data.assetClearanceStatus} />} />
          <InfoRow icon={FolderOpen} label="Document clearance" value={<StatusBadge status={data.documentClearanceStatus} />} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Leave Balance Reference" />
        {!data.leaveBalanceReference || data.leaveBalanceReference.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-500">No leave balance records found.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {data.leaveBalanceReference.map((b, i) => (
              <li key={i} className="py-2 text-[13px] text-ink-700">
                {b.leaveType}: {b.remainingDays} days remaining ({b.year})
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="lg:col-span-2">
        <p className="text-xs text-ink-400">
          This is a preparation snapshot for the future Payroll &amp; Salary Management module — no salary calculation is performed here.
        </p>
      </Card>
    </div>
  );
}

function TimelineTab({ offboardingId }) {
  const { data: events, loading, error, refetch } = useFetch(() => offboardingService.getTimeline(offboardingId), [offboardingId]);

  if (loading) return <CardSkeleton lines={4} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!events || events.length === 0) {
    return (
      <Card padding={false}>
        <EmptyState icon={HistoryIcon} title="No history yet" message="Activity on this offboarding will appear here." />
      </Card>
    );
  }

  return (
    <Card padding={false}>
      <ul className="divide-y divide-line">
        {events.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 px-5 py-4">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink-900">{entry.action.replaceAll('_', ' ')}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {entry.userId ? fullName(entry.userId) : 'System'} · {formatDate(entry.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function OffboardingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [actionSaving, setActionSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: offboarding, loading, error, refetch } = useFetch(() => offboardingService.getOffboardingById(id), [id]);

  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_UPDATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_APPROVED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_REJECTED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_CANCELLED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_CLEARANCE_UPDATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_ASSET_CLEARANCE_UPDATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_EXIT_INTERVIEW_UPDATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_ACCESS_UPDATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_KNOWLEDGE_TRANSFER_UPDATED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.OFFBOARDING_COMPLETED, refetch, [refetch]);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={4} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      </div>
    );
  }
  if (error) {
    return <ErrorState title="Offboarding record not found" message="This record may have been removed or the link is incorrect." onRetry={refetch} />;
  }

  const canEditRecord = FULL_ROLES.includes(user?.role);
  const canSubmit = canEditRecord && ['DRAFT', 'INITIATED'].includes(offboarding.status);
  const canCancel = canEditRecord && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(offboarding.status);
  const canComplete = canEditRecord && offboarding.status === 'FINAL_REVIEW';

  const managerId = offboarding.employeeId?.managerId;
  const canGiveManagerApproval =
    offboarding.status === 'PENDING_APPROVAL' &&
    offboarding.managerApproval?.required &&
    offboarding.managerApproval?.status === 'PENDING' &&
    (canEditRecord || (user?.role === 'MANAGER' && managerId && managerId === user?.employeeId));
  const canGiveHRApproval =
    offboarding.status === 'PENDING_APPROVAL' &&
    offboarding.hrApproval?.status === 'PENDING' &&
    canEditRecord &&
    (!offboarding.managerApproval?.required || offboarding.managerApproval?.status === 'APPROVED');
  const canReject = canEditRecord && offboarding.status === 'PENDING_APPROVAL';

  async function handleSubmit() {
    setActionSaving(true);
    try {
      await offboardingService.submitOffboarding(id);
      toast('Submitted for approval.');
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to submit.', 'error');
    } finally {
      setActionSaving(false);
    }
  }

  async function handleApprove(level) {
    setActionSaving(true);
    try {
      await offboardingService.approveOffboarding(id, { level });
      toast('Approval recorded.');
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to approve.', 'error');
    } finally {
      setActionSaving(false);
    }
  }

  async function handleReject(reason) {
    setActionSaving(true);
    try {
      await offboardingService.rejectOffboarding(id, { level: 'HR', reason });
      toast('Offboarding rejected.');
      setRejectOpen(false);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to reject.', 'error');
    } finally {
      setActionSaving(false);
    }
  }

  async function handleCancel(reason) {
    setActionSaving(true);
    try {
      await offboardingService.cancelOffboarding(id, reason);
      toast('Offboarding cancelled.');
      setCancelOpen(false);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to cancel.', 'error');
    } finally {
      setActionSaving(false);
    }
  }

  async function handleComplete() {
    setActionSaving(true);
    try {
      await offboardingService.completeOffboarding(id);
      toast('Offboarding completed.');
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to complete offboarding.', 'error');
    } finally {
      setActionSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={offboarding.employeeId ? fullName(offboarding.employeeId) : 'Offboarding'}
        breadcrumbs={[{ label: 'Offboarding', to: '/offboarding' }, { label: offboarding.offboardingType }]}
        actions={
          <>
            {canSubmit && (
              <Button variant="secondary" loading={actionSaving} onClick={handleSubmit}>
                <Send size={14} />
                Submit for Approval
              </Button>
            )}
            {canReject && (
              <Button variant="dangerGhost" onClick={() => setRejectOpen(true)} disabled={actionSaving}>
                <XCircle size={14} />
                Reject
              </Button>
            )}
            {canComplete && (
              <Button loading={actionSaving} onClick={handleComplete}>
                <CheckCircle2 size={14} />
                Complete Offboarding
              </Button>
            )}
            {canCancel && (
              <Button variant="secondary" onClick={() => setCancelOpen(true)} disabled={actionSaving}>
                <Ban size={14} />
                Cancel
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink-900">
                {offboarding.employeeId ? fullName(offboarding.employeeId) : 'Unknown employee'}
              </h2>
              <StatusBadge status={offboarding.status} />
              <StatusBadge status={offboarding.offboardingType} />
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-500">
              <Clock size={13} />
              Last working day {formatDate(offboarding.lastWorkingDate)}
            </p>
          </div>
          <div className="flex gap-6 sm:text-right">
            <div>
              <p className="text-xs text-ink-400">Approval</p>
              <div className="mt-0.5"><StatusBadge status={offboarding.approvalStatus} /></div>
            </div>
            <div>
              <p className="text-xs text-ink-400">Clearance</p>
              <div className="mt-0.5"><StatusBadge status={offboarding.clearanceStatus} /></div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-5" />

      {activeTab === 'overview' && <OverviewTab offboarding={offboarding} />}
      {activeTab === 'approval' && (
        <ApprovalTab
          offboarding={offboarding}
          canGiveManagerApproval={canGiveManagerApproval}
          canGiveHRApproval={canGiveHRApproval}
          onApprove={handleApprove}
          saving={actionSaving}
        />
      )}
      {activeTab === 'clearances' && <ClearancesTab offboarding={offboarding} user={user} onUpdated={refetch} />}
      {activeTab === 'assets' && <AssetsTab offboardingId={id} canManage={canEditRecord} onChanged={refetch} />}
      {activeTab === 'exit-interview' && <ExitInterviewTab offboarding={offboarding} user={user} onUpdated={refetch} />}
      {activeTab === 'knowledge-transfer' && <KnowledgeTransferTab offboarding={offboarding} user={user} onUpdated={refetch} />}
      {activeTab === 'documents' && <DocumentsTab offboarding={offboarding} user={user} onChanged={refetch} />}
      {activeTab === 'access' && <AccessTab offboarding={offboarding} user={user} onUpdated={refetch} />}
      {activeTab === 'settlement' && <SettlementTab offboardingId={id} canView={SETTLEMENT_ROLES.includes(user?.role)} />}
      {activeTab === 'timeline' && <TimelineTab offboardingId={id} />}

      <ReasonModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        title="Reject Offboarding"
        label="Rejection reason"
        saving={actionSaving}
      />
      <ReasonModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Offboarding"
        label="Cancellation reason"
        saving={actionSaving}
      />
    </div>
  );
}
