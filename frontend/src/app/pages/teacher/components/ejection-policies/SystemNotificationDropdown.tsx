import { Button } from "@/components/ui/button";
import SystemNotificationItem from "./SystemNotificationItem";
import { SystemNotification } from "@/types/notification.types";

type Props = {
  notifications: SystemNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
};

export function SystemNotificationDropdown({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  const unread = notifications.filter(n => !n.read);

  return (
    <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-black rounded-lg shadow-lg border border-border dark:border-zinc-700 z-50">
      
      {/* Header (same as InviteDropdown) */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-xs font-semibold text-foreground">
          Notifications
        </span>

        {unread.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            className="h-6 px-2 text-xs text-muted-foreground"
          >
            Mark all read
          </Button>
        )}
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-96 overflow-auto p-1">
        {notifications.length === 0 ? (
          <li className="text-sm text-gray-500 px-2 py-4 text-center">
            No notifications
          </li>
        ) : (
          notifications.map((n) => (
            <SystemNotificationItem
              key={n._id}
              notification={n}
              onMarkRead={onMarkRead}
            />
          ))
        )}
      </ul>
    </div>
  );
}