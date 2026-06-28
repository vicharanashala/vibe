"use client"

import { Outlet } from "@tanstack/react-router"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { StudentSidebar } from "@/components/student-sidebar/StudentSidebar"

export default function StudentLayout() {
  return (
    <SidebarProvider>
      <StudentSidebar />

      <SidebarInset className="bg-gradient-to-br from-background via-background to-background/95 dark:from-[#1e1e22] dark:via-[#191a1d] dark:to-[#151517]">
        {/* Ambient background effect */}
        <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-secondary/[0.02]" />

        {/* Mobile-only trigger to open the off-canvas sidebar (desktop trigger lives in the sidebar header). */}
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
        </header>

        <main className="relative flex flex-1 flex-col p-6 pt-0">
          <div className="relative z-10 h-full">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
