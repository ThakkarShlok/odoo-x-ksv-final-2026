import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useApi } from '@/hooks/useApi';
import { markAsRead, markAllAsRead } from '../api/notifications';
import { formatRelative } from '@/lib/utils';
import toast from 'react-hot-toast';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, meta, refetch } = useApi('/notifications', { params: { limit: 10 } });

  const unreadCount = meta?.unreadCount || 0;
  const notifications = data || [];

  async function handleMarkAllRead() {
    try {
      await markAllAsRead();
      refetch();
    } catch (e) {
      toast.error('Failed to mark all as read');
    }
  }

  async function handleMarkRead(id) {
    try {
      await markAsRead(id);
      refetch();
    } catch (e) {}
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0 rounded-full">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 flex h-2 w-2 rounded-full bg-destructive"></span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${n.status === 'SENT' ? 'bg-primary/5' : ''}`}
                onSelect={(e) => {
                  e.preventDefault();
                  if (n.status === 'SENT') handleMarkRead(n.id);
                }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium text-sm">{n.type.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-muted-foreground">{formatRelative(n.sentAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{n.recipientEmail}</p>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
