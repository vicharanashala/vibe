
import { useState } from "react";
import { Button } from "./ui/button";
import { Mail } from "lucide-react";


const InviteItem = ({ invite, onAcceptClick, onRejectClick , hasPolicies}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState(invite.inviteStatus);

  const handleToggle = () => {
    if (status === "PENDING") {
      setIsExpanded((prev) => !prev);
    }
  };
  

  return (
    <li
      className={`p-2 rounded hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20 dark:hover:border-primary/30`}
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
          {invite?.course?.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {invite.course.description}
            </p>
          )}
          {invite?.cohortName && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Cohort: <span className="text-foreground font-medium">{invite.cohortName}</span>
            </p>
          )}

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

         
{isExpanded && status === "PENDING" && (
  <div className="-ml-2 flex gap-1 mt-2 max-w-min">
    
    {/* ✅ NO POLICIES → direct actions */}
    {hasPolicies === false ? (
      <>
        <Button
          size="sm"
          variant="outline"
          className="w-full text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            onRejectClick(invite);
          }}
          
        >
          Reject
        </Button>

        <Button
         size="sm"
         className="w-full text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            onAcceptClick(invite);
          }}
          
        >
          Accept
        </Button>
      </>
    ) : (<div className="flex gap-0.5 min-w-max">
      <Button
      size="sm"
      variant="destructive"
      className="text-[10px]"
      onClick={(e) => {
        e.stopPropagation();
        onRejectClick(invite);
      }}
    >
      Reject
    </Button>
     
      <Button
        size="sm"
      variant="default"
      className=" text-[10px]"
        onClick={(e) => {
          e.stopPropagation();
          onAcceptClick(invite);
        }}
        
        >
        Check Course
      </Button>
        </div>
    )}
  </div>
)}
        </div>
      </div>
    </li>
  );
};

export default InviteItem;