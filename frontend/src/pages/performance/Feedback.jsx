import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { MessageSquare, User, Calendar, Shield } from 'lucide-react';
import { feedbackService } from '../../services/feedbackService';

export default function Feedback() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const response = await feedbackService.getFeedback();
      setFeedback(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load feedback');
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
        title="Feedback"
        description="View and manage employee feedback"
      />

      <div className="space-y-4">
        {feedback.map((item) => (
          <FeedbackCard key={item._id} feedback={item} />
        ))}
      </div>

      {feedback.length === 0 && (
        <div className="text-center py-12">
          <p className="text-ink-500">No feedback found</p>
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ feedback }) {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-surface rounded-lg border border-line p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-50 rounded-lg">
            <MessageSquare size={20} className="text-brand-600" />
          </div>
          <div>
            <p className="font-medium text-ink-900">{feedback.type}</p>
            <p className="text-sm text-ink-500">
              {feedback.authorId?.firstName} {feedback.authorId?.lastName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <Shield size={14} />
          <span>{feedback.visibility}</span>
        </div>
      </div>

      <p className="text-ink-700 mb-4">{feedback.content}</p>

      <div className="flex items-center gap-4 text-sm text-ink-500">
        <div className="flex items-center">
          <User size={16} className="mr-1" />
          <span>
            {feedback.employeeId?.firstName} {feedback.employeeId?.lastName}
          </span>
        </div>
        <div className="flex items-center">
          <Calendar size={16} className="mr-1" />
          <span>{formatDate(feedback.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
