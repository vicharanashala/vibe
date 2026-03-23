"use client"

import { Outlet, Link } from "@tanstack/react-router"
import { useAuthStore } from "@/store/auth-store"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { logout } from "@/utils/auth"
import { useNavigate } from "@tanstack/react-router"
import { LogOut, Menu, X, Bell } from "lucide-react"
import { AuroraText } from "@/components/magicui/aurora-text"
import { useState } from "react"
import InviteDropdown from "@/components/inviteDropDown"
import { useNewAnnouncementIndicator } from "@/hooks/use-new-announcement-indicator"
import ConfirmationModal from "@/app/pages/teacher/components/confirmation-modal"
import { useInvites, useGetUnreadApprovedRegistrations, useGetPendingStudentRegistrations, useGetRejectedStudentRegistrations } from "@/hooks/hooks"
import { ApprovedRegistrationNotification } from "@/types/notification.types"
import { useRef, useEffect } from "react"
import logo from "../../public/img/vibe_logo_img.ico"
import { PolicyAcknowledgementModal } from "@/app/pages/student/components/policies/PolicyAcknowledgementModal"
import { useGetSystemNotifications, useMarkSystemNotificationAsRead, useMarkAllSystemNotificationsAsRead } from "@/hooks/system-notification-hooks"
import { SystemNotification } from "@/types/notification.types";
type Invite = {
  inviteId: string;
  courseId: string;
  courseVersionId: string;
  cohortId:string;
};

