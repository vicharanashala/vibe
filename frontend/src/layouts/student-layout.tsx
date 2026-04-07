"use client"

import { Outlet, Link } from "@tanstack/react-router"
import { useAuthStore } from "@/store/auth-store"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { logout } from "@/utils/auth"
import { useNavigate, useLocation } from "@tanstack/react-router"
import { LogOut, Menu, X, Bell, Flame, Trophy, Calendar, CheckCircle2, XCircle } from "lucide-react"
import { AuroraText } from "@/components/magicui/aurora-text"
import { useState, useRef, useEffect } from "react"
import InviteDropdown from "@/components/inviteDropDown"
import { useInvites, useGetUnreadApprovedRegistrations, useGetPendingStudentRegistrations, useGetRejectedStudentRegistrations, useUserEnrollments } from "@/hooks/hooks"
import { useStudentStreak } from "@/hooks/streak-hooks"
import logo from "../../public/img/vibe_logo_img.ico"
import { PolicyAcknowledgementModal } from "@/app/pages/student/components/policies/PolicyAcknowledgementModal"
import { useGetSystemNotifications, useMarkSystemNotificationAsRead, useMarkAllSystemNotificationsAsRead } from "@/hooks/system-notification-hooks"
import { SystemNotification } from "@/types/notification.types";
import { type BreadcrumbItemment } from "@/types/layout.types"
import { useNewAnnouncementIndicator } from "@/hooks/use-new-announcement-indicator"
import ConfirmationModal from "@/app/pages/teacher/components/confirmation-modal"

type Invite = {
  inviteId: string;
  courseId: string;
  courseVersionId: string;
  cohortId: string;
};

