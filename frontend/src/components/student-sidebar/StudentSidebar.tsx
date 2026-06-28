"use client"

import { useState } from "react"
import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { LogOut } from "lucide-react"
import { useAuthStore } from "@/store/auth-store"
import { useUserEnrollments } from "@/hooks/hooks"
import { useNewAnnouncementIndicator } from "@/hooks/use-new-announcement-indicator"
import { logout } from "@/utils/auth"
import { AuroraText } from "@/components/magicui/aurora-text"
import { ThemeToggle } from "@/components/theme-toggle"
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
  useSidebar,
} from "@/components/ui/sidebar"
import logo from "../../../public/img/vibe_logo_img.ico"
import { STUDENT_NAV_ITEMS } from "./nav-items"
import { StudentNotifications } from "./StudentNotifications"

export function StudentSidebar() {
  const { state } = useSidebar()
  const { user, token } = useAuthStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
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

  // One flat yellow used for every item's hover + active background.
  const yellowItem =
    "hover:bg-yellow-100 hover:text-yellow-900 data-[active=true]:bg-yellow-100 data-[active=true]:text-yellow-900 " +
    "dark:hover:bg-yellow-400/10 dark:hover:text-yellow-100 dark:data-[active=true]:bg-yellow-400/10 dark:data-[active=true]:text-yellow-100"

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
          <Link to="/student" className="flex items-center gap-3 pl-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
              <img src={logo} alt="Vibe Logo" className="h-9 w-9 object-contain" />
            </div>
            {state === "expanded" && (
              <span className="text-2xl font-bold">
                <AuroraText colors={["#A07CFE", "#FE8FB5", "#FFBE7B"]}><b>ViBe</b></AuroraText>
              </span>
            )}
          </Link>
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
            {/* Profile tile: avatar + name link, with notifications, settings & theme on the right */}
            <SidebarMenuItem>
              <div className="flex items-center gap-1 rounded-md p-1 group-data-[collapsible=icon]:p-0">
                <Link
                  to="/student/profile"
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 transition-colors group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center ${yellowItem}`}
                >
                  <Avatar className="h-7 w-7 shrink-0 border border-border/20">
                    <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-bold text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col text-left group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-medium" title={user?.name}>{user?.name || "User"}</span>
                    <span className="text-xs text-muted-foreground">View Profile</span>
                  </div>
                </Link>

                <div className="flex items-center gap-0.5 group-data-[collapsible=icon]:hidden">
                  <StudentNotifications compact />
                  <ThemeToggle />
                </div>
              </div>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setConfirmLogout(true)}
                tooltip="Logout"
                className="h-10 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400 [&>svg]:size-5"
              >
                <LogOut className="size-5" />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </>
  )
}
