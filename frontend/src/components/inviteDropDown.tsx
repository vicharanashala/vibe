import { useInvites } from "@/hooks/hooks";
import { useState } from "react";
import InviteItem from "./InviteItem";
import { ApprovedRegistrationNotification } from "@/types/notification.types";
import { CheckCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarkNotificationAsRead } from "@/hooks/hooks";
import { PolicyAcknowledgementModal } from "@/app/pages/student/components/policies/PolicyAcknowledgementModal";

type InviteDropdownProps = {
  setShowInvites?: React.Dispatch<React.SetStateAction<boolean>>;
    onRejectClick?: (invite: any) => void;
  selectedInvite:any,
  setSelectedInvite:React.Dispatch<React.SetStateAction<any>>
  pendingInvites: any[];
  setPendingInvites: React.Dispatch<React.SetStateAction<any[]>>;
  approvedNotifications?: ApprovedRegistrationNotification[];
  setApprovedNotifications?: React.Dispatch<React.SetStateAction<ApprovedRegistrationNotification[]>>;
};

const InviteDropdown = ({ 
  selectedInvite,
  setSelectedInvite,
  pendingInvites, 

  setPendingInvites, 
  setShowInvites,
  onRejectClick,
  approvedNotifications = [], 
  setApprovedNotifications 
}: InviteDropdownProps) => {
  const { getInvites, loading, error } = useInvites();
  const { mutate: markAsRead, isPending } = useMarkNotificationAsRead();
  const [invites, setInvites] = useState<any[]>(pendingInvites || []);
 
  const [showPolicyModal, setShowPolicyModal] = useState(false);

console.log("Invites:", invites);


  const handleMarkAsRead = (notificationId: string) => {
    // Call API to mark as read
    markAsRead({
      params: { path: { registrationId: notificationId } }
    });
    
    // Remove from pending list
    setApprovedNotifications?.(prev => prev.filter(n => n._id !== notificationId));
  };

  return (<>
    <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-black rounded-lg shadow-lg border border-red-100 dark:border-zinc-700 z-50">
      <ul className="divide-y divide-gray-200 dark:divide-zinc-600 max-h-48 overflow-auto p-1">
        {loading ? (
          <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">
            Loading...
          </li>
        ) : invites.length === 0 && approvedNotifications.length === 0 ? (
          <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">
            No Pending Invites or Notifications
          </li>
        ) : (
          <>
            {/* Render Notifications first */}
            {approvedNotifications.map((notification: ApprovedRegistrationNotification, idx: number) => (
              <li key={`notification-${idx}`} className="p-2 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-primary dark:text-primary truncate">
                      {notification.courseName || 'Course'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      Course Registration Approved
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
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
            ))}
           
            {/* Render Invites */}
            {invites.map((invite: any, idx: number) => (
              <InviteItem 
                key={`invite-${idx}`} 
                invite={invite}   
                 onRejectClick={onRejectClick ?? (() => {})}
                onAcceptClick={(invite) => {
                setSelectedInvite(invite);
                setShowPolicyModal(true);
              }} />
            ))}
          </>
        )}
      </ul>
       
    </div>
   
    </>

  );
};

export default InviteDropdown;
