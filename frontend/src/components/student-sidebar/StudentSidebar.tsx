"use client"

import { useState } from "react"
import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { LogOut, Settings, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuthStore } from "@/store/auth-store"
import { useUserEnrollments } from "@/hooks/hooks"
import { useNewAnnouncementIndicator } from "@/hooks/use-new-announcement-indicator"
import { logout } from "@/utils/auth"
import { AuroraText } from "@/components/magicui/aurora-text"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import ConfirmationModal from "@/app/pages/teacher/components/confirmation-modal"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import logo from "../../../public/img/vibe_logo_img.ico"
import { STUDENT_NAV_ITEMS } from "./nav-items"
import { StudentNotifications } from "./StudentNotifications"

export function StudentSidebar() {
  const { user, token } = useAuthStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { theme, setTheme } = useTheme()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const { hasNew: hasNewAnnouncements, markSeen: markAnnouncementsSeen } = useNewAnnouncementIndicator()

  // HP System nav item only shows when the student has an active HP-enabled course.
  const { data: enrollmentsData } = useUserEnrollments(1, 100, !!token && !!user?.uid)
  const hasHpSystem = (enrollmentsData?.enrollments ?? []).some(
    (e) => e.hpSystem === true && e.status === "ACTIVE" && e.percentCompleted !== 100,
  )

  const isActive = (path: string) =>
    path === "/student" ? pathname === "/student" : pathname === path || pathname.startsWith(path + "/")

  const handleLogout = () => {
    logout()
    navigate({ to: "/auth" })
  }

  const visibleItems = STUDENT_NAV_ITEMS.filter(
    (item) => item.requires !== "hpSystem" || hasHpSystem,
  )

  // One flat yellow for hover/active/press — the active:* + ring overrides kill
  // the default amber "sidebar-accent" press shade so clicking never flashes orange.
  const yellowItem =
    "hover:bg-yellow-100 hover:text-yellow-900 active:bg-yellow-100 active:text-yellow-900 " +
    "data-[active=true]:bg-yellow-100 data-[active=true]:text-yellow-900 focus-visible:ring-yellow-300 " +
    "dark:hover:bg-yellow-400/10 dark:hover:text-yellow-100 dark:active:bg-yellow-400/10 " +
    "dark:data-[active=true]:bg-yellow-400/10 dark:data-[active=true]:text-yellow-100"

  return (
    <>
      <ConfirmationModal
        isOpen={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        description="Are you sure you want to log out? You will need to sign in again to access your dashboard."
      />

      <Sidebar collapsible="icon" variant="sidebar" className="border-r bg-white dark:bg-[#17171a] [&_[data-sidebar=sidebar]]:bg-white dark:[&_[data-sidebar=sidebar]]:bg-[#17171a]">
        <SidebarHeader className="px-2 py-4">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
            <Link to="/student" className="flex items-center gap-3 pl-1 group-data-[collapsible=icon]:pl-0">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                <img src={logo} alt="Vibe Logo" className="h-9 w-9 object-contain" />
              </div>
              <span className="text-2xl font-bold group-data-[collapsible=icon]:hidden">
                <AuroraText colors={["#A07CFE", "#FE8FB5", "#FFBE7B"]}><b>ViBe</b></AuroraText>
              </span>
            </Link>
            <SidebarTrigger className="ml-auto group-data-[collapsible=icon]:ml-0" />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const Icon = item.icon
                  const showDot = item.indicator === "announcements" && hasNewAnnouncements
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.to)}
                        tooltip={item.title}
                        onClick={item.indicator === "announcements" ? markAnnouncementsSeen : undefined}
                        className={`h-10 [&>svg]:size-5 ${yellowItem}`}
                      >
                        <Link to={item.to} className="relative">
                          <Icon className="size-5" />
                          <span>{item.title}</span>
                          {showDot && (
                            <span className="absolute left-5 top-1.5 block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            {/* Profile tile: avatar + name (display only); only the settings icon navigates */}
            <SidebarMenuItem>
              <div className="flex items-center gap-1 rounded-md p-1 group-data-[collapsible=icon]:p-0">
                <div className="flex min-w-0 flex-1 items-center gap-2 p-1 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-7 w-7 shrink-0 border border-border/20">
                    <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-bold text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate text-sm font-medium group-data-[collapsible=icon]:hidden" title={user?.name}>
                    {user?.name || "User"}
                  </span>
                </div>

                <Link
                  to="/student/profile"
                  aria-label="Settings"
                  title="Settings"
                  className={`flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground group-data-[collapsible=icon]:hidden ${yellowItem}`}
                >
                  <Settings className="size-4" />
                </Link>
              </div>
            </SidebarMenuItem>

            {/* Actions row: notifications, theme + logout, right-aligned */}
            <SidebarMenuItem>
              <div className="flex items-center gap-1 px-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center">
                <button
                  type="button"
                  onClick={() => setConfirmLogout(true)}
                  title="Logout"
                  className="flex h-7 items-center gap-1.5 rounded-md bg-red-50 px-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 group-data-[collapsible=icon]:size-7 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                  <LogOut className="size-3.5" />
                  <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                </button>

                <div className="ml-auto flex items-center gap-1 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:flex-col">
                  <StudentNotifications compact />
                  <button
                    type="button"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    aria-label="Toggle theme"
                    title="Toggle theme"
                    className={`flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground ${yellowItem}`}
                  >
                    <Sun className="size-4 dark:hidden" />
                    <Moon className="hidden size-4 dark:block" />
                  </button>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </>
  )
}
