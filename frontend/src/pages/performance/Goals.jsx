import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/layout/PageHeader';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Plus, Target, TrendingUp, Calendar } from 'lucide-react';
import { goalService } from '../../services/goalService';

export default function Goals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const response = await goalService.getGoals();
      setGoals(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load goals');
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
        title="Goals"
        description="Track and manage employee goals"
        action={
          canManage && (
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} className="mr-2" />
              New Goal
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => (
          <GoalCard key={goal._id} goal={goal} />
        ))}
      </div>

      {goals.length === 0 && (
        <div className="text-center py-12">
          <p className="text-ink-500">No goals found</p>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal }) {
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
        <h3 className="text-lg font-semibold text-ink-900">{goal.title}</h3>
        <PriorityBadge priority={goal.priority} />
      </div>

      <p className="text-sm text-ink-500 mb-4">{goal.description}</p>

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-ink-600">Progress</span>
          <span className="font-medium text-ink-900">{goal.progressPercentage}%</span>
        </div>
        <div className="w-full h-2 bg-ink-200 rounded-full">
          <div
            className="h-2 bg-brand-500 rounded-full transition-all"
            style={{ width: `${goal.progressPercentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center text-ink-600">
          <Target size={16} className="mr-2" />
          <span>{goal.category}</span>
        </div>
        <div className="flex items-center text-ink-600">
          <Calendar size={16} className="mr-2" />
          <span>Due: {formatDate(goal.dueDate)}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-line">
        <StatusBadge status={goal.status} />
      </div>
    </div>
  );
}
