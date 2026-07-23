"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/store/auth-store"
import {
  useInvites,
  useGetUnreadApprovedRegistrations,
  useGetPendingStudentRegistrations,
  useGetRejectedStudentRegistrations,
  useUserEnrollments,
} from "@/hooks/hooks"
import {
  useGetSystemNotifications,
  useMarkSystemNotificationAsRead,
  useMarkAllSystemNotificationsAsRead,
} from "@/hooks/system-notification-hooks"
import InviteDropdown from "@/components/inviteDropDown"
import { PolicyAcknowledgementModal } from "@/app/pages/student/components/policies/PolicyAcknowledgementModal"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

type Invite = {
  inviteId: string;
  courseId: string;
  courseVersionId: string;
  cohortId: string;
};

/**
 * Self-contained notifications/invites control for the student sidebar footer.
 *
 * This encapsulates the full invite + system-notification subsystem that used
 * to live inline in the student layout: data fetching, session toasts,
 * outside-click handling, the dropdown, and the policy-acknowledgement modal.
 * Behaviour is unchanged — it was lifted out verbatim to keep the layout thin.
 */
export function StudentNotifications({ compact = false }: { compact?: boolean }) {
  const { user, isAuthReady, token } = useAuthStore()
  const { getInvites } = useInvites()

  const { data: approvedNotifications = [] } = useGetUnreadApprovedRegistrations(user?.uid || '')
  const { data: pendingStudentRegistrations = [] } = useGetPendingStudentRegistrations(user?.uid || '')
  const { data: rejectedStudentRegistrations = [] } = useGetRejectedStudentRegistrations(user?.uid || '')
  const { data: enrollmentsData } = useUserEnrollments(1, 100, !!token && !!user?.uid)
  const enrollments = enrollmentsData?.enrollments ?? []

  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [showInvites, setShowInvites] = useState(false)
  const [selectedInvite, setSelectedInvite] = useState<Invite | null>(null)
  const [approvedNotificationsList, setApprovedNotificationsList] = useState<any[]>([])
  const [localRejectedRegistrations, setLocalRejectedRegistrations] = useState<any[]>([])

  const { notifications: fetchedSystemNotifications = [], unreadCount: systemUnreadCount = 0 } =
    useGetSystemNotifications(user?.uid || '', false, !!user?.uid)
  const { mutate: markSystemRead } = useMarkSystemNotificationAsRead()
  const { mutate: markAllSystemRead } = useMarkAllSystemNotificationsAsRead()

  const invitationCount =
    pendingInvites.length +
    (approvedNotifications?.length || 0) +
    (pendingStudentRegistrations?.length || 0) +
    (rejectedStudentRegistrations?.length || 0)

  const hasIndicator = invitationCount > 0 || systemUnreadCount > 0

  // Sync local state with hook data
  useEffect(() => {
    if (approvedNotifications && approvedNotifications.length !== approvedNotificationsList.length) {
      setApprovedNotificationsList(approvedNotifications)
    }
  }, [approvedNotifications, approvedNotificationsList])

  useEffect(() => {
    if (rejectedStudentRegistrations) {
      setLocalRejectedRegistrations(rejectedStudentRegistrations)
    }
  }, [rejectedStudentRegistrations])

  // One-time session toasts for new invites / approvals
  useEffect(() => {
    if (!isAuthReady || !user) return

    const toastShown = sessionStorage.getItem("inviteToastShown")
    const notificationToastShown = sessionStorage.getItem("notificationToastShown")

    const getUserInvites = async () => {
      const result = await getInvites()
      if (result.invites.length > 0) {
        setPendingInvites(result.invites)
        if (!toastShown) {
          toast.info("You have a new invite! Check invites dropdown.", { richColors: true })
          sessionStorage.setItem("inviteToastShown", "true")
        }
      }
    }

    const checkNotifications = async () => {
      if (approvedNotifications && approvedNotifications.length > 0 && !notificationToastShown) {
        toast.info("You have new course approvals! Check notifications.", { richColors: true })
        sessionStorage.setItem("notificationToastShown", "true")
      }
      if (approvedNotifications && approvedNotifications.length === 0) {
        sessionStorage.removeItem("notificationToastShown")
      }
    }

    getUserInvites()
    checkNotifications()
  }, [user, isAuthReady, approvedNotifications.length])


  return (
    <>
      <button
        type="button"
        onClick={() => setShowInvites(true)}
        aria-label="Notifications"
        title="Notifications"
        className={
          compact
            ? "relative flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-yellow-100 hover:text-yellow-900 dark:hover:bg-yellow-400/10 dark:hover:text-yellow-100"
            : "relative flex h-10 w-full items-center gap-2 rounded-md p-2 text-sm hover:bg-yellow-100 hover:text-yellow-900 dark:hover:bg-yellow-400/10"
        }
      >
        <Bell className={compact ? "size-4" : "size-5"} />
        {!compact && <span>Notifications</span>}
        {hasIndicator && (
          <span className={compact ? "absolute right-1.5 top-1.5 block h-2 w-2 rounded-full bg-red-500" : "absolute left-5 top-1.5 block h-2 w-2 rounded-full bg-red-500"} />
        )}
      </button>

      <Dialog open={showInvites} onOpenChange={setShowInvites}>
        <DialogContent className="max-w-md gap-0 p-0">
          <DialogTitle className="sr-only">Notifications</DialogTitle>
          <div className="max-h-[70vh] overflow-y-auto p-1">
            <InviteDropdown
              inline
              setShowInvites={setShowInvites}
              enrollments={enrollments}
              onRejectClick={() => {
                setSelectedInvite(null)
                setShowInvites(false)
              }}
              systemNotifications={fetchedSystemNotifications}
              onMarkSystemRead={(id: string) => {
                // @ts-ignore - notificationId type mismatch in generated client
                markSystemRead({ params: { path: { notificationId: id } } })
              }}
              onMarkAllSystemRead={() => {
                markAllSystemRead({})
              }}
              selectedInvite={selectedInvite}
              setSelectedInvite={setSelectedInvite}
              setPendingInvites={setPendingInvites}
              pendingInvites={pendingInvites}
              approvedNotifications={approvedNotificationsList}
              setApprovedNotifications={setApprovedNotificationsList}
              pendingStudentRegistrations={pendingStudentRegistrations ?? []}
              rejectedStudentRegistrations={localRejectedRegistrations}
              onDismissRejected={(id: string) => {
                setLocalRejectedRegistrations(prev => prev.filter(r => r._id !== id))
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {selectedInvite && (
        <PolicyAcknowledgementModal
          open={!!selectedInvite}
          onClose={() => setSelectedInvite(null)}
          inviteId={selectedInvite?.inviteId}
          courseId={selectedInvite?.courseId}
          courseVersionId={selectedInvite?.courseVersionId}
          cohortId={selectedInvite?.cohortId}
        />
      )}
    </>
  )
}
