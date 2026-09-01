import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Boxes, Wallet, ShieldAlert, Wrench } from 'lucide-react';
import { assetAnalyticsService } from '../../services/assetAnalyticsService';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';

const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN', 'MANAGER'];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#84cc16'];

function MetricCard({ title, value, icon: Icon, tone = 'text-ink-900' }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-500">{title}</p>
        <Icon size={16} className="text-ink-400" aria-hidden="true" />
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone}`}>{value}</p>
    </Card>
  );
}

export default function AssetAnalytics() {
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);

  const { data: overview, loading: overviewLoading, error, refetch } = useFetch(
    () => (canView ? assetAnalyticsService.getOverview() : Promise.resolve(null)),
    [canView]
  );
  const { data: statusData } = useFetch(
    () => (canView ? assetAnalyticsService.getStatusBreakdown() : Promise.resolve(null)),
    [canView]
  );
  const { data: categoryData } = useFetch(
    () => (canView ? assetAnalyticsService.getCategoryBreakdown() : Promise.resolve(null)),
    [canView]
  );
  const { data: departmentData } = useFetch(
    () => (canView ? assetAnalyticsService.getDepartmentBreakdown() : Promise.resolve(null)),
    [canView]
  );
  const { data: warrantyData } = useFetch(
    () => (canView ? assetAnalyticsService.getWarrantyAnalytics() : Promise.resolve(null)),
    [canView]
  );

  if (!canView) {
    return <ErrorState title="No access" message="You don't have permission to view asset analytics." />;
  }

  if (overviewLoading && !overview) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
        <CardSkeleton lines={6} />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const totalValueLabel = (overview?.purchaseValueByCurrency || [])
    .map((v) => formatCurrency(v.total).replace('₹', `${v.currency} `))
    .join(' · ') || '—';

  const warrantyPie = warrantyData
    ? [
        { name: 'Active', value: warrantyData.activeCount },
        { name: 'Expiring Soon', value: warrantyData.expiringSoonCount },
        { name: 'Expired', value: warrantyData.expiredCount },
      ]
    : [];

  return (
    <div className="space-y-5">
      <PageHeader title="Asset Analytics" subtitle="Organization-wide asset insights" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Assets" value={overview?.totalAssets ?? 0} icon={Boxes} />
        <MetricCard title="Total Purchase Value" value={totalValueLabel} icon={Wallet} />
        <MetricCard title="Warranty Expiring Soon" value={overview?.warrantyExpiringSoon ?? 0} icon={ShieldAlert} tone="text-warning-700" />
        <MetricCard title="Open Maintenance" value={overview?.openMaintenanceCount ?? 0} icon={Wrench} tone="text-warning-700" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Assets by status" />
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={statusData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" name="Assets" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Warranty status" />
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={warrantyPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {warrantyPie.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Assets by category" />
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="categoryName" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="assigned" stackId="a" fill="#3b82f6" name="Assigned" radius={[4, 4, 0, 0]} />
                <Bar dataKey="available" stackId="a" fill="#10b981" name="Available" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Assets by department" />
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={departmentData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="departmentName" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#8b5cf6" name="Assets" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <CardHeader title="Warranty expiring soon" subtitle={`Within ${warrantyData?.warningDays ?? 30} days`} className="px-5 pt-5" />
        {!warrantyData || warrantyData.expiringAssets.length === 0 ? (
          <EmptyState title="No warranty expirations found" message="Assets with warranties expiring soon will appear here." />
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {warrantyData.expiringAssets.map((asset) => (
              <li key={asset.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-[13px] font-medium text-ink-900">{asset.name}</p>
                  <p className="text-xs text-ink-400">
                    {asset.assetTag} · {asset.vendorId?.name || 'No vendor'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] text-ink-700">{formatDate(asset.warrantyEndDate)}</p>
                  <p className="text-xs text-warning-700">{asset.daysRemaining} day(s) left</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
