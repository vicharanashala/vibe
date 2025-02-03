/**
 * SidebarRight Component
 *
 * This component provides a right sidebar interface with the following features:
 * - User profile display and management
 * - Calendar sections and schedules
 * - Proctoring tools integration
 * - New schedule creation
 *
 * Layout Structure:
 * - Header: Contains user profile information
 * - Content: Displays calendar sections and items
 * - Footer: Houses proctoring tools and schedule creation
 *
 * Features:
 * - Responsive design (hidden on mobile, visible on large screens)
 * - Sticky positioning at the top
 * - Non-collapsible sidebar
 * - Integrated proctoring tools for exam monitoring
 * - Calendar management interface
 *
 * Props:
 * - Extends React.ComponentProps<typeof Sidebar>
 * - Allows passing through additional sidebar properties
 *
 * Dependencies:
 * - React for component architecture
 * - Lucide icons for UI elements
 * - Custom UI components (Sidebar, NavUser, Calendars)
 * - Proctoring components for exam monitoring
 */

// Import React and required icons
import * as React from 'react'
import { Plus } from 'lucide-react'

// Import custom components
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
} from '@/components/ui/sidebar'

// Import proctoring related components
import CameraAndMicCheck from './proctoring-components/CameraAndMicCheck'
import { ModeToggle } from './mode-toggle'
import ParentComponent from './proctoring-components/ParentComponent'
import BlurDetectction from './proctoring-components/BlurDetection'
import SnapshotRecorder from './proctoring-components/SnapshotRecorder'

// Sample data for user profile and calendars
const data = {
  // User profile information
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  // Calendar sections with empty items arrays
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

// SidebarRight component that displays user profile, calendars and proctoring tools
export function SidebarRight({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible='none'
      className='sticky top-0 hidden h-svh border-l lg:flex'
      {...props}
    >
      {/* Header section with user profile */}
      <SidebarHeader className='h-16 border-b border-sidebar-border'>
        <NavUser user={data.user} />
      </SidebarHeader>

      {/* Main content section with calendars */}
      <SidebarContent>
        <Calendars calendars={data.calendars} />
      </SidebarContent>

      {/* Footer section with proctoring tools and new schedule button */}
      <SidebarFooter>
        <SidebarMenu>
          {/* <ParentComponent /> */}
          {/* <CameraAndMicCheck /> */}
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
