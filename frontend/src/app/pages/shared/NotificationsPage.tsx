import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuthStore } from "@/store/auth-store";
import { 
  useInvites, 
  useGetUnreadApprovedRegistrations, 
  useGetPendingStudentRegistrations, 
  useGetRejectedStudentRegistrations,
  useGetPendingRegistrations,
  useMarkNotificationAsRead,
  processInviteApi
} from "@/hooks/hooks";
import { 
  useGetSystemNotifications, 
  useMarkSystemNotificationAsRead, 
  useMarkAllSystemNotificationsAsRead,
  useSubmitAppeal
} from "@/hooks/system-notification-hooks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Mail, CheckCircle2, XCircle, Clock, Info, AlertTriangle, UserCheck, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AuroraText } from "@/components/magicui/aurora-text";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/utils";
import { useNavigate } from "@tanstack/react-router";
import { useCourseStore } from "@/store/course-store";
import { PolicyAcknowledgementModal } from "@/app/pages/student/components/policies/PolicyAcknowledgementModal";
import { AppealModal } from "@/app/pages/student/components/policies/AppealModal";
import { PolicyReacknowledgementModal } from "@/app/pages/student/components/policies/PolicyReacknowledgementModal";
import { SystemNotification } from "@/types/notification.types";
import { hasActivePolicies } from "@/utils/ejectionPolicyUtils";

const formatDate = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const PAGE_SIZE = 5;

