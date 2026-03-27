

    // const onAccept = async (invite) => {
    //     const { data, isLoading, error } = await useProcessInvites(invite.inviteId, 'ACCEPT');
    //     if (!isLoading && !error) {
    //         setStatus("ACCEPTED");
    //         setIsExpanded(false);
    //         window.location.reload();
    //     }
    // };
    

import { useState } from "react";
import { Button } from "./ui/button";
import { Mail, CheckCircle, XCircle } from "lucide-react";

const InviteItem = ({ invite, onAcceptClick, onRejectClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState(invite.inviteStatus);

  const handleToggle = () => {
    if (status === "PENDING") {
      setIsExpanded((prev) => !prev);
    }
  };
  

  return (
    <li
      className={`p-2 rounded transition-colors cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30`}
      onClick={handleToggle}
    >
      <div className="flex items-start gap-2">
        {/* ICON */}
        <div className="mt-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 p-1 shrink-0">
          <Mail className="h-3 w-3 text-blue-700 dark:text-blue-300" />
        </div>

        {/* CONTENT */}
        <div className="flex-1 min-w-0">
          {/* TITLE */}
          <div className="flex items-center justify-between gap-1">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">
              {invite?.course?.name || "Course Invite"}
            </p>

            {status === "PENDING" && (
              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1" />
            )}
          </div>

          {/* MESSAGE */}
          <p className="text-xs text-muted-foreground mt-0.5">
            You have been invited to join this course
          </p>

          {/* STATUS */}
          <p className="text-xs mt-1">
            Status:{" "}
            <span
              className={
                status === "PENDING"
                  ? "text-yellow-600 dark:text-yellow-400"
                  : status === "ACCEPTED"
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              {status}
            </span>
          </p>

          {/* ACTIONS */}
          {isExpanded && status === "PENDING" && (
  <div className="mt-2">
    <Button
      size="sm"
      variant="outline"
      onClick={(e) => {
        e.stopPropagation();
        onAcceptClick(invite);
      }}
      className="h-6 px-2 text-xs hover:bg-yellow-50 hover:border-yellow-600 hover:text-yellow-600 dark:hover:border-yellow-400 dark:hover:text-yellow-400 "
    >
      Check Course
    </Button>
  </div>
)}
        </div>
      </div>
    </li>
  );
};

export default InviteItem;