export default function StudentLayout() {
  const { user, isAuthReady } = useAuthStore()
  const navigate = useNavigate()
  const { getInvites } = useInvites(); // run after login
  const { data: approvedNotifications } = useGetUnreadApprovedRegistrations(user?.uid || '');
  const { data: pendingStudentRegistrations } = useGetPendingStudentRegistrations(user?.uid || '');
  const { data: rejectedStudentRegistrations, refetch: refetchRejected } = useGetRejectedStudentRegistrations(user?.uid || '');
  const [localRejectedRegistrations, setLocalRejectedRegistrations] = useState<any[]>([]);
  const hasShownToast = useRef(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [approvedNotificationsList, setApprovedNotificationsList] = useState<any[]>([]);
  const [showInvites, setShowInvites] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const invitesRef = useRef<HTMLDivElement | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<Invite|null>(null);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([])
  
  const { hasNew: hasNewAnnouncements, markSeen: markAnnouncementsSeen } = useNewAnnouncementIndicator();
  // const location = useLocation();
  const [pathname, setPathname] = useState(
    typeof window !== "undefined" ? window.location.pathname : ""
  );
  const isActive = (path: string) => {
    if (path === "/student") return pathname === "/student";
    return pathname === path || pathname.startsWith(path + "/");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => setPathname(window.location.pathname);

    // Back/forward
    window.addEventListener("popstate", update);

    // If your app navigates via pushState (SPA), popstate won't fire.
    // So we patch pushState/replaceState to notify.
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args as any);
      update();
    };

    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args as any);
      update();
    };

    return () => {
      window.removeEventListener("popstate", update);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Sync local state with hook data
  useEffect(() => {
    if (approvedNotifications && approvedNotifications.length !== approvedNotificationsList.length) {
      setApprovedNotificationsList(approvedNotifications);
    }
  }, [approvedNotifications]);

  useEffect(() => {
    if (rejectedStudentRegistrations) {
      setLocalRejectedRegistrations(rejectedStudentRegistrations);
    }
  }, [rejectedStudentRegistrations]);

  const handleLogout = () => {
    logout()
    navigate({ to: "/auth" })
  }

  const handleGoBack = () => {
    window.history.back()
  }
  const { notifications: fetchedSystemNotifications, unreadCount: systemUnreadCount } =
  useGetSystemNotifications(user?.uid || '', false, !!user?.uid);
const { mutate: markSystemRead } = useMarkSystemNotificationAsRead();
const { mutate: markAllSystemRead } = useMarkAllSystemNotificationsAsRead();
useEffect(() => {
  if (fetchedSystemNotifications) {
    setSystemNotifications(fetchedSystemNotifications);
  }
}, [fetchedSystemNotifications]);
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const toastShown = sessionStorage.getItem("inviteToastShown");
    const notificationToastShown = sessionStorage.getItem("notificationToastShown");

    const getUserInvites = async () => {
      const result = await getInvites();
      if (result.invites.length > 0) {
        setPendingInvites(result.invites)

        if (!toastShown) {
          toast.info("You have a new invite! Check invites dropdown.", {
            richColors: true,
          });
          sessionStorage.setItem("inviteToastShown", "true");
        }
      }
    };

    const checkNotifications = async () => {
      if (approvedNotifications && approvedNotifications.length > approvedNotificationsList.length && !notificationToastShown) {
        toast.info("You have new course approvals! Check notifications.", {
          richColors: true,
        });
        sessionStorage.setItem("notificationToastShown", "true");
      }

      // Clear flag if no notifications exist (allows toast to show next time)
      if (approvedNotifications && approvedNotifications.length === 0) {
        sessionStorage.removeItem("notificationToastShown");
      }
    };

    getUserInvites();
    checkNotifications();

  }, [user, isAuthReady]);

  useEffect(() => {
    if (!showInvites) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      //  Ignore clicks if modal is open
  if (selectedInvite) return;
      if (invitesRef.current && target && !invitesRef.current.contains(target)) {
        setShowInvites(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowInvites(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true } as any);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown as any);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showInvites]);

  // console.log('Current user role:', user?.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 bg-gray-50/50 dark:bg-orange-950/70">

      {/* <FloatingVideo isVisible={user?.role === 'student'}></FloatingVideo> */}
      <ConfirmationModal isOpen={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
        title={`Confirm Logout`}
        description="Are you sure you want to log out? You will need to sign in again to access your dashboard."
      />
      {/* Ambient background effect */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-secondary/[0.02] pointer-events-none" />

      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b border-border/20 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 transition-all duration-300 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-primary/[0.02] before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
        <div className="flex w-full items-center justify-between px-4 sm:px-8 relative z-10">
          <div className="relative z-20 flex items-center text-xl font-bold tracking-tight group cursor-pointer">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg overflow-hidden">
                <img
                  src={logo}
                  alt="Vibe Logo"
                  className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
                />
              </div>
              <span className="text-2xl sm:text-3xl font-bold">
                <AuroraText colors={["#A07CFE", "#FE8FB5", "#FFBE7B"]}><b>ViBe</b></AuroraText>
              </span>
            </div>
          </div>

          {/* <div className="flex items-center gap-4">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((item, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {item.isCurrentPage ? (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={item.path} asChild>
                          <Link to={item.path}>{item.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div> */}
          {/* Single container with consistent spacing for all navigation elements */}
          <div className="flex items-center lg:gap-4 gap-0">
            <div className="hidden md:flex items-center lg:gap-4 gap-0">
              <Button
                variant="ghost"
                size="sm"
                className={`relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300  ${isActive("/student")
                  ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-md before:opacity-100"
                  : ""
                  }`}
                asChild
              >
                <Link to="/student">
                  <span className="relative z-10">Dashboard</span>
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 ${isActive("/student/issues")
                  ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-md before:opacity-100"
                  : ""
                  }`}
                asChild
              >
                <Link to="/student/issues">
                  <span className="relative z-10">My Flags</span>
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 ${isActive("/student/courses")
                  ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-md before:opacity-100"
                  : ""
                  }`}
                asChild
              >
                <Link to="/student/courses">
                  <span className="relative z-10">Courses</span>
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 ${isActive("/student/announcements")
                  ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-md before:opacity-100"
                  : ""
                  }`}
                asChild
                onClick={markAnnouncementsSeen}
              >
                {/* @ts-ignore */}
                <Link to="/student/announcements">
                  <span className="relative z-10">Announcements</span>
                  {hasNewAnnouncements && <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                </Link>
              </Button>
            </div>

            <div className="flex items-center gap-2 lg:gap-4 sm:gap-2">
              <div className="relative" ref={invitesRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInvites((prev) => !prev)}
                  className="relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                >
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:block ml-2">Notifications</span>
                  {(pendingInvites.length > 0 || approvedNotificationsList.length > 0 || (pendingStudentRegistrations?.length ?? 0) > 0 || localRejectedRegistrations.length > 0|| systemUnreadCount > 0) && <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500" />}
                </Button>

                {showInvites && <InviteDropdown
                 setShowInvites={setShowInvites}
                  onRejectClick={(invite) => {
                    setSelectedInvite(null);
                    setShowInvites(false);
                  }}
                  systemNotifications={systemNotifications}
                  onMarkSystemRead={(id) => {
                    markSystemRead({ params: { path: { notificationId: id,
 } } });
                    setSystemNotifications(prev =>
                      prev.map(n => n._id === id ? { ...n, read: true } : n)
                    );
                  }}
                  onMarkAllSystemRead={() => {
                    markAllSystemRead({});
                    setSystemNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  }}
                  selectedInvite={selectedInvite}
                  setSelectedInvite={setSelectedInvite}
                  setPendingInvites={setPendingInvites}
                  pendingInvites={pendingInvites}
                  approvedNotifications={approvedNotificationsList}
                  setApprovedNotifications={setApprovedNotificationsList}
                  pendingStudentRegistrations={pendingStudentRegistrations ?? []}
                  rejectedStudentRegistrations={localRejectedRegistrations}
                  onDismissRejected={(id) => {
                    setLocalRejectedRegistrations(prev => prev.filter(r => r._id !== id));
                  }}
                />}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmLogout(true)}
                className="relative  h-10 px-4 text-sm font-medium transition-all duration-300  hover:text-red-600 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 hover:shadow-red-500/10 dark:hover:text-red-400  dark:hover:bg-gradient-to-r dark:over:from-red-500/10 dark:hover:to-red-400/5"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block ml-2">Logout</span>
              </Button>

              <div className="relative">
                <ThemeToggle />
              </div>

              <Link to="/student/profile" className="group relative">
                <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-primary/10 via-transparent to-secondary/10 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110 blur-sm" />
                <Avatar className="relative h-8 w-8 sm:h-9 sm:w-9 cursor-pointer border-2 border-transparent transition-all duration-300 group-hover:border-primary/20 group-hover:shadow-xl group-hover:shadow-primary/20 group-hover:scale-105">
                  <AvatarImage
                    src={user?.avatar || "/placeholder.svg"}
                    alt={user?.name}
                    className="transition-all duration-300"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 text-primary font-bold text-sm transition-all duration-300 group-hover:from-primary/25 group-hover:to-primary/10">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden h-9 px-2 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground"
              >
                {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border/20 shadow-lg">
            <div className="px-4 py-4 space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground"
                asChild
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Link to="/student">
                  <span>Dashboard</span>
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground"
                asChild
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Link to="/student/issues">
                  <span>My Flags</span>
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground"
                asChild
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Link to="/student/courses">
                  <span>Courses</span>
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground"
                asChild
                onClick={() => { setIsMobileMenuOpen(false); markAnnouncementsSeen(); }}
              >
                {/* @ts-ignore */}
                <Link to="/student/announcements">
                  <span>Announcements</span>
                  {hasNewAnnouncements && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </header>
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

      <main className="relative flex flex-1 flex-col p-6">
        {/* Content background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none" />
        <div className="relative z-10 h-full">
          <Outlet />
        </div>
      </main>

    </div>
  )
}
