import * as React from "react"
import { Plus } from "lucide-react"

import { Calendars } from "@/components/calendars"
import { DatePicker } from "@/components/date-picker"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import MultiPersonDetection from "./proctoring-components/MultiPersonDetection"
import CameraAndMicCheck from "./proctoring-components/CameraAndMicCheck"
import RealTimeHandBlurDetection from "./proctoring-components/RealTimeBlurDetection"
import FacePoseDetection from "./proctoring-components/FacePoseDetector"
import VoiceActivityDetection from "./proctoring-components/VoiceActivityDetection"
import { ModeToggle } from "./mode-toggle"


// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  calendars: [
    {
      name: "My Schedules",
      items: [],
    },
    {
      name: "Announcements",
      items: [],
    },
    {
      name: "Updates",
      items: [],
    },
  ],
}

export function SidebarRight({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible="none"
      className="sticky hidden lg:flex top-0 h-svh border-l"
      {...props}
    >
      <SidebarHeader className="h-16 border-b border-sidebar-border">
        <NavUser user={data.user} />
      </SidebarHeader>
      <SidebarContent>
        <DatePicker />
        <SidebarSeparator className="mx-0" />
        <Calendars calendars={data.calendars} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
        <MultiPersonDetection/>
        <RealTimeHandBlurDetection/>
        <VoiceActivityDetection/>
        <FacePoseDetection/>
        <CameraAndMicCheck/>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Plus />
              <span>New Schedule</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
