import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Plus, FileText, Calendar, User, Star } from 'lucide-react';
import { performanceReviewService } from '../../services/performanceReviewService';

export default function PerformanceReviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const response = await performanceReviewService.getReviews();
      setReviews(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load performance reviews');
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
        title="Performance Reviews"
        description="Manage performance reviews and assessments"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reviews.map((review) => (
          <ReviewCard key={review._id} review={review} />
        ))}
      </div>

      {reviews.length === 0 && (
        <div className="text-center py-12">
          <p className="text-ink-500">No performance reviews found</p>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }) {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRatingStars = (rating) => {
    if (!rating) return null;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={16}
          className={i <= rating ? 'fill-warning-400 text-warning-400' : 'text-ink-300'}
        />
      );
    }
    return stars;
  };

  return (
    <div className="bg-surface rounded-lg border border-line p-6 hover:border-brand-300 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-ink-900">{review.reviewType}</h3>
        <StatusBadge status={review.status} />
      </div>

      <div className="space-y-3 text-sm mb-4">
        <div className="flex items-center text-ink-600">
          <User size={16} className="mr-2" />
          <span>
            {review.employeeId?.firstName} {review.employeeId?.lastName}
          </span>
        </div>
        <div className="flex items-center text-ink-600">
          <FileText size={16} className="mr-2" />
          <span>{review.cycleId?.name || 'Performance Cycle'}</span>
        </div>
        {review.completedAt && (
          <div className="flex items-center text-ink-600">
            <Calendar size={16} className="mr-2" />
            <span>Completed: {formatDate(review.completedAt)}</span>
          </div>
        )}
      </div>

      {review.overallRating && (
        <div className="mb-4">
          <p className="text-sm text-ink-600 mb-1">Overall Rating</p>
          <div className="flex items-center gap-1">
            {getRatingStars(review.overallRating)}
          </div>
        </div>
      )}

      {review.overallScore && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-ink-600">Overall Score</span>
            <span className="font-medium text-ink-900">{review.overallScore}/100</span>
          </div>
          <div className="w-full h-2 bg-ink-200 rounded-full">
            <div
              className="h-2 bg-brand-500 rounded-full"
              style={{ width: `${review.overallScore}%` }}
            />
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-line">
        <p className="text-xs text-ink-500">
          Reviewer: {review.reviewerId?.firstName} {review.reviewerId?.lastName}
        </p>
      </div>
    </div>
  );
}
