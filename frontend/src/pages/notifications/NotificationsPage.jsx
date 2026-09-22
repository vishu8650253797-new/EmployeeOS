import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { getNotificationRoute } from '../../utils/notificationRoutes';
import { useFetch } from '../../hooks/useFetch';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, loading, error, refetch, setData } = useFetch(
    () => notificationService.getNotifications({ page, limit: PAGE_SIZE, isRead: unreadOnly ? 'false' : undefined }),
    [page, unreadOnly]
  );

  const notifications = data?.data || [];
  const pagination = data?.pagination || { page: 1, total: 0 };

  const refreshOnNew = useCallback(() => refetch(), [refetch]);
  useSocketEvent(SOCKET_EVENTS.NOTIFICATION_NEW, refreshOnNew, [refreshOnNew]);

  async function handleClick(notification) {
    const route = getNotificationRoute(notification.entityType, notification.entityId);
    if (route) navigate(route);

    if (notification.isRead) return;
    setData((prev) => ({
      ...prev,
      data: prev.data.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
    }));
    try {
      await notificationService.markAsRead(notification.id);
    } catch {
      refetch();
    }
  }

  async function handleMarkAllAsRead() {
    setData((prev) => ({ ...prev, data: prev.data.map((n) => ({ ...n, isRead: true })) }));
    try {
      await notificationService.markAllAsRead();
    } catch {
      refetch();
    }
  }

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Updates relevant to you"
        actions={
          <>
            <Button
              variant={unreadOnly ? 'primary' : 'secondary'}
              onClick={() => { setUnreadOnly((v) => !v); setPage(1); }}
            >
              {unreadOnly ? 'Showing unread' : 'Unread only'}
            </Button>
            {hasUnread && (
              <Button variant="secondary" onClick={handleMarkAllAsRead}>Mark all read</Button>
            )}
          </>
        }
      />

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {loading ? (
          <TableSkeleton rows={8} cols={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            message="Notifications relevant to you will show up here."
          />
        ) : (
          <>
            <div className="divide-y divide-line">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleClick(notification)}
                  className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-canvas ${
                    notification.isRead ? 'opacity-70' : ''
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      notification.isRead ? 'bg-line-strong' : 'bg-brand-600'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">{notification.title}</p>
                    <p className="mt-0.5 text-[13px] text-ink-500">{notification.message}</p>
                    <p className="mt-1 text-xs text-ink-400">{formatDate(notification.createdAt, { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                </button>
              ))}
            </div>
            <Pagination page={pagination.page} totalItems={pagination.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
