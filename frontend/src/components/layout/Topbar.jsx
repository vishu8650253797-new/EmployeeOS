import { useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, HelpCircle, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import Avatar from '../ui/Avatar';
import Dropdown, { DropdownItem, DropdownSeparator } from '../ui/Dropdown';
import Tooltip from '../ui/Tooltip';

export default function Topbar({ onOpenMobileNav }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadNotifications() {
    try {
      const [listRes, countRes] = await Promise.all([
        notificationService.getNotifications({ limit: 20 }),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(listRes.data || []);
      setUnreadCount(countRes.data?.count || 0);
    } catch {
      // silently fail; fallback to empty list
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  useSocketEvent(SOCKET_EVENTS.NOTIFICATION_NEW, () => loadNotifications(), []);

  async function handleMarkAsRead(notification) {
    if (notification.isRead) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(prev - 1, 0));
    try {
      await notificationService.markAsRead(notification.id);
    } catch {
      loadNotifications();
    }
  }

  async function handleMarkAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationService.markAllAsRead();
    } catch {
      loadNotifications();
    }
  }

  async function handleLogout() {
    await logout();
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="focus-ring rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-400/10 hover:text-ink-900 lg:hidden"
      >
        <Menu size={19} />
      </button>

      {/* Global search */}
      <div className="relative hidden max-w-md flex-1 md:block">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Search EmployeeOS"
          placeholder="Search employees, departments…"
          className="focus-ring h-9 w-full rounded-lg border border-line bg-canvas pl-9 pr-12 text-sm placeholder:text-ink-400 transition-colors hover:border-line-strong [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-400 lg:block">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip label="Search" className="md:hidden">
          <button
            type="button"
            aria-label="Search"
            className="focus-ring rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-400/10 hover:text-ink-900"
          >
            <Search size={18} />
          </button>
        </Tooltip>

        <Tooltip label="Help" className="hidden sm:inline-flex">
          <button
            type="button"
            aria-label="Help"
            className="focus-ring rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-400/10 hover:text-ink-900"
          >
            <HelpCircle size={18} />
          </button>
        </Tooltip>

        {/* Notifications */}
        <Dropdown
          width="w-80"
          trigger={({ open }) => (
            <button
              type="button"
              aria-label={`Notifications (${unreadCount} unread)`}
              aria-expanded={open}
              className="focus-ring relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-400/10 hover:text-ink-900"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-danger-600 ring-2 ring-surface" />
              )}
            </button>
          )}
        >
          <div className="flex items-center justify-between gap-2 px-3.5 py-2">
            <p className="text-[13px] font-semibold text-ink-900">Notifications</p>
            <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
              {unreadCount} new
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="focus-ring rounded px-1 text-[11px] font-medium text-brand-700 transition-colors hover:text-brand-800"
              >
                Mark all read
              </button>
            )}
          </div>
          <DropdownSeparator />
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-3.5 py-4 text-center text-xs text-ink-500">No notifications</p>
            )}
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleMarkAsRead(notification)}
                className={`flex w-full gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-canvas ${
                  notification.isRead ? 'opacity-70' : ''
                }`}
              >
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    notification.isRead ? 'bg-line-strong' : 'bg-brand-600'
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink-900">{notification.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{notification.message}</p>
                  <p className="mt-1 text-[11px] text-ink-400">{new Date(notification.createdAt).toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>
        </Dropdown>

        {/* User menu */}
        <Dropdown
          trigger={({ open }) => (
            <button
              type="button"
              aria-label="Account menu"
              aria-expanded={open}
              className="focus-ring ml-1 flex items-center gap-2 rounded-lg p-1 pr-1.5 transition-colors hover:bg-ink-400/10"
            >
              <Avatar name={user?.name} size="sm" />
              <span className="hidden text-[13px] font-medium text-ink-700 sm:block">
                {user?.name?.split(' ')[0]}
              </span>
              <ChevronDown
                size={14}
                className={`hidden text-ink-400 transition-transform sm:block ${open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          )}
        >
          <div className="px-3.5 py-2.5">
            <p className="truncate text-[13px] font-semibold text-ink-900">{user?.name}</p>
            <p className="truncate text-xs text-ink-500">{user?.email}</p>
          </div>
          <DropdownSeparator />
          <DropdownItem icon={User} onClick={() => navigate('/settings')}>
            My Profile
          </DropdownItem>
          <DropdownItem icon={Settings} onClick={() => navigate('/settings')}>
            Account Settings
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={LogOut} danger onClick={handleLogout}>
            Logout
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
