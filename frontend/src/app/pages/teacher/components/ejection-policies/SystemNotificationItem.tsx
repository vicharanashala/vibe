import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SystemNotification } from "@/types/notification.types";
import { AppealDetailsModal } from "./AppealDetailsModal";
import { useGetAppealById } from "@/hooks/system-notification-hooks";
import { Bell, CheckCircle, Shield, UserCheck, UserX, XCircle } from "lucide-react";
type Props = {
  notification: SystemNotification;
  onMarkRead: (id: string) => void;
};
const getSystemNotificationIcon = (type) => {
  switch (type) {
    case "ejection":
      return <UserX className="h-3 w-3 text-red-600" />;
    case "reinstatement":
      return <UserCheck className="h-3 w-3 text-green-600" />;
    case "policy_created":
    case "policy_updated":
      return <Shield className="h-3 w-3 text-blue-600" />;
    case "appeal_submitted":
      return <Shield className="h-3 w-3 text-purple-600" />;
    case "appeal_approved":
      return <CheckCircle className="h-3 w-3 text-green-600" />;
    case "appeal_rejected":
      return <XCircle className="h-3 w-3 text-red-600" />;
    default:
      return <Bell className="h-3 w-3 text-muted-foreground" />;
  }
};

export default function SystemNotificationItem({
  notification,
  onMarkRead,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const appealId = notification.extra?.appealId;

const { data: appeal } = useGetAppealById(
  appealId,
  !!appealId
);

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
  className={`p-2 rounded transition-all cursor-pointer  duration-200 hover:scale-[1.01]
    ${!notification.read ? "bg-primary/5" : ""}
    hover:bg-muted/50`}
>
  <div className="flex items-start gap-2">

    {/* ICON */}
    <div className="mt-0.5 rounded-full bg-muted p-1 shrink-0">
      {getSystemNotificationIcon(notification.type)}
    </div>

    {/* CONTENT */}
    <div className="flex-1 min-w-0">

      {/* HEADER */}
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-semibold leading-tight">
          {notification.title}
        </p>

        {!notification.read && (
          <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
        )}
      </div>

      {/* MESSAGE */}
      <p className="text-xs text-muted-foreground mt-0.5">
        {notification.message}
      </p>

      {/* PREVIEW */}
      {notification.type === "appeal_submitted" && notification.extra?.reason && (
        <p className="text-xs italic text-muted-foreground mt-1">
          Click to view appeal
        </p>
      )}

      {/* FOOTER */}
      <div className="flex items-center justify-between mt-2">

        <span className="text-[10px] text-muted-foreground">
          {new Date(notification.createdAt).toLocaleDateString()}
        </span>

        {/* ACTIONS */}
        <div className="flex items-center gap-2">

          {notification.type === "appeal_submitted" ? (
  appeal?.status === "PENDING" ? (
    <Button
      size="sm"
      variant="outline"
      className="text-xs h-6 px-2"
      onClick={(e) => {
        e.stopPropagation();
        setShowModal(true);
      }}
    >
      Review
    </Button>
  ) : appeal?.status ? (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full
        ${
          appeal.status === "APPROVED"
            ? "bg-green-100 text-green-700"
            : appeal.status === "REJECTED"
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-600"
        }`}
    >
      {appeal.status}
    </span>
  ) : (
    //  THIS IS WHERE YOUR "Processed" GOES
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
      Processed
    </span>
  )
) : null}

          {!notification.read && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-6 px-2"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification._id);
              }}
            >
              Mark read
            </Button>
          )}
        </div>
      </div>
    </div>
  </div>
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