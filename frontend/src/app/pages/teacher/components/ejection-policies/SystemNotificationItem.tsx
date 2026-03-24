import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SystemNotification } from "@/types/notification.types";
import { AppealDetailsModal } from "./AppealDetailsModal";

type Props = {
  notification: SystemNotification;
  onMarkRead: (id: string) => void;
};

export default function SystemNotificationItem({
  notification,
  onMarkRead,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleToggle = () => {
    setIsExpanded(prev => !prev);

    if (!notification.read) {
      onMarkRead(notification._id);
    }
  };

  const preview = "Click to view appeal";

  return (
    <>
      <li
        onClick={handleToggle}
        className={`flex flex-col px-3 py-2 text-sm rounded transition-all cursor-pointer
          ${!notification.read ? "bg-primary/5" : ""}
          hover:bg-muted/50`}
      >
        <span className="font-medium">{notification.title}</span>

        <span className="text-xs text-gray-500 dark:text-gray-400">
          {notification.message}
        </span>

      
        {notification.type === "appeal_submitted" && notification.extra?.reason && (
          <span className="text-xs text-muted-foreground mt-1 italic">
              {preview}
          </span>
        )}

        <span className="text-[10px] text-gray-400 mt-1">
          {new Date(notification.createdAt).toLocaleDateString()}
        </span>

        {/* EXPANDED */}
        {isExpanded && (
          <div className="mt-2 flex gap-2">

          
            {notification.type === "appeal_submitted" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModal(true);
                }}
              >
                Check Appeal
              </Button>
            )}

            {!notification.read && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(notification._id);
                }}
              >
                Mark as read
              </Button>
            )}
          </div>
        )}
      </li>

   
      {showModal && (
        <AppealDetailsModal
          open={showModal}
          onClose={() => setShowModal(false)}
          notification={notification}
        />
      )}
    </>
  );
}