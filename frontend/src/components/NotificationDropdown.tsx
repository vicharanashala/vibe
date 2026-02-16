import { ApprovedRegistrationNotification } from "@/types/notification.types";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useMarkNotificationAsRead } from "@/hooks/hooks";

type NotificationDropdownProps = {
  pendingNotifications: ApprovedRegistrationNotification[];
  setPendingNotifications: React.Dispatch<React.SetStateAction<ApprovedRegistrationNotification[]>>;
  onClose?: () => void;
};

const NotificationDropdown = ({ pendingNotifications, setPendingNotifications, onClose }: NotificationDropdownProps) => {
  const navigate = useNavigate();
  const { mutate: markAsRead, isPending } = useMarkNotificationAsRead();

  const handleMarkAsRead = (notificationId: string) => {
    // Call API to mark as read
    markAsRead({
      params: { path: { registrationId: notificationId } }
    });
    
    // Remove from pending list and close dropdown
    setPendingNotifications(prev => prev.filter(n => n._id !== notificationId));
    onClose?.();
  };

  const displayNotifications = pendingNotifications;

  return (
    <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-black rounded-lg shadow-lg border border-green-100 dark:border-zinc-700 z-50">
      <ul className="divide-y divide-gray-200 dark:divide-zinc-600 max-h-48 overflow-auto p-1">
        {isPending ? (
          <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">
            Loading...
          </li>
        ) : displayNotifications.length === 0 ? (
          <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">
            No New Notifications
          </li>
        ) : (
          displayNotifications.map((notification: ApprovedRegistrationNotification, idx: number) => (
            <li key={idx} className="p-2 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                    Course Registration Approved
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMarkAsRead(notification._id)}
                  disabled={isPending}
                  className="text-xs h-6 px-2 hover:bg-green-50 hover:border-green-200 hover:text-green-700 flex-shrink-0"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {isPending ? '...' : 'Read'}
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default NotificationDropdown;
