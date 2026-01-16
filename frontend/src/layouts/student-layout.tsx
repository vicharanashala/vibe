"use client"

import { Outlet, Link } from "@tanstack/react-router"
import { useAuthStore } from "@/store/auth-store"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { logout } from "@/utils/auth"
import { useNavigate } from "@tanstack/react-router"
import { LogOut, UserRoundCheck, Menu, X } from "lucide-react"
import { AuroraText } from "@/components/magicui/aurora-text"
import { useState } from "react"
import InviteDropdown from "@/components/inviteDropDown"
import { useInvites } from "@/hooks/hooks"
import { useRef, useEffect } from "react"
// import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb"
import ConfirmationModal from "@/app/pages/teacher/components/confirmation-modal"
// import FloatingVideo from "@/components/floating-video";
import logo from "../../public/img/vibe_logo_img.ico"

export default function StudentLayout() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { getInvites, loading, error } = useInvites(); // run after login
  const hasShownToast = useRef(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [showInvites, setShowInvites] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const invitesRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = () => {
    logout()
    navigate({ to: "/auth" })
  }

  const handleGoBack = () => {
    window.history.back()
  }

  useEffect(() => {
    const toastShown = sessionStorage.getItem("inviteToastShown");

    const getUserInvites = async () => {
      getInvites().then(result => {
        if (result?.invites.length > 0) {
          console.log(result);
          setPendingInvites(result.invites)

          if (!toastShown) {
            toast.info("You have a new invite! Check the invites dropdown.", {
              richColors: true,
            });
            sessionStorage.setItem("inviteToastShown", "true");
          }
        }
      })


    }
    if (user)
      getUserInvites();

  }, [user])

  useEffect(() => {
    if (!showInvites) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
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
                className="relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                asChild
              >
                <Link to="/student">
                  <span className="relative z-10">Dashboard</span>
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                asChild
              >
                <Link to="/student/issues">
                  <span className="relative z-10">My Flags</span>
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                asChild
              >
                <Link to="/student/courses">
                  <span className="relative z-10">Courses</span>
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
                  <UserRoundCheck className="h-4 w-4" />
                  <span className="hidden sm:block ml-2">Invites</span>
                  {pendingInvites.length > 0 && <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500" />}
                </Button>

                {showInvites && <InviteDropdown setPendingInvites={setPendingInvites} pendingInvites={pendingInvites} />}
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
            </div>
          </div>
        )}
      </header>

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
