import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { assetService } from '../../services/assetService';
import { assetCategoryService } from '../../services/assetCategoryService';
import { assetVendorService } from '../../services/assetVendorService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { formatDateForInput } from '../../utils/format';
import { ASSET_CONDITIONS, CURRENCIES } from '../../data/assets';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { LoadingState, ErrorState } from '../../components/ui/States';

const INITIAL_FORM = {
  name: '',
  assetTag: '',
  serialNumber: '',
  categoryId: '',
  brand: '',
  model: '',
  description: '',
  purchaseDate: '',
  purchasePrice: '',
  currency: 'INR',
  vendorId: '',
  purchaseOrderNumber: '',
  invoiceNumber: '',
  warrantyStartDate: '',
  warrantyEndDate: '',
  location: '',
  condition: 'NEW',
  notes: '',
};

export default function AssetForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);

  const { data: categories } = useFetch(() => assetCategoryService.getCategories(), []);
  const { data: vendorsResponse } = useFetch(() => assetVendorService.getVendors({ limit: 100 }), []);
  const vendors = vendorsResponse?.data || [];

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    setLoading(true);
    assetService
      .getAssetById(id)
      .then((asset) => {
        if (cancelled) return;
        setForm({
          name: asset.name || '',
          assetTag: asset.assetTag || '',
          serialNumber: asset.serialNumber || '',
          categoryId: asset.categoryId?.id || asset.categoryId?._id || '',
          brand: asset.brand || '',
          model: asset.model || '',
          description: asset.description || '',
          purchaseDate: formatDateForInput(asset.purchaseDate),
          purchasePrice: asset.purchasePrice ?? '',
          currency: asset.currency || 'INR',
          vendorId: asset.vendorId?.id || asset.vendorId?._id || '',
          purchaseOrderNumber: asset.purchaseOrderNumber || '',
          invoiceNumber: asset.invoiceNumber || '',
          warrantyStartDate: formatDateForInput(asset.warrantyStartDate),
          warrantyEndDate: formatDateForInput(asset.warrantyEndDate),
          location: asset.location || '',
          condition: asset.condition || 'NEW',
          notes: asset.notes || '',
        });
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const setField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }, []);

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Asset name is required';
    if (!form.categoryId) next.categoryId = 'Category is required';
    if (form.purchasePrice !== '' && Number(form.purchasePrice) < 0) next.purchasePrice = 'Purchase price cannot be negative';
    if (form.warrantyStartDate && form.warrantyEndDate && new Date(form.warrantyEndDate) < new Date(form.warrantyStartDate)) {
      next.warrantyEndDate = 'Warranty end date cannot be before the start date';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const isValid = form.name.trim() && form.categoryId;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        assetTag: form.assetTag || undefined,
        serialNumber: form.serialNumber || undefined,
        categoryId: form.categoryId,
        brand: form.brand || undefined,
        model: form.model || undefined,
        description: form.description || undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchasePrice: form.purchasePrice === '' ? undefined : Number(form.purchasePrice),
        currency: form.currency,
        vendorId: form.vendorId || undefined,
        purchaseOrderNumber: form.purchaseOrderNumber || undefined,
        invoiceNumber: form.invoiceNumber || undefined,
        warrantyStartDate: form.warrantyStartDate || undefined,
        warrantyEndDate: form.warrantyEndDate || undefined,
        location: form.location || undefined,
        condition: form.condition,
        notes: form.notes || undefined,
      };
      if (isEdit) {
        await assetService.updateAsset(id, payload);
        toast(`${form.name} has been updated.`);
        navigate(`/assets/${id}`);
      } else {
        const created = await assetService.createAsset(payload);
        toast(`${form.name} has been registered.`);
        navigate(`/assets/${created.id}`);
      }
    } catch (err) {
      toast(err.message || 'Failed to save asset. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading asset…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => navigate('/assets')} />;

  const categoryOptions = (categories || []).map((c) => ({ value: c.id, label: c.name }));
  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={isEdit ? 'Edit Asset' : 'Add Asset'}
        subtitle={isEdit ? 'Update this asset’s details' : 'Register a new asset in your inventory'}
        breadcrumbs={[{ label: 'Assets', to: '/assets' }, { label: isEdit ? 'Edit' : 'New' }]}
      />

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="space-y-4">
            <CardHeader title="Basic information" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Asset name"
                required
                value={form.name}
                onChange={(v) => setField('name', v)}
                error={errors.name}
                placeholder="e.g. MacBook Pro 16&quot;"
                className="sm:col-span-2"
              />
              <Input
                label="Asset tag"
                value={form.assetTag}
                onChange={(v) => setField('assetTag', v)}
                placeholder="Auto-generated if left blank"
                uppercase
              />
              <Input
                label="Serial number"
                value={form.serialNumber}
                onChange={(v) => setField('serialNumber', v)}
                placeholder="e.g. C02XXXXXXXX"
              />
              <Select
                label="Category"
                required
                value={form.categoryId}
                onChange={(v) => setField('categoryId', v)}
                error={errors.categoryId}
                options={categoryOptions}
                placeholder="Select category"
              />
              <Select
                label="Condition"
                value={form.condition}
                onChange={(v) => setField('condition', v)}
                options={ASSET_CONDITIONS}
              />
              <Input label="Brand" value={form.brand} onChange={(v) => setField('brand', v)} placeholder="e.g. Apple" />
              <Input label="Model" value={form.model} onChange={(v) => setField('model', v)} placeholder="e.g. M3 Pro" />
              <Input
                label="Description"
                value={form.description}
                onChange={(v) => setField('description', v)}
                className="sm:col-span-2"
              />
            </div>
          </Card>

          <Card className="space-y-4">
            <CardHeader title="Purchase information" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Purchase date"
                type="date"
                value={form.purchaseDate}
                onChange={(v) => setField('purchaseDate', v)}
              />
              <Input
                label="Purchase price"
                type="number"
                value={form.purchasePrice}
                onChange={(v) => setField('purchasePrice', v)}
                error={errors.purchasePrice}
                placeholder="0.00"
              />
              <Select
                label="Currency"
                value={form.currency}
                onChange={(v) => setField('currency', v)}
                options={CURRENCIES}
              />
              <Select
                label="Vendor"
                value={form.vendorId}
                onChange={(v) => setField('vendorId', v)}
                options={vendorOptions}
                placeholder="Select vendor"
              />
              <Input
                label="Purchase order #"
                value={form.purchaseOrderNumber}
                onChange={(v) => setField('purchaseOrderNumber', v)}
              />
              <Input label="Invoice #" value={form.invoiceNumber} onChange={(v) => setField('invoiceNumber', v)} />
            </div>
          </Card>

          <Card className="space-y-4">
            <CardHeader title="Warranty" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Warranty start"
                type="date"
                value={form.warrantyStartDate}
                onChange={(v) => setField('warrantyStartDate', v)}
              />
              <Input
                label="Warranty end"
                type="date"
                value={form.warrantyEndDate}
                onChange={(v) => setField('warrantyEndDate', v)}
                error={errors.warrantyEndDate}
              />
            </div>
          </Card>

          <Card className="space-y-4">
            <CardHeader title="Additional details" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Location"
                value={form.location}
                onChange={(v) => setField('location', v)}
                placeholder="e.g. Bengaluru HQ, 3rd floor"
                className="sm:col-span-2"
              />
              <Input
                label="Notes"
                textarea
                value={form.notes}
                onChange={(v) => setField('notes', v)}
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
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Register asset'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
