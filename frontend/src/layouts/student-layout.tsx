"use client"

import { Outlet, Link } from "@tanstack/react-router"
import { useAuthStore } from "@/store/auth-store"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { logout } from "@/utils/auth"
import { useNavigate } from "@tanstack/react-router"
import { LogOut } from "lucide-react"
import { AuroraText } from "@/components/magicui/aurora-text"
// import FloatingVideo from "@/components/floating-video";

export default function StudentLayout() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate({ to: "/auth" })
  }

  // console.log('Current user role:', user?.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
      {/* <FloatingVideo isVisible={user?.role === 'student'}></FloatingVideo> */}

      {/* Ambient background effect */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-secondary/[0.02] pointer-events-none" />

      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b border-border/20 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 transition-all duration-300 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-primary/[0.02] before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
        <div className="flex w-full items-center justify-between px-8 relative z-10">
          <div className="relative z-20 flex items-center text-xl font-bold tracking-tight group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg overflow-hidden">
                <img
                  src="https://continuousactivelearning.github.io/vibe/img/logo.png"
                  alt="Vibe Logo"
                  className="h-12 w-12 object-contain"
                />
              </div>
              <span className="text-3xl font-bold">
                <AuroraText colors={["#A07CFE", "#FE8FB5", "#FFBE7B"]}>Vibe</AuroraText>
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
          <div className="flex items-center gap-4">
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
              <Link to="/student/courses">
                <span className="relative z-10">Courses</span>
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="relative h-10 px-3 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 hover:text-red-600 dark:hover:text-red-400 hover:shadow-lg hover:shadow-red-500/10 before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-red-500/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:block ml-2">Logout</span>
            </Button>

            <div className="relative">
              <ThemeToggle />
            </div>

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
          </div>
        </div>
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
