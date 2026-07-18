/**
 * WHAT: The top-bar bell. Shows an unread count, opens a dropdown of recent notifications, and
 *   marks them read. Reads from the PERSISTENT /api/notifications store — not toasts.
 * WHY THIS EXISTS ALONGSIDE react-hot-toast: a toast is gone on reload; this survives it. The
 *   bell answers "what happened while I was away?" See notification.service.js on the backend.
 * WHY POLLING AND NOT WEBSOCKETS: a 30s poll is a few lines, has no connection lifecycle to
 *   manage, and is entirely adequate for an internal ERP. WebSockets would be a real-time
 *   upgrade to justify only when the product needs sub-second delivery — a documented Phase-2
 *   change, deliberately not built now.
 */
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
} from '@/api/notifications.js';

const POLL_MS = 30_000;

export function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data, meta } = await fetchNotifications();
      setItems(data);
      setUnread(meta?.unreadCount ?? 0);
    } catch {
      // A transient failure here must not break the whole app chrome. Leave the last known
      // state in place and let the next poll recover.
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function onMarkOne(id) {
    // Optimistic: decrement immediately so the UI feels instant, then reconcile from the server.
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
              onSelect={(e) => {
                // Keep the menu open on click so a user can mark several without reopening.
                e.preventDefault();
                if (!n.readStatus) onMarkOne(n.id);
              }}
            >
              {/* Unread dot: a filled accent dot for unread, an empty slot for read, so the
                  column stays aligned either way. */}
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
