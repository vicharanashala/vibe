import { Link } from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCheckIcon,
  CheckCircle2Icon,
  ClockIcon,
  InfoIcon,
  Loader2Icon,
  MailPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import {
  useAcceptInvite,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  usePendingInvites,
  type Notification,
  type PendingInvite,
} from './queries';

const TYPE_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  ejection: { icon: AlertTriangleIcon, className: 'text-destructive' },
  reinstatement: { icon: CheckCircle2Icon, className: 'text-emerald-600 dark:text-emerald-400' },
  inactivity_warning: { icon: ClockIcon, className: 'text-amber-600 dark:text-amber-400' },
  policy_created: { icon: InfoIcon, className: 'text-primary' },
  policy_updated: { icon: InfoIcon, className: 'text-primary' },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const pendingInvites = usePendingInvites();
  const acceptInvite = useAcceptInvite();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const inviteCount = pendingInvites.data?.length ?? 0;
  const unreadCount = (notifications.data?.unreadCount ?? 0) + inviteCount;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-9 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <BellIcon className="size-[18px]" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="ring-foreground/10 bg-popover text-popover-foreground absolute top-full right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-md shadow-lg ring-1">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <p className="text-sm font-medium">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {markAllRead.isPending ? <Loader2Icon className="size-3 animate-spin" aria-hidden /> : <CheckCheckIcon className="size-3" aria-hidden />}
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {pendingInvites.data?.map((invite) => (
              <InviteRow
                key={invite.inviteId}
                invite={invite}
                onAccept={() => acceptInvite.mutate(invite.inviteId)}
                accepting={acceptInvite.isPending && acceptInvite.variables === invite.inviteId}
              />
            ))}
            {notifications.isPending && <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>}
            {notifications.isError && <p className="p-4 text-center text-sm text-destructive">Couldn't load notifications.</p>}
            {inviteCount === 0 && notifications.data?.notifications.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
            )}
            {notifications.data?.notifications.map((n) => (
              <NotificationRow key={n._id} notification={n} onMarkRead={() => markRead.mutate(n._id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InviteRow({
  invite,
  onAccept,
  accepting,
}: {
  invite: PendingInvite;
  onAccept: () => void;
  accepting: boolean;
}) {
  return (
    <div className="flex gap-2.5 border-b border-border bg-primary/5 px-3 py-2.5 text-left">
      <MailPlusIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Course invite</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          You've been invited as {invite.role.toLowerCase()} to{' '}
          <span className="font-medium text-foreground">{invite.course?.name ?? 'a course'}</span>
        </p>
        <button
          type="button"
          onClick={onAccept}
          disabled={accepting}
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {accepting && <Loader2Icon className="size-3 animate-spin" aria-hidden />}
          Accept
        </button>
      </div>
    </div>
  );
}

function NotificationRow({ notification, onMarkRead }: { notification: Notification; onMarkRead: () => void }) {
  const { icon: Icon, className } = TYPE_ICON[notification.type] ?? { icon: InfoIcon, className: 'text-muted-foreground' };
  const body = (
    <div
      className={cn(
        'flex gap-2.5 border-b border-border px-3 py-2.5 text-left last:border-b-0',
        !notification.read && 'bg-primary/5',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{notification.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{notification.message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(notification.createdAt)}</p>
      </div>
      {!notification.read && <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
    </div>
  );

  if (notification.read) {
    return notification.courseId && notification.courseVersionId ? (
      <Link to="/courses/$courseId/$versionId" params={{ courseId: notification.courseId, versionId: notification.courseVersionId }}>
        {body}
      </Link>
    ) : (
      body
    );
  }

  return (
    <button type="button" onClick={onMarkRead} className="block w-full">
      {body}
    </button>
  );
}
