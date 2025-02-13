/**
 * SidebarLeft Component
 *
 * This component provides a left sidebar interface with the following features:
 * - Team switching functionality
 * - Multi-level navigation menu (main items, subparts, sub-subparts)
 * - Secondary navigation items
 * - Responsive design with collapsible sidebar
 * - Floating panels for deeper navigation levels
 * - Integrated tooltips for better UX
 * - Logout functionality
 *
 * Layout Structure:
 * - Header: Contains team switcher
 * - Content:
 *   - Main navigation with expandable items
 *   - Secondary navigation at bottom
 * - Floating Panel: Shows additional navigation levels
 *
 * Navigation Features:
 * - Hierarchical menu structure (up to 3 levels deep)
 * - Visual indicators for selected items
 * - Smooth transitions and animations
 * - Tooltip support for collapsed state
 *
 * State Management:
 * - Tracks selected navigation items at each level
 * - Manages floating panel positioning
 * - Handles sidebar collapse state
 * - Integrates with Redux for auth state
 *
 * Props:
 * - Extends React.ComponentProps<typeof Sidebar>
 * - Allows passing through additional sidebar properties
 *
 * Dependencies:
 * - React for component architecture
 * - Lucide icons for UI elements
 * - Redux for state management
 * - React Router for navigation
 * - Custom UI components (Sidebar, Tooltip, etc.)
 */

// Indicates this is a client-side component
'use client'

