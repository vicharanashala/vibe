import { Link } from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCheckIcon,
  CheckCircle2Icon,
  ClockIcon,
  InfoIcon,
  MailPlusIcon,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
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
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const pendingInvites = usePendingInvites();
  const acceptInvite = useAcceptInvite();

  const inviteCount = pendingInvites.data?.length ?? 0;
  const unreadCount = (notifications.data?.unreadCount ?? 0) + inviteCount;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full text-muted-foreground"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
          />
        }
      >
        <BellIcon className="size-[18px]" aria-hidden />
        {unreadCount > 0 && (
          <Badge variant="destructive" className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] gap-0 p-0">
        <PopoverHeader className="flex-row items-center justify-between border-b border-border px-3 py-2">
          <PopoverTitle>Notifications</PopoverTitle>
          {unreadCount > 0 && (
            <Button variant="ghost" size="xs" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              {markAllRead.isPending ? <Spinner className="size-3" /> : <CheckCheckIcon data-icon="inline-start" aria-hidden />}
              Mark all read
            </Button>
          )}
        </PopoverHeader>

        <div className="max-h-96 overflow-y-auto">
          {pendingInvites.data?.map((invite) => (
            <InviteRow
              key={invite.inviteId}
              invite={invite}
              onAccept={() => acceptInvite.mutate(invite.inviteId)}
              accepting={acceptInvite.isPending && acceptInvite.variables === invite.inviteId}
            />
          ))}
          {notifications.isPending && (
            <div className="flex justify-center p-4">
              <Spinner />
            </div>
          )}
          {notifications.isError && <p className="p-4 text-center text-sm text-destructive">Couldn’t load notifications.</p>}
          {notifications.data && inviteCount === 0 && (notifications.data.notifications?.length ?? 0) === 0 && (
            <Empty className="gap-2 p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellIcon />
                </EmptyMedia>
                <EmptyDescription>No notifications yet.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {notifications.data?.notifications?.map((n) => (
            <NotificationRow key={n._id} notification={n} onMarkRead={() => markRead.mutate(n._id)} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
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
          You’ve been invited as {invite.role.toLowerCase()} to{' '}
          <span className="font-medium text-foreground">{invite.course?.name ?? 'a course'}</span>
        </p>
        <Button size="xs" className="mt-2" onClick={onAccept} disabled={accepting}>
          {accepting && <Spinner className="size-3" />}
          Accept
        </Button>
      </div>
    </div>
  );
}

function NotificationRow({ notification, onMarkRead }: { notification: Notification; onMarkRead: () => void }) {
  const { icon: Icon, className } = TYPE_ICON[notification.type] ?? { icon: InfoIcon, className: 'text-muted-foreground' };
  const body = (
    <>
      <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{notification.title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{notification.message}</span>
        <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(notification.createdAt)}</span>
      </span>
      {!notification.read && <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
    </>
  );
  const row = cn(
    'flex h-auto w-full items-start justify-start gap-2.5 rounded-none border-b border-border px-3 py-2.5 text-left font-normal whitespace-normal last:border-b-0',
    !notification.read && 'bg-primary/5',
  );

  if (notification.read) {
    return notification.courseId && notification.courseVersionId ? (
      <Link
        to="/courses/$courseId/$versionId"
        params={{ courseId: notification.courseId, versionId: notification.courseVersionId }}
        className={cn(buttonVariants({ variant: 'ghost' }), row)}
      >
        {body}
      </Link>
    ) : (
      <div className={row}>{body}</div>
    );
  }

  return (
    <Button variant="ghost" className={row} onClick={onMarkRead}>
      {body}
    </Button>
  );
}