function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  const reset = useCallback(() => setPage(1), []);
  return { paged, page: safePage, totalPages, setPage, reset };
}

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={page === totalPages}
        onClick={() => setPage(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function NotificationsPage() {
  const { user, isAuthReady } = useAuthStore();
  const userId = user?.uid || "";
  const role = user?.role;
  const navigate = useNavigate();
  const { setCurrentCourse } = useCourseStore();
  const [invitePoliciesMap, setInvitePoliciesMap] = useState<Record<string, boolean>>({});

  // Data fetching
  const { getInvites } = useInvites();
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  
  // Student specific
  const { data: approvedNotifications } = useGetUnreadApprovedRegistrations(userId);
  const { data: pendingStudentRegistrations } = useGetPendingStudentRegistrations(userId);
  const { data: rejectedStudentRegistrations } = useGetRejectedStudentRegistrations(userId);
  
  // Teacher specific
  const { data: teacherPendingRegistrations } = useGetPendingRegistrations(userId);

  // Shared
  const { notifications: systemNotifications = [] } = 
    useGetSystemNotifications(userId, false, isAuthReady && !!userId);
  
  const { mutate: markSystemRead } = useMarkSystemNotificationAsRead();
  const { mutate: markAllSystemRead } = useMarkAllSystemNotificationsAsRead();
  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const submitAppeal = useSubmitAppeal();

  // Modal States
  const [activeTab, setActiveTab] = useState<string>("notifications");
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<any>(null);
  const [selectedAppeal, setSelectedAppeal] = useState<{
    courseId: string;
    courseVersionId: string;
    cohortId: string;
  } | null>(null);
  const [selectedPolicyNotification, setSelectedPolicyNotification] = useState<SystemNotification | null>(null);
  const [submittedAppeals, setSubmittedAppeals] = useState<Set<string>>(new Set());

  const fetchInvites = async () => {
    const result = await getInvites();
    setPendingInvites(result.invites || []);
  };
  const handleRejectInvite = async (invite: any) => {
  await processInviteApi(invite.inviteId, "REJECTED");
  fetchInvites(); // refresh list
};
useEffect(() => {
  const fetchPolicies = async () => {
    const results: Record<string, boolean> = {};

    await Promise.all(
      pendingInvites.map(async (invite) => {
        const hasPolicies = await hasActivePolicies(
          invite.courseId,
          invite.courseVersionId,
          invite.cohortId
        );

        results[invite.inviteId] = hasPolicies;
      })
    );

    setInvitePoliciesMap(results);
  };

  if (pendingInvites.length) {
    fetchPolicies();
  }
}, [pendingInvites]);

  useEffect(() => {
    if (isAuthReady && userId) {
      fetchInvites();
    }
  }, [isAuthReady, userId]);
  
  useEffect(() => {
    
    const isTeacher = user?.role === "teacher" || user?.role === "admin";

  const hasInvites = isTeacher
    ? pendingInvites.length > 0 || (teacherPendingRegistrations?.length || 0) > 0
    : pendingInvites.length > 0;  // ← only count actual invites, not registrations

  if (hasInvites) {
    setActiveTab("invitations");
  } else {
    setActiveTab("notifications"); // ← default to general notifications
  }
}, [ pendingInvites.length,
  teacherPendingRegistrations?.length,user?.role]);
  const invitationCount =  pendingInvites.length 

const allInvitationItems = useMemo(() => {
  return pendingInvites.map(d => ({
    type: 'invite',
    data: d
  }));
}, [pendingInvites]);
const invPagination = usePagination(allInvitationItems);

// GENERAL
const generalNotificationItems = useMemo(() => {
  const items: { type: string; data: any }[] = [];

  if (role === 'student') {
    approvedNotifications?.forEach((d: any) => items.push({ type: 'approval', data: d }));
    pendingStudentRegistrations?.forEach((d: any) => items.push({ type: 'pending_reg', data: d }));
    rejectedStudentRegistrations?.forEach((d: any) => items.push({ type: 'rejected_reg', data: d }));
  }

  if (role === 'teacher') {
    teacherPendingRegistrations?.forEach((d: any) =>
      items.push({ type: 'teacher_reg_request', data: d })
    );
  }

  return items;
}, [
  role,
  approvedNotifications,
  pendingStudentRegistrations,
  rejectedStudentRegistrations,
  teacherPendingRegistrations,
]);
const combinedGeneralNotifications = useMemo(() => {
  return [
    ...generalNotificationItems,
    ...systemNotifications.map((n: any) => ({
      type: 'system',
      data: n
    }))
  ];
}, [generalNotificationItems, systemNotifications]);

const sysPagination = usePagination(combinedGeneralNotifications);
 const systemCount =
  (systemNotifications?.filter((n: any) => !n.read).length || 0) +
  generalNotificationItems.length;
  // const sysPagination = usePagination(combinedGeneralNotifications);

  // Reset pages when tab changes
  useEffect(() => {
    invPagination.reset();
    sysPagination.reset();
  }, [activeTab]);

  // Handlers
 const handleAcceptInvite = async (invite: any) => {
  const isTeacher = role === "teacher" || role === "admin";
  const hasPolicies = invitePoliciesMap[invite.inviteId];
  if (!hasPolicies) {
    await processInviteApi(invite.inviteId, "ACCEPT", false);
    fetchInvites();
    return;
  }

  if (isTeacher) {
    //  Direct accept (NO modal)
    await processInviteApi(invite.inviteId, "ACCEPT", false);
    fetchInvites();
    return;
  }

  //  Students → show policy modal
  setSelectedInvite(invite);
  setShowPolicyModal(true);
};

  const handleReviewRequest = (reg: any) => {
    setCurrentCourse({
      courseId: reg.courseId,
      versionId: reg.versionId,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    });
    navigate({ to: "/teacher/courses/registration-requests" as any });
  };

  const handleMarkAsReadAndNavigate = (id: string, courseId?: string) => {
    markAsRead({ params: { path: { registrationId: id } } });
    if (courseId) {
      navigate({ to: "/student/courses" as any });
    }
  };

  const appealKey = (n: SystemNotification) => `${n.courseId}-${n.courseVersionId}-${n.cohortId}`;

  const mostRecentEjectionIds = useMemo(() => {
    const map = new Map<string, string>();
    systemNotifications
      .filter(n => n.type === 'ejection')
      .forEach(n => {
        const key = `${n.courseId}-${n.courseVersionId}-${n.cohortId}`;
        const existing = map.get(key);
        if (!existing || new Date(n.createdAt) > new Date(systemNotifications.find(x => x._id === existing)!.createdAt)) {
          map.set(key, n._id);
        }
      });
    return new Set(map.values());
  }, [systemNotifications]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-yellow-500">
            Notifications
          </h1>
          <p className="text-muted-foreground">
            Manage your course invitations and stay updated with system alerts.
          </p>
        </div>
        {activeTab === "notifications" && systemCount > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => markAllSystemRead({})}
            className="w-fit"
          >
            Mark all as read
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="invitations" className="rounded-lg transition-all">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>Invitations</span>
              {invitationCount > 0 && (
                <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary hover:bg-primary/20">
                  {invitationCount}
                </Badge>
              )}
            </div>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg transition-all">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span>General Notifications</span>
              {systemCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {systemCount}
                </Badge>
              )}
            </div>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <TabsContent value="invitations" className="mt-0">
              <div className="grid gap-4">
                {allInvitationItems.length === 0 ? (
                  <EmptyState 
                    icon={<Mail className="h-12 w-12 text-muted-foreground/50" />}
                    title="No invitations"
                    description="You don't have any pending course invitations or registration updates right now."
                  />
                ) : (
                  invPagination.paged.map(({ type, data }) => {
                    const key = data._id || `${type}-${data.courseId}`;
                    const onAction =
                      type === 'invite' ? () => handleAcceptInvite(data)
                      : type === 'approval' ? () => handleMarkAsReadAndNavigate(data._id, data.courseId)
                      : type === 'rejected_reg' ? () => handleMarkAsReadAndNavigate(data._id)
                      : type === 'teacher_reg_request' ? () => handleReviewRequest(data)
                      : undefined;
                    return <InvitationCard key={key} type={type} data={data} onAction={onAction} onReject={
      type === "invite" ? () => handleRejectInvite(data) : undefined 
    } hasPolicies={invitePoliciesMap[data.inviteId]} />;
                  })
                )}
              </div>
              <Pagination
                page={invPagination.page}
                totalPages={invPagination.totalPages}
                setPage={invPagination.setPage}
              />
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              <div className="grid gap-4">
                {systemNotifications.length === 0 ? (
                  <EmptyState 
                    icon={<Bell className="h-12 w-12 text-muted-foreground/50" />}
                    title="All caught up!"
                    description="You have no new system notifications."
                  />
                ) : (
                  sysPagination.paged.map(({ type, data }: any) => {
                    if (type === 'system') {
                      const notif = data;

                      const isExpired =
                        notif.metadata?.appealDeadline &&
                        new Date(notif.metadata.appealDeadline) < new Date();

                      const alreadySubmitted =
                        notif.metadata?.appealPending ||
                        submittedAppeals.has(appealKey(notif));

                      return (
                        <SystemNotificationCard
                          key={notif._id}
                          notification={notif}
                          isExpired={isExpired}
                          alreadySubmitted={alreadySubmitted}
                          isMostRecentEjection={mostRecentEjectionIds.has(notif._id)}
                          onMarkRead={(id) =>
                            markSystemRead({ params: { path: { notificationId: id } } })
                          }
                          onAppeal={() => {
                            if (notif.courseId && notif.courseVersionId && notif.cohortId) {
                              setSelectedAppeal({
                                courseId: notif.courseId,
                                courseVersionId: notif.courseVersionId,
                                cohortId: notif.cohortId,
                              });
                            }
                          }}
                          onReacknowledge={() => setSelectedPolicyNotification(notif)}
                        />
                      );
                    }

                    return (
                      <InvitationCard
                        key={data._id}
                        type={type}
                        data={data}
                        hasPolicies={invitePoliciesMap[data.inviteId]}
                        onAction={
                          type === 'approval'
                            ? () => handleMarkAsReadAndNavigate(data._id, data.courseId)
                            : type === 'rejected_reg'
                            ? () => handleMarkAsReadAndNavigate(data._id)
                            : type === 'teacher_reg_request'
                            ? () => handleReviewRequest(data)
                            : undefined
                        }
                         onReject={
                          type === "invite"
                            ? () => handleRejectInvite(data)
                            : undefined
                        }
                      />
                    );
                  })
                )}
              </div>
              <Pagination
                page={sysPagination.page}
                totalPages={sysPagination.totalPages}
                setPage={sysPagination.setPage}
              />
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>

      {/* Modals */}
      {showPolicyModal && selectedInvite && (
        <PolicyAcknowledgementModal
          open={showPolicyModal}
          onClose={() => {
            setShowPolicyModal(false);
            setSelectedInvite(null);
            fetchInvites();
          }}
          inviteId={selectedInvite?.inviteId}
          courseId={selectedInvite?.courseId}
          courseVersionId={selectedInvite?.courseVersionId}
          cohortId={selectedInvite?.cohortId}
        />
      )}

      {selectedAppeal && (
        <AppealModal
          isOpen={!!selectedAppeal}
          onClose={() => setSelectedAppeal(null)}
          enrollmentId={selectedAppeal.courseId}
          onSubmit={async ({ reason, evidenceUrl }) => {
            if (!selectedAppeal) return;
            await submitAppeal.mutateAsync({
              body: {
                courseId: selectedAppeal.courseId,
                courseVersionId: selectedAppeal.courseVersionId,
                cohortId: selectedAppeal.cohortId,
                reason,
                evidenceUrl,
              },
            });
            setSubmittedAppeals(prev => {
              const next = new Set(prev);
              next.add(`${selectedAppeal.courseId}-${selectedAppeal.courseVersionId}-${selectedAppeal.cohortId}`);
              return next;
            });
            setSelectedAppeal(null);
          }}
        />
      )}

      {selectedPolicyNotification && (
        <PolicyReacknowledgementModal
          open={!!selectedPolicyNotification}
          onClose={() => setSelectedPolicyNotification(null)}
          courseId={selectedPolicyNotification.courseId!}
          courseVersionId={selectedPolicyNotification.courseVersionId!}
          cohortId={selectedPolicyNotification.cohortId!}
          notificationId={selectedPolicyNotification._id}
          onSuccess={() => {
            // @ts-ignore
            markSystemRead({ params: { path: { notificationId: selectedPolicyNotification._id } } });
            setSelectedPolicyNotification(null);
          }}
        />
      )}
    </div>
  );
}

function InvitationCard({ type, data, onAction, onReject,hasPolicies  }: { type: string, data: any, onAction?: () => void, onReject?: () => void ,hasPolicies?:boolean}) {
  const user = useAuthStore((state) => state.user);
const isTeacher = user?.role === "teacher" || user?.role === "admin";
  const getDetails = () => {
    switch (type) {
      case 'invite':
        return {
          title: data?.course?.name ||"Course Invitation",
          description: ` ${data?.course?.description || "You've been invited to join this course."}`,
          icon: <Mail className="h-5 w-5 text-blue-500" />,
          action: "Accept Invite",
          time: data.createdAt
        };
      case 'approval':
        return {
          title: "Registration Approved",
          description: `Your registration for ${data.courseName} has been approved!`,
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          action: "View Course",
          time: data.createdAt
        };
      case 'pending_reg':
        return {
          title: "Registration Pending",
          description: `Your registration for ${data.courseName} is currently under review.`,
          icon: <Clock className="h-5 w-5 text-yellow-500" />,
          action: null,
          time: data.createdAt
        };
      case 'rejected_reg':
        return {
          title: "Registration Rejected",
          description: `Unfortunately, your registration for ${data.courseName} was rejected.`,
          icon: <XCircle className="h-5 w-5 text-red-500" />,
          action: "Dismiss",
          time: data.createdAt
        };
      case 'teacher_reg_request':
        return {
          title: "New Registration Request",
          description: `${data.detail?.Name || 'A student'} wants to join ${data.courseName}.`,
          icon: <UserCheck className="h-5 w-5 text-orange-500" />,
          action: "Review Request",
          time: data.createdAt
        };
      default:
        return { title: "Invitation", description: "New update", icon: <Info />, action: null, time: null };
    }
  };

  const details = getDetails();

  return (
    <Card className="overflow-hidden border-border/50 hover:border-primary/30 transition-all hover:shadow-md group">
      <CardContent className="p-0">
        <div className="flex items-start p-6 gap-4">
          <div className="mt-1 p-2 rounded-full bg-muted/50 group-hover:bg-primary/5 transition-colors">
            {details.icon}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{details.title}</h3>
              {details.time && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(details.time)}
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{details.description}</p>
            <div className="pt-3 flex gap-2 justify-end">
            
    
    {type === "invite" && (
  <div className="pt-3 flex gap-2 justify-end">

    {/* TEACHER → ALWAYS Accept + Reject */}
    {isTeacher ? (
      <>
        <Button size="sm" variant="outline" onClick={onReject}>
          Reject
        </Button>

        <Button size="sm" onClick={onAction}>
          Accept
        </Button>
      </>
    ) : (
      <>
        {/*  STUDENT LOGIC */}

        <Button size="sm" variant="outline" onClick={onReject}>
          Reject
        </Button>

        {hasPolicies !== true && (
  <Button size="sm" onClick={onAction}>
    Accept
  </Button>
)}

{hasPolicies === true && (
  <Button size="sm" onClick={onAction}>
    Check Course
  </Button>
)}
      </>
    )}
  </div>
)}
          </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemNotificationCard({ 
  notification, 
  onMarkRead, 
  onAppeal, 
  onReacknowledge,
  isExpired,
  alreadySubmitted,
  isMostRecentEjection
}: { 
  notification: any, 
  onMarkRead: (id: string) => void,
  onAppeal: () => void,
  onReacknowledge: () => void,
  isExpired?: boolean,
  alreadySubmitted?: boolean,
  isMostRecentEjection?: boolean
}) {
  const isUnread = !notification.read;

  return (
    <Card className={cn(
      "overflow-hidden border-border/50 hover:border-primary/30 transition-all hover:shadow-md relative",
      isUnread && "bg-primary/[0.02] border-primary/20"
    )}>
      {isUnread && (
        <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary" />
      )}
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="mt-1 p-2 rounded-full bg-muted/50">
            {notification.type === 'ejection' ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : notification.type === 'reinstatement' ? (
              <UserCheck className="h-5 w-5 text-green-500" />
            ) : (
              <Info className="h-5 w-5 text-blue-500" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className={cn("font-semibold text-lg", isUnread && "text-primary")}>
                {notification.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDate(notification.createdAt)}
                </span>
                {isUnread && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 rounded-full"
                    onClick={() => onMarkRead(notification._id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {notification.message}
            </p>
            
            <div className="flex gap-2 pt-3 justify-end items-center">
              {(notification.type === "policy_created" || notification.type === 'policy_updated') && (
                <Button size="sm" variant="outline" onClick={onReacknowledge}>
                   Re-acknowledge Policy
                </Button>
              )}

              {notification.type === 'ejection' && 
               notification.metadata?.allowAppeal && 
               !isExpired && 
               isMostRecentEjection && (
                <Button size="sm" variant="outline" disabled={alreadySubmitted} onClick={onAppeal}>
                  {alreadySubmitted ? 'Appeal Submitted' : 'Appeal ejection'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border/50 rounded-2xl bg-muted/20">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}
