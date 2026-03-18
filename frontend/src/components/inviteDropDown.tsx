import { useInvites } from "@/hooks/hooks";
import { useState } from "react";
import InviteItem from "./InviteItem";
import { ApprovedRegistrationNotification, PendingStudentRegistrationNotification, RejectedStudentRegistrationNotification } from "@/types/notification.types";
import { CheckCircle, Clock3, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarkNotificationAsRead } from "@/hooks/hooks";
import { PolicyAcknowledgementModal } from "@/app/pages/student/components/policies/PolicyAcknowledgementModal";

type InviteDropdownProps = {
  selectedInvite:any,
  setSelectedInvite:React.Dispatch<React.SetStateAction<any>>
  pendingInvites: any[];
  setPendingInvites: React.Dispatch<React.SetStateAction<any[]>>;
  approvedNotifications?: ApprovedRegistrationNotification[];
  setApprovedNotifications?: React.Dispatch<React.SetStateAction<ApprovedRegistrationNotification[]>>;
  pendingStudentRegistrations?: PendingStudentRegistrationNotification[];
  rejectedStudentRegistrations?: RejectedStudentRegistrationNotification[];
  onDismissRejected?: (id: string) => void;
};

const InviteDropdown = ({ 
  selectedInvite,
  setSelectedInvite,
  pendingInvites, 
  setPendingInvites, 
  approvedNotifications = [], 
  setApprovedNotifications,
  pendingStudentRegistrations = [],
  rejectedStudentRegistrations = [],
  onDismissRejected,
}: InviteDropdownProps) => {
  const { getInvites, loading, error } = useInvites();
  const { mutate: markAsRead, isPending } = useMarkNotificationAsRead();
  const [invites, setInvites] = useState<any[]>(pendingInvites || []);
 
  const [showPolicyModal, setShowPolicyModal] = useState(false);

console.log("Invites:", invites);


  const handleMarkAsRead = (notificationId: string) => {
    markAsRead({ params: { path: { registrationId: notificationId } } });
    setApprovedNotifications?.(prev => prev.filter(n => n._id !== notificationId));
  };

  const handleDismissRejected = (registrationId: string) => {
    markAsRead({ params: { path: { registrationId } } });
    onDismissRejected?.(registrationId);
  };

  return (
    <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-black rounded-lg shadow-lg border border-red-100 dark:border-zinc-700 z-50">
      <ul className="divide-y divide-gray-200 dark:divide-zinc-600 max-h-48 overflow-auto p-1">
        {loading ? (
          <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">
            Loading...
          </li>
        ) : invites.length === 0 && approvedNotifications.length === 0 && pendingStudentRegistrations.length === 0 && rejectedStudentRegistrations.length === 0 ? (
          <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">
            No Pending Invites or Notifications
          </li>
        ) : (
          <>
            {/* Pending registration requests */}
            {pendingStudentRegistrations.map((reg: PendingStudentRegistrationNotification, idx: number) => (
              <li key={`pending-reg-${idx}`} className="p-2 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded transition-colors">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 p-1">
                    <Clock3 className="h-3 w-3 text-amber-700 dark:text-amber-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {reg.courseName || reg.course?.name || 'Course'}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Waiting for instructor approval
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested {new Date(reg.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </li>
            ))}

            {/* Rejected registration notifications */}
            {rejectedStudentRegistrations.map((reg: RejectedStudentRegistrationNotification, idx: number) => (
              <li key={`rejected-reg-${idx}`} className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="mt-0.5 rounded-full bg-red-100 dark:bg-red-900/40 p-1 flex-shrink-0">
                      <XCircle className="h-3 w-3 text-red-700 dark:text-red-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {reg.courseName || reg.course?.name || 'Course'}
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-400">
                        Registration rejected
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(reg.updatedAt || reg.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDismissRejected(reg._id)}
                    disabled={isPending}
                    className="text-xs h-6 px-2 hover:bg-red-50 hover:border-red-200 hover:text-red-700 flex-shrink-0"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}

            {/* Render Approved Notifications */}
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
