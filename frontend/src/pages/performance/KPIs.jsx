import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Plus, BarChart3, Target, TrendingUp } from 'lucide-react';
import { kpiService } from '../../services/kpiService';

export default function KPIs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [kpis, setKPIs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    try {
      setLoading(true);
      const response = await kpiService.getKPIs();
      setKPIs(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load KPIs');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPIs"
        description="Key Performance Indicators tracking"
        action={
          canManage && (
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} className="mr-2" />
              New KPI
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi._id} kpi={kpi} />
        ))}
      </div>

      {kpis.length === 0 && (
        <div className="text-center py-12">
          <p className="text-ink-500">No KPIs found</p>
        </div>
      )}
    </div>
  );
}

function KPICard({ kpi }) {
  const getScoreColor = (score) => {
    if (score >= 90) return 'bg-success-500';
    if (score >= 70) return 'bg-brand-500';
    if (score >= 50) return 'bg-warning-500';
    return 'bg-danger-500';
  };

  return (
    <div className="bg-surface rounded-lg border border-line p-6 hover:border-brand-300 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-ink-900">{kpi.name}</h3>
        <StatusBadge status={kpi.status} />
      </div>

      <p className="text-sm text-ink-500 mb-4">{kpi.description}</p>

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-ink-600">Score</span>
          <span className="font-medium text-ink-900">{kpi.score}/100</span>
        </div>
        <div className="w-full h-2 bg-ink-200 rounded-full">
          <div
            className={`h-2 ${getScoreColor(kpi.score)} rounded-full transition-all`}
            style={{ width: `${kpi.score}%` }}
          />
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center text-ink-600">
          <BarChart3 size={16} className="mr-2" />
          <span>{kpi.category}</span>
        </div>
        <div className="flex items-center text-ink-600">
          <Target size={16} className="mr-2" />
          <span>Target: {kpi.targetValue} {kpi.unit}</span>
        </div>
        <div className="flex items-center text-ink-600">
          <TrendingUp size={16} className="mr-2" />
          <span>Current: {kpi.currentValue} {kpi.unit}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-line">
        <p className="text-xs text-ink-500">Weight: {kpi.weight}%</p>
      </div>
    </div>
  );
}
