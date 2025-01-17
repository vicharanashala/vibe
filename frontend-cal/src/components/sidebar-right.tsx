import * as React from 'react'
import { Plus } from 'lucide-react'

import { Calendars } from '@/components/calendars'
import { DatePicker } from '@/components/date-picker'
import { NavUser } from '@/components/nav-user'
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
} from '@/components/ui/sidebar'
import CameraAndMicCheck from './proctoring-components/CameraAndMicCheck'
import { ModeToggle } from './mode-toggle'
import ParentComponent from './proctoring-components/ParentComponent'
import BlurDetectction from './proctoring-components/BlurDetection'
import SnapshotRecorder from './proctoring-components/SnapshotRecorder'

// This is sample data.
const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  calendars: [
    {
      name: 'My Schedules',
      items: [],
    },
    {
      name: 'Announcements',
      items: [],
    },
    {
      name: 'Updates',
      items: [],
    },
  ],
}

export function SidebarRight({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible='none'
      className='sticky top-0 hidden h-svh border-l lg:flex'
      {...props}
    >
      <SidebarHeader className='h-16 border-b border-sidebar-border'>
        <NavUser user={data.user} />
      </SidebarHeader>
      <SidebarContent>
        <Calendars calendars={data.calendars} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <ParentComponent />
          <CameraAndMicCheck />
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
