import { useNavigate, useParams } from 'react-router-dom';
import { Printer, Wallet } from 'lucide-react';
import { payslipService } from '../../services/payslipService';
import { useFetch } from '../../hooks/useFetch';
import { formatCurrencyFromMinorUnits, formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

function LineItemTable({ title, items, currency }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card print:shadow-none">
      <h3 className="mb-3 text-sm font-semibold text-ink-900">{title}</h3>
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-500">None</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.componentId} className="flex items-center justify-between text-[13px]">
              <span className="text-ink-700">{item.name}</span>
              <span className="font-medium text-ink-900">{formatCurrencyFromMinorUnits(item.amountMinorUnits, currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PayslipDetail({ id }) {
  const { data: record, loading, error, refetch } = useFetch(() => payslipService.getMyPayslipById(id), [id]);

  if (loading) return <LoadingState label="Loading payslip…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!record) return null;

  return (
    <div>
      <PageHeader
        title="Payslip"
        subtitle={`Paid ${record.paidDays} of ${record.totalDaysInPeriod} days`}
        actions={<Button variant="secondary" onClick={() => window.print()}><Printer size={15} />Print</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Gross pay', value: record.grossMinorUnits },
          { label: 'Deductions', value: record.totalDeductionsMinorUnits },
          { label: 'Net pay', value: record.netPayMinorUnits },
        ].map((cell) => (
          <div key={cell.label} className="rounded-xl border border-line bg-surface p-4 shadow-card print:shadow-none">
            <p className="text-[13px] text-ink-500">{cell.label}</p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-ink-900">{formatCurrencyFromMinorUnits(cell.value, record.currency)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LineItemTable title="Earnings" items={record.earnings} currency={record.currency} />
        <LineItemTable title="Deductions" items={record.deductions} currency={record.currency} />
      </div>
    </div>
  );
}

function PayslipList() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch(() => payslipService.getMyPayslips({ limit: 50 }), []);
  const payslips = data?.data || [];

  return (
    <div>
      <PageHeader title="My Payslips" subtitle="Your finalized payroll history" />
      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : payslips.length === 0 ? (
          <EmptyState icon={Wallet} title="No payslips yet" message="Your payslips will appear here once payroll has been finalized." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Created</TH>
                <TH>Gross</TH>
                <TH>Net pay</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {payslips.map((p) => (
                <TR key={p.id} className="cursor-pointer" onClick={() => navigate(`/my-payslips/${p.id}`)}>
                  <TD className="font-medium text-ink-900">{formatDate(p.createdAt)}</TD>
                  <TD>{formatCurrencyFromMinorUnits(p.grossMinorUnits, p.currency)}</TD>
                  <TD className="font-medium text-ink-900">{formatCurrencyFromMinorUnits(p.netPayMinorUnits, p.currency)}</TD>
                  <TD><StatusBadge status={p.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>
    </div>
  );
}

export default function MyPayslips() {
  const { id } = useParams();
  return id ? <PayslipDetail id={id} /> : <PayslipList />;
}
