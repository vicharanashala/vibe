import {useState} from 'react';
import {
  Shield,
  ShieldOff,
  CheckCircle,
  Clock3,
  XCircle,
  UserX,
  UserCheck,
  Bell,
  Check,
} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useMarkNotificationAsRead} from '@/hooks/hooks';
import {
  useMarkSystemNotificationAsRead,
  useMarkAllSystemNotificationsAsRead,
} from '@/hooks/system-notification-hooks';
import InviteItem from './InviteItem';
import {PolicyAcknowledgementModal} from '@/app/pages/student/components/policies/PolicyAcknowledgementModal';
import {
  ApprovedRegistrationNotification,
  PendingStudentRegistrationNotification,
  RejectedStudentRegistrationNotification,
  SystemNotification,
} from '@/types/notification.types';

type InviteDropdownProps = {
  setShowInvites?: React.Dispatch<React.SetStateAction<boolean>>;
  onRejectClick?: (invite: any) => void;
  selectedInvite: any;
  setSelectedInvite: React.Dispatch<React.SetStateAction<any>>;
  pendingInvites: any[];
  setPendingInvites: React.Dispatch<React.SetStateAction<any[]>>;
  approvedNotifications?: ApprovedRegistrationNotification[];
  setApprovedNotifications?: React.Dispatch<
    React.SetStateAction<ApprovedRegistrationNotification[]>
  >;
  pendingStudentRegistrations?: PendingStudentRegistrationNotification[];
  rejectedStudentRegistrations?: RejectedStudentRegistrationNotification[];
  onDismissRejected?: (id: string) => void;
  // New: system notifications (ejection, reinstatement, policy)
  systemNotifications?: SystemNotification[];
  onMarkSystemRead?: (id: string) => void;
  onMarkAllSystemRead?: () => void;
};

const getSystemNotificationIcon = (type: SystemNotification['type']) => {
  switch (type) {
    case 'ejection':
      return <UserX className="h-3 w-3 text-red-600 dark:text-red-400" />;
    case 'reinstatement':
      return <UserCheck className="h-3 w-3 text-green-600 dark:text-green-400" />;
    case 'policy_created':
    case 'policy_updated':
      return <Shield className="h-3 w-3 text-blue-600 dark:text-blue-400" />;
    default:
      return <Bell className="h-3 w-3 text-muted-foreground" />;
  }
};

const getSystemNotificationColors = (type: SystemNotification['type']) => {
  switch (type) {
    case 'ejection':
      return {
        bg: 'bg-red-100 dark:bg-red-900/40',
        hover: 'hover:bg-red-50 dark:hover:bg-red-950/30',
        dot: 'bg-red-500',
      };
    case 'reinstatement':
      return {
        bg: 'bg-green-100 dark:bg-green-900/40',
        hover: 'hover:bg-green-50 dark:hover:bg-green-950/30',
        dot: 'bg-green-500',
      };
    case 'policy_created':
    case 'policy_updated':
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/40',
        hover: 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
        dot: 'bg-blue-500',
      };
    default:
      return {
        bg: 'bg-muted',
        hover: 'hover:bg-muted/60',
        dot: 'bg-gray-400',
      };
  }
};

