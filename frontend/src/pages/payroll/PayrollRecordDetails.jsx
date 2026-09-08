import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { payslipService } from '../../services/payslipService';
import { payrollRunService } from '../../services/payrollRunService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrencyFromMinorUnits } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/Badge';
import { ErrorState, LoadingState } from '../../components/ui/States';

const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const PREPARE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];

function LineItemTable({ title, items, currency }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <h3 className="mb-3 text-sm font-semibold text-ink-900">{title}</h3>
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-500">None</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.componentId} className="flex items-center justify-between text-[13px]">
              <span className="text-ink-700">{item.name}{item.isProrated && <span className="ml-1.5 text-xs text-warning-600">(prorated)</span>}</span>
              <span className="font-medium text-ink-900">{formatCurrencyFromMinorUnits(item.amountMinorUnits, currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdjustModal({ open, record, runId, onClose, onAdjusted }) {
  const { toast } = useToast();
  const [earnings, setEarnings] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !record) return;
    setEarnings(record.earnings.map((e) => ({ ...e, displayValue: e.amountMinorUnits / 100 })));
    setDeductions(record.deductions.map((d) => ({ ...d, displayValue: d.amountMinorUnits / 100 })));
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await payrollRunService.updateRecord(runId, record.id, {
        adjustmentNote: note,
        earnings: earnings.map((e) => ({ ...e, amountMinorUnits: Math.round(e.displayValue * 100) })),
        deductions: deductions.map((d) => ({ ...d, amountMinorUnits: Math.round(d.displayValue * 100) })),
      });
      toast.success('Payroll record adjusted.');
      onAdjusted();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to adjust record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust payroll record"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="adjust-record-form" loading={saving} disabled={!note.trim()}>Save adjustment</Button>
        </>
      }
    >
      <form id="adjust-record-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-700">Earnings</p>
          <div className="space-y-2">
            {earnings.map((e, i) => (
              <div key={e.componentId} className="flex items-center gap-2">
                <span className="flex-1 text-[13px] text-ink-700">{e.name}</span>
                <Input type="number" className="w-32" value={String(e.displayValue)} onChange={(v) => setEarnings((prev) => prev.map((row, idx) => (idx === i ? { ...row, displayValue: parseFloat(v) || 0 } : row)))} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-700">Deductions</p>
          <div className="space-y-2">
            {deductions.map((d, i) => (
              <div key={d.componentId} className="flex items-center gap-2">
                <span className="flex-1 text-[13px] text-ink-700">{d.name}</span>
                <Input type="number" className="w-32" value={String(d.displayValue)} onChange={(v) => setDeductions((prev) => prev.map((row, idx) => (idx === i ? { ...row, displayValue: parseFloat(v) || 0 } : row)))} />
              </div>
            ))}
          </div>
        </div>
        <Input label="Adjustment note" required textarea rows={2} value={note} onChange={setNote} placeholder="Explain the reason for this adjustment…" />
      </form>
    </Modal>
  );
}

export default function PayrollRecordDetails() {
  const { id: runId, recordId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);
  const canPrepare = PREPARE_ROLES.includes(user?.role);

  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data: run } = useFetch(() => (canView ? payrollRunService.getRunById(runId) : Promise.resolve(null)), [canView, runId]);
  const { data: record, loading, error, refetch } = useFetch(() => (canView ? payslipService.getPayslipById(recordId) : Promise.resolve(null)), [canView, recordId]);

  if (!canView) return <ErrorState title="No access" message="You don't have permission to view this payroll record." />;
  if (loading) return <LoadingState label="Loading payroll record…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!record) return null;

  const canAdjust = canPrepare && run?.status === 'CALCULATED';

  return (
    <div>
      <PageHeader
        title={`${record.employeeSnapshot?.firstName || ''} ${record.employeeSnapshot?.lastName || ''}`.trim() || 'Payroll Record'}
        subtitle={record.employeeSnapshot?.jobTitle}
        actions={
          <>
            <StatusBadge status={record.status} />
            {canAdjust && <Button variant="secondary" onClick={() => setAdjustOpen(true)}><Pencil size={14} />Adjust</Button>}
            <Button variant="ghost" onClick={() => navigate(`/payroll/runs/${runId}`)}>Back to run</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Gross', value: record.grossMinorUnits },
          { label: 'Deductions', value: record.totalDeductionsMinorUnits },
          { label: 'Net pay', value: record.netPayMinorUnits },
          { label: 'Employer cost', value: record.totalEmployerCostMinorUnits },
        ].map((cell) => (
          <div key={cell.label} className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-[13px] text-ink-500">{cell.label}</p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-ink-900">{formatCurrencyFromMinorUnits(cell.value, record.currency)}</p>
          </div>
        ))}
      </div>

      {record.adjustmentNote && (
        <div className="mb-5 rounded-xl border border-warning-200 bg-warning-50 p-4 text-[13px] text-warning-700">
          <span className="font-semibold">Adjustment note: </span>{record.adjustmentNote}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LineItemTable title="Earnings" items={record.earnings} currency={record.currency} />
        <LineItemTable title="Deductions" items={record.deductions} currency={record.currency} />
        <LineItemTable title="Employer contributions" items={record.employerContributions} currency={record.currency} />
      </div>

      <div className="mt-4 text-xs text-ink-500">Paid {record.paidDays} of {record.totalDaysInPeriod} days in this period.</div>

      <AdjustModal open={adjustOpen} record={record} runId={runId} onClose={() => setAdjustOpen(false)} onAdjusted={refetch} />
    </div>
  );
}
