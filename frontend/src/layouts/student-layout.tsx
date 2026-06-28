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

      <SidebarInset className="min-w-0 bg-white dark:bg-[#151517]">
        {/* Mobile-only trigger to open the off-canvas sidebar (desktop trigger lives in the sidebar header). */}
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
        </header>

        <main className="relative flex min-w-0 flex-1 flex-col p-4 md:p-6">
          <div className="relative z-10 mx-auto h-full w-full min-w-0 max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
