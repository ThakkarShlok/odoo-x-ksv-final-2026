import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notifications';
import type { NotificationItem } from '../api/notifications';

const POLL_MS = 30_000;

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState<number>(0);

  const load = useCallback(async () => {
    try {
      const { data, meta } = await fetchNotifications();
      setItems(data);
      setUnread(meta?.unreadCount ?? 0);
    } catch {
      // transient failure: do not break the whole app chrome
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function onMarkOne(id: number) {
    setUnread((n) => Math.max(0, n - 1));
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, readStatus: true } : it)));
    try {
      await markNotificationRead(id);
    } finally {
      load();
    }
  }

  async function onMarkAll() {
    setUnread(0);
    setItems((prev) => prev.map((it) => ({ ...it, readStatus: true })));
    try {
      await markAllNotificationsRead();
    } finally {
      load();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative rounded-md p-2 text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-bold text-accent-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="px-0 py-0">Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <button
              onClick={onMarkAll}
              className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          items.slice(0, 8).map((n) => (
            <DropdownMenuItem
              key={n.id}
              onSelect={(e: Event) => {
                e.preventDefault();
                if (!n.readStatus) onMarkOne(n.id);
              }}
            >
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.readStatus ? 'bg-transparent' : 'bg-accent'}`}
                aria-hidden="true"
              />
              <span className="flex flex-col gap-0.5">
                <span className={n.readStatus ? 'text-muted-foreground' : 'font-medium text-foreground'}>
                  {n.message}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
