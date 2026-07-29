import { History } from 'lucide-react';
import { taskService } from '../../services/taskService';
import { useFetch } from '../../hooks/useFetch';
import { fullName } from '../../utils/format';
import Avatar from '../ui/Avatar';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/States';

const ACTION_LABELS = {
  TASK_CREATED: 'created this task',
  TASK_UPDATED: 'updated this task',
  TASK_ASSIGNED: 'assigned this task',
  TASK_UNASSIGNED: 'unassigned this task',
  STATUS_CHANGED: 'changed the status',
  PRIORITY_CHANGED: 'changed the priority',
  COMMENT_ADDED: 'added a comment',
  COMMENT_UPDATED: 'updated a comment',
  COMMENT_DELETED: 'deleted a comment',
  TASK_COMPLETED: 'completed this task',
};

export default function ActivityTimeline({ taskId }) {
  const { data, loading } = useFetch(
    () => taskService.getTaskActivities(taskId),
    [taskId]
  );
  const activities = data?.data || [];

  if (loading) return <CardSkeleton count={3} />;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <History className="w-5 h-5" />
        Activity Timeline
      </h3>

      {activities.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity yet"
          message="Activity will appear here as the task progresses"
        />
      ) : (
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.id} className="flex gap-3 relative">
              {index !== activities.length - 1 && (
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" />
              )}
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 z-10">
                <Avatar src={activity.actor?.avatar} name={fullName(activity.actor)} size="xs" />
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{fullName(activity.actor)}</span>
                  <span className="text-sm text-gray-600">{ACTION_LABELS[activity.action] || activity.action}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(activity.createdAt).toLocaleString()}
                </span>
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    {Object.entries(activity.metadata).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium">{key}:</span> {String(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
