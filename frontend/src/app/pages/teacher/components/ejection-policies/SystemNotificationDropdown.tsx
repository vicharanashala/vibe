import { Mail, UserCheck, Bell, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import SystemNotificationItem from "./SystemNotificationItem";
import { SystemNotification, PendingRegistrationNotification } from "@/types/notification.types";
import { useAuthStore } from "@/store/auth-store";
import { processInviteApi } from "@/hooks/hooks";

type Props = {
  notifications: SystemNotification[];
  pendingInvites?: any[];
  pendingRegistrations?: PendingRegistrationNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onAcceptInvite?: (invite: any) => void;
  onApproveRegistration?: (reg: PendingRegistrationNotification) => void;
  onInviteAction?: () => void;
};
const canSeeInvite = (inviteRole: string, userRole?: string|null) => {
  if (!userRole) return false;

  if (inviteRole === "INSTRUCTOR") {
    return userRole === "teacher" || userRole === "admin";
  }

  if (inviteRole === "STUDENT") {
    return userRole === "student";
  }

  return false;
};

export function UnifiedNotificationDropdown({
  notifications,
  pendingInvites = [],
  pendingRegistrations = [],
  onMarkRead,
  onMarkAllRead,
  onAcceptInvite,
  onApproveRegistration,
  onInviteAction,
}: Props) {
  

const user = useAuthStore((state) => state.user);
const filteredInvites = pendingInvites.filter((invite) =>
  canSeeInvite(invite.role, user?.role)
);
const isTeacher = user?.role === "teacher";
  const unreadSystem = notifications.filter(n => !n.read);
  const totalCount = unreadSystem.length + pendingInvites.length + pendingRegistrations.length;
  console.log('pending invites:', pendingInvites);
  

  return (
    <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-black rounded-lg shadow-lg border border-border dark:border-zinc-700 z-50 overflow-hidden flex flex-col max-h-[32rem]">
      
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/20">
        <span className="text-xs font-semibold text-foreground flex items-center gap-2">
          <Bell className="h-3 w-3" />
          Notifications
          {totalCount > 0 && (
            <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">
              {totalCount}
            </span>
          )}
        </span>

        {unreadSystem.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            className="h-6 px-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-primary"
          >
            Mark all alerts read
          </Button>
        )}
      </div>

      <div className="overflow-auto flex-1">
        <ul className="divide-y divide-gray-100 dark:divide-zinc-800 p-1">
          
          {/* ── Pending Invites ── */}
          {filteredInvites.length > 0 && (
            <li className="px-2 py-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 px-1">
                Course Invites
              </p>
              <div className="space-y-1">
                {filteredInvites.map((invite, idx) => (
                  <div key={`invite-${idx}`} className="p-2 rounded hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20 dark:hover:border-primary/30">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-full bg-primary/10 dark:bg-primary/20 p-1">
                        <Mail className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">
                          {invite?.course?.name || "New Invite"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{ invite?.course?.description || "Course Invitation"}</p>
                        {isTeacher ? (
                          <div className="-ml-2 flex gap-1 mt-2 max-w-min">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-[10px]"
                              onClick={async () => {
                                await processInviteApi(invite.inviteId, "REJECTED");
                                 onInviteAction?.(); 
                                
                              }}
                            >
                              Reject
                            </Button>

                            <Button
                              size="sm"
                              className="w-full text-[10px]"
                              onClick={async () => {
                                await processInviteApi(invite.inviteId, "ACCEPT", false);
                                 onInviteAction?.(); 
                              }}
                            >
                              Accept
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => onAcceptInvite?.(invite)}
                            className="mt-2 h-7 text-[10px] px-2 w-full"
                          >
                            Check Course
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </li>
          )}

          {/* ── Registration Requests ── */}
          {pendingRegistrations.length > 0 && (
            <li className="px-2 py-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 px-1">
                Registration Requests
              </p>
              <div className="space-y-1">
                {pendingRegistrations.map((reg, idx) => (
                  <div key={`reg-${idx}`} className="p-2 rounded hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20 dark:hover:border-primary/30">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-full bg-primary/10 dark:bg-primary/20 p-1">
                        <UserCheck className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" title={reg.detail?.Email}>
                          {reg.detail?.Email || "Student Request"}
                        </p>
                        <p className="text-[10px] text-primary/70 truncate">{reg.courseName}</p>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => onApproveRegistration?.(reg)}
                          className="mt-2 h-7 text-[10px] px-2 w-full border-primary/20 hover:bg-primary/5 hover:text-primary"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Approve Registration
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </li>
          )}

          {/* ── System Alerts ── */}
          {(notifications.length > 0 || (pendingInvites.length === 0 && pendingRegistrations.length === 0)) && (
            <li className="px-2 py-1.5">
              {notifications.length > 0 && (
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 px-1">
                  System Alerts
                </p>
              )}
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-muted w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 opacity-50">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">No alerts</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((n) => (
                    <SystemNotificationItem
                      key={n._id}
                      notification={n}
                      onMarkRead={onMarkRead}
                    />
                  ))}
                </div>
              )}
            </li>
          )}
        </ul>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border/50 bg-muted/10">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-primary hover:text-primary hover:bg-primary/5 font-semibold"
          onClick={() => {
            window.location.href = '/teacher/notifications';
          }}
        >
          View All Notifications
        </Button>
      </div>
    </div>
  );
}
