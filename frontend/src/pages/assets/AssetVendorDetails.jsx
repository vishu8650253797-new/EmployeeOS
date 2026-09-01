import { useNavigate, useParams } from 'react-router-dom';
import { Mail, Phone, MapPin, Globe, Wrench, Package } from 'lucide-react';
import { assetVendorService } from '../../services/assetVendorService';
import { useFetch } from '../../hooks/useFetch';
import { formatDate, formatCurrency } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-ink-400">{label}</p>
        <p className="mt-0.5 break-words text-[13px] font-medium text-ink-900">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function AssetVendorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: vendor, loading, error, refetch } = useFetch(() => assetVendorService.getVendorById(id), [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={5} />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Vendor not found" message="This vendor may have been removed or the link is incorrect." onRetry={refetch} />;
  }

  return (
    <div>
      <PageHeader
        title={vendor.name}
        breadcrumbs={[{ label: 'Vendors', to: '/assets/vendors' }, { label: vendor.name }]}
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink-900">{vendor.name}</h2>
              <StatusBadge status={vendor.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </div>
            <p className="mt-0.5 text-[13px] text-ink-500">{vendor.contactPerson}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Contact information" />
          <div className="mt-2 divide-y divide-line">
            <InfoRow icon={Mail} label="Email" value={vendor.email} />
            <InfoRow icon={Phone} label="Phone" value={vendor.phone} />
            <InfoRow icon={Globe} label="Website" value={vendor.website} />
            <InfoRow icon={MapPin} label="Address" value={vendor.address} />
          </div>
          {vendor.notes && <p className="mt-3 whitespace-pre-wrap text-[13px] text-ink-700">{vendor.notes}</p>}
        </Card>

        <Card padding={false}>
          <CardHeader title="Purchased assets" subtitle={`${vendor.assets?.length || 0} asset(s)`} className="px-5 pt-5" />
          {!vendor.assets || vendor.assets.length === 0 ? (
            <EmptyState icon={Package} title="No assets yet" message="Assets purchased from this vendor will appear here." />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {vendor.assets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between px-5 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="focus-ring rounded-lg text-left"
                  >
                    <span className="block text-[13px] font-medium text-ink-900 hover:text-brand-700">{asset.name}</span>
                    <span className="block text-xs text-ink-400">{asset.assetTag}</span>
                  </button>
                  <div className="flex items-center gap-3">
                    {asset.purchasePrice != null && (
                      <span className="text-[13px] text-ink-500">{formatCurrency(asset.purchasePrice)}</span>
                    )}
                    <StatusBadge status={asset.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding={false} className="lg:col-span-2">
          <CardHeader title="Maintenance history" subtitle={`${vendor.maintenanceHistory?.length || 0} record(s)`} className="px-5 pt-5" />
          {!vendor.maintenanceHistory || vendor.maintenanceHistory.length === 0 ? (
            <EmptyState icon={Wrench} title="No maintenance history" message="Repairs and servicing handled by this vendor will appear here." />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {vendor.maintenanceHistory.map((record) => (
                <li key={record.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-ink-900">{record.assetId?.name || 'Unknown asset'}</p>
                    <p className="text-xs text-ink-400">{record.assetId?.assetTag} · {formatDate(record.createdAt)}</p>
                  </div>
                  <StatusBadge status={record.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
