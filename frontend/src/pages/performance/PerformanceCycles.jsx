import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Plus, Calendar, Users, BarChart3 } from 'lucide-react';
import { performanceCycleService } from '../../services/performanceCycleService';

export default function PerformanceCycles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN';

  useEffect(() => {
    loadCycles();
  }, []);

  const loadCycles = async () => {
    try {
      setLoading(true);
      const response = await performanceCycleService.getCycles();
      setCycles(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load performance cycles');
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
        title="Performance Cycles"
        description="Manage performance review cycles"
        action={
          canManage && (
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} className="mr-2" />
              New Cycle
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cycles.map((cycle) => (
          <CycleCard key={cycle._id} cycle={cycle} />
        ))}
      </div>

      {cycles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-ink-500">No performance cycles found</p>
        </div>
      )}
    </div>
  );
}

function CycleCard({ cycle }) {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-surface rounded-lg border border-line p-6 hover:border-brand-300 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-ink-900">{cycle.name}</h3>
        <StatusBadge status={cycle.status} />
      </div>

      <p className="text-sm text-ink-500 mb-4">{cycle.description}</p>

      <div className="space-y-2 text-sm">
        <div className="flex items-center text-ink-600">
          <Calendar size={16} className="mr-2" />
          <span>{formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}</span>
        </div>
        <div className="flex items-center text-ink-600">
          <BarChart3 size={16} className="mr-2" />
          <span>{cycle.type}</span>
        </div>
      </div>
    </div>
  );
}