// Import React and necessary icons from lucide-react library
import * as React from 'react'
import {
  AudioWaveform,
  BookMarked,
  Calendar,
  Command,
  FilePen,
  Home,
  Inbox,
  LogOut,
  MessageCircleQuestion,
  Settings2,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

// Import custom UI components and hooks
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'
import { TeamSwitcher } from '@/components/team-switcher'
import { CardContent, CardHeader, CardTitle } from './ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Import Redux and routing related hooks
import { useLogoutMutation } from '@/store/apiService'
import { useDispatch } from 'react-redux'
import { logoutState } from '@/store/slices/authSlice'
import { useNavigate } from 'react-router-dom'

// Mock data structure for sidebar navigation
// Contains teams, main navigation items and secondary navigation items
const data = {
  // Team switcher data
  teams: [
    { name: 'CAL', logo: Command, plan: 'Enterprise' },
    { name: 'CAL', logo: AudioWaveform, plan: 'Startup' },
    { name: 'CAL', logo: Command, plan: 'Free' },
  ],
  // Main navigation items with nested subparts
  navMain: [
    {
      title: 'Dashboard',
      url: '#',
      icon: Home,
      subparts: [],
    },
    {
      title: 'Courses',
      url: '#',
      icon: BookMarked,
      subparts: [
        {
          title: 'Math 101',
          url: '#math',
          subsubparts: [
            { title: 'Algebra', url: '#algebra' },
            { title: 'Geometry', url: '#geometry' },
          ],
        },
        {
          title: 'Physics 202',
          url: '#physics',
          subsubparts: [
            { title: 'Kinematics', url: '#kinematics' },
            { title: 'Dynamics', url: '#dynamics' },
          ],
        },
      ],
    },
    {
      title: 'Assignments',
      url: '#',
      icon: FilePen,
      subparts: [
        {
          title: 'Assignment 1',
          url: '#assign1',
          subsubparts: [
            { title: 'Part A', url: '#parta' },
            { title: 'Part B', url: '#partb' },
          ],
        },
      ],
    },

    {
      title: 'Announcements',
      url: '#',
      icon: Inbox,
      badge: '10',
      subparts: [
        {
          title: 'General Updates',
          url: '#updates',
          subsubparts: [
            { title: 'System Maintenance', url: '#maintenance' },
            { title: 'New Features', url: '#features' },
            { title: 'Important Dates', url: '#dates' },
          ],
        },
        {
          title: 'New Policies',
          url: '#policies',
          subsubparts: [
            { title: 'Attendance Policy', url: '#attendance' },
            { title: 'Grading System', url: '#grading' },
            { title: 'Code of Conduct', url: '#conduct' },
          ],
        },
      ],
    },
  ],
  // Secondary navigation items (bottom of sidebar)
  navSecondary: [
    { title: 'Calendar', url: '#', icon: Calendar },
    { title: 'Settings', url: '#', icon: Settings2 },
    {
      title: 'Logout',
      url: '#',
      icon: LogOut,
      onclick: () => {
        handleLogout()
      },
    },
    { title: 'Trash', url: '#', icon: Trash2 },
    { title: 'Help', url: '#', icon: MessageCircleQuestion },
  ],
}

// Main SidebarLeft component
export function SidebarLeft({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  // State management for navigation selections and positioning
  const [selectedNav, setSelectedNav] = React.useState<NavItem | null>(null)
  const [selectedSubpart, setSelectedSubpart] = React.useState<Subpart | null>(
    null
  )
  const [selectedSubsubpart, setSelectedSubsubpart] =
    React.useState<Subsubpart | null>(null)
  const [subpartPosition, setSubpartPosition] = React.useState({
    top: 0,
    left: 0,
  })

  // Hooks for sidebar, navigation and Redux state management
  const { setOpen } = useSidebar()
  const dispatch = useDispatch()
  const [logout] = useLogoutMutation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout().unwrap()
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      dispatch(logoutState())
      navigate('/login')
    }
  }

  // Handle user logout

  // TypeScript interfaces for navigation items
  interface NavItem {
    title: string
    url: string
    icon: React.ComponentType
    subparts: Subpart[]
    badge?: string
  }

  interface Subpart {
    title: string
    url: string
    subsubparts: Subsubpart[]
  }

  interface Subsubpart {
    title: string
    url: string
  }

  // Handle main navigation item click
  const handleNavClick = (item: NavItem) => {
    if (selectedNav?.title === item.title) {
      setSelectedNav(null)
    } else {
      setSelectedNav(item)
      setOpen(true)
    }
    setSelectedSubpart(null)
    setSelectedSubsubpart(null)
  }

  // Handle subpart item click and position floating panel
  const handleSubpartClick = (subpart: Subpart, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setSubpartPosition({
      top: rect.top,
      left: rect.right + 8, // 8px offset from the button
    })
    setSelectedSubpart(subpart)
    setSelectedSubsubpart(null)
  }

  // Handle sub-subpart item click
  const handleSubsubpartClick = (subsubpart: Subsubpart) => {
    setSelectedSubsubpart(subsubpart)
  }

  return (
    <div className='flex h-screen'>
      {/* Left Sidebar */}
      <Sidebar className='w-60 border-r' {...props} collapsible='icon'>
        <SidebarHeader className='py-3 pl-2 pr-4'>
          <TeamSwitcher teams={data.teams} />
        </SidebarHeader>
        <SidebarContent className='flex-col justify-between px-2'>
          {/* Main navigation section */}
          <nav className='space-y-1'>
            {data.navMain.map((item) => (
              <div key={item.title}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <SidebarMenuButton
                        className={`flex w-56 items-center justify-between rounded-md py-2 pl-2 pr-4 text-left text-sm ${
                          selectedNav?.title === item.title ? 'bg-accent' : ''
                        }`}
                        onClick={() => handleNavClick(item)}
                      >
                        <div className='flex items-center'>
                          <item.icon className='mr-3 size-5' />
                          <span className='flex-1'>{item.title}</span>
                        </div>
                        {item.subparts.length > 0 && (
                          <span className='ml-2'>
                            {selectedNav?.title === item.title ? (
                              <ChevronDown className='size-4' />
                            ) : (
                              <ChevronRight className='size-4' />
                            )}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.title}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Render subparts when main item is selected */}
                {selectedNav?.title === item.title &&
                  item.subparts.length > 0 && (
                    <div className='space-y-1 pl-8'>
                      {item.subparts.map((subpart) => (
                        <SidebarMenuButton
                          key={subpart.title}
                          className={`w-full text-left text-sm ${
                            selectedSubpart?.title === subpart.title
                              ? 'bg-accent'
                              : ''
                          } hover:bg-accent`}
                          onClick={(e) => handleSubpartClick(subpart, e)}
                        >
                          {subpart.title}
                        </SidebarMenuButton>
                      ))}
                    </div>
                  )}
              </div>
            ))}
          </nav>
          {/* Secondary navigation section */}
          <nav className='space-y-1'>
            {data.navSecondary.map((item) => (
              <SidebarMenuButton
                key={item.title}
                onClick={() => {
                  if (item.title === 'Logout') {
                    // Use Logout component here
                    handleLogout()
                  } else {
                    window.location.href = item.url
                  }
                }}
                className='flex items-center rounded-md py-2 pl-2 pr-4 text-sm'
              >
                <item.icon className='mr-3 flex size-5' />
                <span>{item.title}</span>
              </SidebarMenuButton>
            ))}
          </nav>
        </SidebarContent>
      </Sidebar>

      {/* Floating Panel for Subparts - Shows when a subpart is selected */}
      {selectedSubpart && (
        <div
          className='fixed z-50 w-64 rounded-md border bg-background shadow-lg'
          style={{
            top: `${subpartPosition.top}px`,
            left: `${subpartPosition.left}px`,
            maxHeight: '300px',
            overflow: 'auto',
          }}
        >
          <CardHeader className='p-4'>
            <CardTitle className='text-lg'>{selectedSubpart.title}</CardTitle>
          </CardHeader>
          <CardContent className='p-4'>
            <ul className='space-y-2'>
              {selectedSubpart.subsubparts.map((subsubpart) => (
                <li key={subsubpart.title}>
                  <SidebarMenuButton
                    className={`w-full ${
                      selectedSubsubpart?.title === subsubpart.title
                        ? 'bg-accent'
                        : ''
                    }`}
                    onClick={() => handleSubsubpartClick(subsubpart)}
                  >
                    {subsubpart.title}
                  </SidebarMenuButton>
                </li>
              ))}
            </ul>
          </CardContent>
        </div>
      )}
    </div>
  )
}