export default function StudentLayout() {
  const { user, isAuthReady } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { getInvites } = useInvites(); // run after login
  const { data: approvedNotifications = [] } = useGetUnreadApprovedRegistrations(user?.uid || '');
  const { data: pendingStudentRegistrations = [] } = useGetPendingStudentRegistrations(user?.uid || '');
  const { data: rejectedStudentRegistrations = [] } = useGetRejectedStudentRegistrations(user?.uid || '');

  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [showInvites, setShowInvites] = useState(false);
  const [showStreak, setShowStreak] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const invitesRef = useRef<HTMLDivElement | null>(null);
  const streakRef = useRef<HTMLDivElement | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<Invite | null>(null);

  const { hasNew: hasNewAnnouncements, markSeen: markAnnouncementsSeen } = useNewAnnouncementIndicator();
  const { data: streakData } = useStudentStreak(!!user?.uid);
  const pathname = location.pathname;

  const [approvedNotificationsList, setApprovedNotificationsList] = useState<any[]>([]);
  const [localRejectedRegistrations, setLocalRejectedRegistrations] = useState<any[]>([]);
  const { token } = useAuthStore();
const { data: enrollmentsData } = useUserEnrollments(1, 100, !!token && !!user?.uid);
const enrollments = enrollmentsData?.enrollments ?? [];
console.log("Enrollments from student layout -> ", enrollments)
let hasHpSystem = false;
enrollments.forEach(obj => {
  if(obj.hpSystem === true && obj.status === "ACTIVE" && obj. 
percentCompleted !== 100){
    hasHpSystem = true;
  }
})

  const isActive = (path: string) => {
    if (path === "/student") return pathname === "/student";
    return pathname === path || pathname.startsWith(path + "/");
  };

  // Sync local state with hook data
  useEffect(() => {
    if (approvedNotifications && approvedNotifications.length !== approvedNotificationsList.length) {
      setApprovedNotificationsList(approvedNotifications);
    }
  }, [approvedNotifications, setApprovedNotificationsList,approvedNotificationsList]);

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

  const { notifications: fetchedSystemNotifications = [], unreadCount: systemUnreadCount = 0 } =
    useGetSystemNotifications(user?.uid || '', false, !!user?.uid);
  const { mutate: markSystemRead } = useMarkSystemNotificationAsRead();
  const { mutate: markAllSystemRead } = useMarkAllSystemNotificationsAsRead();

  const invitationCount =
    pendingInvites.length +
    (approvedNotifications?.length || 0) +
    (pendingStudentRegistrations?.length || 0) +
    (rejectedStudentRegistrations?.length || 0);

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
      // Comparison logic: if there are ANY unread approved notifications, show toast once per session
      if (approvedNotifications && approvedNotifications.length > 0 && !notificationToastShown) {
        toast.info("You have new course approvals! Check notifications.", {
          richColors: true,
        });
        sessionStorage.setItem("notificationToastShown", "true");
      }

      // Clear flag ONLY if no notifications exist (allows toast to show next time if new ones arrive)
      if (approvedNotifications && approvedNotifications.length === 0) {
        sessionStorage.removeItem("notificationToastShown");
      }
    };

    getUserInvites();
    checkNotifications();

  }, [user, isAuthReady, approvedNotifications.length]);

  useEffect(() => {
    if (!showInvites) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (selectedInvite) return;
      // Don't close if the click is inside any open dialog portal
      if ((target as Element)?.closest?.('[role="dialog"]')) return;
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
  }, [showInvites, selectedInvite]);

  // Click-outside handler for streak popover
  useEffect(() => {
    if (!showStreak) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (streakRef.current && target && !streakRef.current.contains(target)) {
        setShowStreak(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowStreak(false);
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
  }, [showStreak]);

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
          <div className="flex items-center gap-8">
            <Link to="/student" className="relative z-20 flex items-center text-xl font-bold tracking-tight group cursor-pointer">
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
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r Phillips-before:from-primary/5 Phillips-before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300  ${isActive("/student")
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
                className={`relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary Phillips-before:absolute Phillips-before:inset-0 Phillips-before:rounded-md Phillips-before:bg-gradient-to-r Phillips-before:from-primary/5 Phillips-before:to-transparent Phillips-before:opacity-0 hover:before:opacity-100 Phillips-before:transition-opacity Phillips-before:duration-300 ${isActive("/student/issues")
                  ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-md Phillips-before:opacity-100"
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
                className={`relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary Phillips-before:absolute Phillips-before:inset-0 Phillips-before:rounded-md Phillips-before:bg-gradient-to-r Phillips-before:from-primary/5 Phillips-before:to-transparent Phillips-before:opacity-0 hover:before:opacity-100 Phillips-before:transition-opacity Phillips-before:duration-300 ${isActive("/student/courses")
                  ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-md Phillips-before:opacity-100"
                  : ""
                  }`}
                asChild
              >
                <Link to="/student/courses">
                  <span className="relative z-10">Courses</span>
                </Link>
              </Button>

              {hasHpSystem && <Button
                variant="ghost"
                size="sm"
                className={`relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary Phillips-before:absolute Phillips-before:inset-0 Phillips-before:rounded-md Phillips-before:bg-gradient-to-r Phillips-before:from-primary/5 Phillips-before:to-transparent Phillips-before:opacity-0 hover:before:opacity-100 Phillips-before:transition-opacity Phillips-before:duration-300 ${isActive("/student/hp-system/cohorts")
                  ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-md Phillips-before:opacity-100"
                  : ""
                  }`}
                asChild
              >
                <Link to="/student/hp-system/cohorts">
                  <span className="relative z-10">HP System</span>
                </Link>
              </Button>}

              <Button
                variant="ghost"
                size="sm"
                className={`relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary Phillips-before:absolute Phillips-before:inset-0 Phillips-before:rounded-md Phillips-before:bg-gradient-to-r Phillips-before:from-primary/5 Phillips-before:to-transparent Phillips-before:opacity-0 hover:before:opacity-100 Phillips-before:transition-opacity Phillips-before:duration-300 ${isActive("/student/announcements")
                  ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-md Phillips-before:opacity-100"
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
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {/* 🔥 Learning Streak with Popover */}
            <div className="relative" ref={streakRef}>
              <button
                onClick={() => setShowStreak((prev) => !prev)}
                className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer
                  bg-gradient-to-r from-orange-500/10 to-red-500/10 
                  border border-orange-500/20 
                  transition-all duration-300 
                  hover:from-orange-500/20 hover:to-red-500/20 
                  hover:border-orange-400/40 hover:shadow-lg hover:shadow-orange-500/10
                  focus:outline-none focus:ring-2 focus:ring-orange-400/30
                  ${showStreak ? 'from-orange-500/20 to-red-500/20 border-orange-400/40 shadow-lg shadow-orange-500/10' : ''}`}
              >
                <Flame className={`h-4 w-4 transition-all duration-300 ${
                  (streakData?.currentStreak || 0) > 0 
                    ? 'text-orange-400 group-hover:text-orange-300 drop-shadow-[0_0_4px_rgba(251,146,60,0.5)]' 
                    : 'text-gray-400 group-hover:text-gray-300'
                }`} />
                <span className={`text-sm font-bold transition-all duration-300 ${
                  (streakData?.currentStreak || 0) > 0 
                    ? 'text-orange-400 group-hover:text-orange-300' 
                    : 'text-gray-400 group-hover:text-gray-300'
                }`}>
                  {streakData?.currentStreak || 0}
                </span>
                {streakData?.isActiveToday && (
                  <span className="absolute -top-0.5 -right-0.5 block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                )}
              </button>

              {/* Streak Popover */}
              {showStreak && (
                <div className="absolute right-0 top-full mt-2 w-80 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="rounded-xl border border-orange-500/20 bg-background/95 backdrop-blur-xl shadow-2xl shadow-orange-500/10 overflow-hidden">
                    {/* Header */}
                    <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-transparent">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-foreground">Learning Streak</h3>
                        <button
                          onClick={() => setShowStreak(false)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent/50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {/* Big Streak Display */}
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-14 h-14 rounded-2xl ${
                          (streakData?.currentStreak || 0) > 0
                            ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30'
                            : 'bg-muted/50 border border-border/50'
                        }`}>
                          <Flame className={`h-7 w-7 ${
                            (streakData?.currentStreak || 0) > 0
                              ? 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]'
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <div className={`text-3xl font-bold ${
                            (streakData?.currentStreak || 0) > 0 ? 'text-orange-400' : 'text-muted-foreground'
                          }`}>
                            {streakData?.currentStreak || 0}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium">
                            {(streakData?.currentStreak || 0) === 1 ? 'day streak' : 'days streak'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="px-5 py-4 space-y-3">
                      {/* Longest Streak */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 border border-border/30 transition-colors hover:bg-accent/50">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <Trophy className="h-4.5 w-4.5 text-yellow-500" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground font-medium">Longest Streak</div>
                          <div className="text-sm font-bold text-foreground">
                            {streakData?.longestStreak || 0} {(streakData?.longestStreak || 0) === 1 ? 'day' : 'days'}
                          </div>
                        </div>
                      </div>

                      {/* Last Active */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 border border-border/30 transition-colors hover:bg-accent/50">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <Calendar className="h-4.5 w-4.5 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground font-medium">Last Active</div>
                          <div className="text-sm font-bold text-foreground">
                            {streakData?.lastActiveDate
                              ? new Date(streakData.lastActiveDate + 'T00:00:00+05:30').toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'No activity yet'}
                          </div>
                        </div>
                      </div>

                      {/* Active Today */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 border border-border/30 transition-colors hover:bg-accent/50">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-lg border ${
                          streakData?.isActiveToday
                            ? 'bg-green-500/10 border-green-500/20'
                            : 'bg-red-500/10 border-red-500/20'
                        }`}>
                          {streakData?.isActiveToday
                            ? <CheckCircle2 className="h-4.5 w-4.5 text-green-400" />
                            : <XCircle className="h-4.5 w-4.5 text-red-400" />
                          }
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground font-medium">Today's Status</div>
                          <div className={`text-sm font-bold ${
                            streakData?.isActiveToday ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {streakData?.isActiveToday ? 'Active ✓' : 'Not yet active'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Motivation */}
                    <div className="px-5 py-3 border-t border-border/30 bg-accent/10">
                      <p className="text-xs text-muted-foreground text-center">
                        {streakData?.isActiveToday
                          ? '🎉 Great job! You\'re on fire today!'
                          : (streakData?.currentStreak || 0) > 0
                            ? '⏰ Complete a lesson today to keep your streak alive!'
                            : '💪 Watch a video to start building your streak!'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={invitesRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInvites((prev) => !prev)}
                className="relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:shadow-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10"
              >
                <Bell className="h-4 w-4" />
                <span className="hidden sm:block ml-2">Notifications</span>
                {(invitationCount > 0 || systemUnreadCount > 0) && <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500" />}
              </Button>

              {showInvites && (
                <InviteDropdown
                  setShowInvites={setShowInvites}
                  enrollments={enrollments}
                  onRejectClick={(invite) => {
                    setSelectedInvite(null);
                    setShowInvites(false);
                  }}
                  systemNotifications={fetchedSystemNotifications}
                  onMarkSystemRead={(id) => {
                    // @ts-ignore - notificationId type mismatch in generated client
                    markSystemRead({ params: { path: { notificationId: id } } });
                  }}
                  onMarkAllSystemRead={() => {
                    markAllSystemRead({});
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
                />
              )}
            </div>

            <div className="relative">
              <ThemeToggle />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmLogout(true)}
              className="relative h-10 w-10 transition-all duration-300 hover:text-red-600 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 dark:hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />
            </Button>

            <Link to="/student/profile" className="group relative">
              <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-primary/10 via-transparent to-secondary/10 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110 blur-sm" />
              <Avatar className="relative h-9 w-9 cursor-pointer border-2 border-transparent transition-all duration-300 group-hover:border-primary/20 group-hover:shadow-xl group-hover:shadow-primary/20 group-hover:scale-105">
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
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Link to="/student/hp-system/cohorts">
                  <span>Cohorts</span>
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

              {/* 🔥 Mobile Streak Display */}
              <button
                onClick={() => { setIsMobileMenuOpen(false); setShowStreak(true); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-accent/30 transition-colors"
              >
                <Flame className={`h-4 w-4 ${
                  (streakData?.currentStreak || 0) > 0 
                    ? 'text-orange-400' 
                    : 'text-gray-400'
                }`} />
                <span className={`text-sm font-bold ${
                  (streakData?.currentStreak || 0) > 0 
                    ? 'text-orange-400' 
                    : 'text-gray-400'
                }`}>
                  🔥 {streakData?.currentStreak || 0} day streak
                </span>
                {streakData?.isActiveToday && (
                  <span className="ml-auto inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                )}
              </button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground"
                asChild
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Link to="/student/notifications">
                  <span>Notifications</span>
                  {(invitationCount > 0 || systemUnreadCount > 0) && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
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