const InviteDropdown = ({
  selectedInvite,
  setSelectedInvite,
  pendingInvites,
  setPendingInvites,
  setShowInvites,
  onRejectClick,
  approvedNotifications = [],
  setApprovedNotifications,
  pendingStudentRegistrations = [],
  rejectedStudentRegistrations = [],
  onDismissRejected,
  systemNotifications = [],
  onMarkSystemRead,
  onMarkAllSystemRead,
}: InviteDropdownProps) => {
  const {mutate: markAsRead, isPending} = useMarkNotificationAsRead();
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  const unreadSystemNotifications = systemNotifications.filter(n => !n.read);
  const hasAnyContent =
    pendingInvites.length > 0 ||
    approvedNotifications.length > 0 ||
    pendingStudentRegistrations.length > 0 ||
    rejectedStudentRegistrations.length > 0 ||
    systemNotifications.length > 0;

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead({params: {path: {registrationId: notificationId}}});
    setApprovedNotifications?.(prev =>
      prev.filter(n => n._id !== notificationId),
    );
  };

  const handleDismissRejected = (registrationId: string) => {
    markAsRead({params: {path: {registrationId}}});
    onDismissRejected?.(registrationId);
  };

  return (
    <>
      <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-black rounded-lg shadow-lg border border-border dark:border-zinc-700 z-50">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <span className="text-xs font-semibold text-foreground">
            Notifications
          </span>
          {unreadSystemNotifications.length > 0 && onMarkAllSystemRead && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllSystemRead}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ul className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-96 overflow-auto p-1">
          {!hasAnyContent ? (
            <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-4 text-center">
              No notifications
            </li>
          ) : (
            <>
              {/* ── System Notifications (ejection, reinstatement, policy) ── */}
              {systemNotifications.map((notification, idx) => {
                const colors = getSystemNotificationColors(notification.type);
                return (
                  <li
                    key={`system-${idx}`}
                    className={`p-2 rounded transition-colors ${colors.hover} ${!notification.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`mt-0.5 rounded-full ${colors.bg} p-1 shrink-0`}
                      >
                        {getSystemNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-semibold text-foreground leading-tight">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span
                              className={`mt-1 h-2 w-2 rounded-full shrink-0 ${colors.dot}`}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-muted-foreground/70">
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </p>
                          {!notification.read && onMarkSystemRead && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onMarkSystemRead(notification._id)}
                              className="h-5 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}

              {/* ── Pending registration requests ── */}
              {pendingStudentRegistrations.map((reg, idx) => (
                <li
                  key={`pending-reg-${idx}`}
                  className="p-2 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded transition-colors"
                >
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
                        Requested{' '}
                        {new Date(reg.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}

              {/* ── Rejected registration notifications ── */}
              {rejectedStudentRegistrations.map((reg, idx) => (
                <li
                  key={`rejected-reg-${idx}`}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="mt-0.5 rounded-full bg-red-100 dark:bg-red-900/40 p-1 shrink-0">
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
                          {new Date(
                            reg.updatedAt || reg.createdAt,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDismissRejected(reg._id)}
                      disabled={isPending}
                      className="text-xs h-6 px-2 hover:bg-red-50 hover:border-red-200 hover:text-red-700 shrink-0"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </li>
              ))}

              {/* ── Approved Notifications ── */}
              {approvedNotifications.map((notification, idx) => (
                <li
                  key={`notification-${idx}`}
                  className="p-2 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-primary truncate">
                        {notification.courseName || 'Course'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        Course Registration Approved
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkAsRead(notification._id)}
                      disabled={isPending}
                      className="text-xs h-6 px-2 hover:bg-green-50 hover:border-green-200 hover:text-green-700 shrink-0"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {isPending ? '...' : 'Read'}
                    </Button>
                  </div>
                </li>
              ))}

              {/* ── Invites ── */}
              {pendingInvites.map((invite: any, idx: number) => (
                <InviteItem
                  key={`invite-${idx}`}
                  invite={invite}
                  onRejectClick={onRejectClick ?? (() => {})}
                  onAcceptClick={invite => {
                    setSelectedInvite(invite);
                    setShowPolicyModal(true);
                  }}
                />
              ))}
            </>
          )}
        </ul>
      </div>

      {showPolicyModal && selectedInvite && (
        <PolicyAcknowledgementModal
          open={showPolicyModal}
          onClose={() => setShowPolicyModal(false)}
          inviteId={selectedInvite?.inviteId}
          courseId={selectedInvite?.courseId}
          courseVersionId={selectedInvite?.courseVersionId}
          cohortId={selectedInvite?.cohortId}
        />
      )}
    </>
  );
};

export default InviteDropdown;