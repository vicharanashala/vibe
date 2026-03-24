"use client"

import * as React from "react"
import {
  BookOpen,
  Megaphone,
} from "lucide-react"

import { NavMain } from "./nav-main"
import { AuroraText } from "@/components/magicui/aurora-text"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Link } from "@tanstack/react-router"
import logo from "@/img/vibe_logo_img.ico"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuthStore } from "@/store/auth-store"

export function AppSidebar() {
  const { state } = useSidebar()

  // ✅ IMPORTANT FIX: use hook, NOT getState()
  const user = useAuthStore((state) => state.user)

  const data = {
    user: {
      name: user?.name || "User",
      avatar: user?.avatar || "",
    },
    navMain: [
      {
        title: "Courses",
        url: "#",
        icon: BookOpen,
        items: [
          { title: "Create Course", url: "/teacher/courses/create" },
          { title: "All Courses", url: "/teacher" },
        ],
      },
      {
        title: "Announcements",
        url: "/teacher/announcements",
        icon: Megaphone,
      },
    ],
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-r">
      <SidebarHeader className="flex items-center px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-lg shrink-0">
            <img
              src={logo}
              alt="Vibe Logo"
              className="h-10 w-10 object-contain"
            />
          </div>

          {state === "expanded" && (
            <span className="text-2xl font-bold">
              <AuroraText colors={["#A07CFE", "#FE8FB5", "#FFBE7B"]}>
                <b>ViBe</b>
              </AuroraText>
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>

      <SidebarFooter>
        {state === "expanded" && (
          <Link
            to="/teacher/profile"
            className="group flex w-full cursor-pointer items-center gap-3 rounded-md px-4 py-3 transition hover:bg-accent/30"
          >
            <Avatar className="h-9 w-9 border border-border/20">
              <AvatarImage
                src={data.user.avatar || "/placeholder.svg"}
                alt={data.user.name}
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-bold text-primary">
                {data.user.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>

            <div className="flex min-w-0 flex-col text-left">
              <div
                className="truncate text-sm font-medium"
                title={data.user.name}
              >
                {data.user.name}
              </div>
              <div className="text-xs text-muted-foreground">
                View Profile
              </div>
            </div>
          </Link>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}