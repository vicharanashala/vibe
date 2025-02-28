import * as React from 'react'
import { BookOpen, Bot, Command, SquareTerminal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { NavMain } from '@/components/nav-main'
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
import { url } from 'inspector'
import { on } from 'events'

export function AppSidebar({ ...props }) {
  const navigate = useNavigate()

  const handleNavigate = (path) => {
    console.log('Attempting to navigate to:', path)
    navigate(path)
  }

  const data = {
    user: {
      name: 'Admin',
      email: 'm@example.com',
      avatar: '/avatars/shadcn.jpg',
    },
    navMain: [
      {
        title: 'Create Content',
        icon: SquareTerminal,
        isActive: true,
        items: [
          {
            title: 'Create Course',
            url: '/admin/create-course',
            onClick: () => handleNavigate('/admin/create-course'),
          },
          {
            title: 'Create Module',
            url: '/admin/create-module',
            onClick: () => handleNavigate('/admin/create-module'),
          },
          {
            title: 'Create Section',
            url: '/admin/create-section',
            onClick: () => handleNavigate('/admin/create-section'),
          },
          {
            title: 'Upload Bulk Items',
            url: '/admin/bulkQuestionUpload',
            onClick: () => handleNavigate('/admin/bulk-question-upload'),
          },
        ],
      },
      {
        title: 'Enroll Students',
        url: '/admin/enroll-students',
        onClick: () => handleNavigate('/admin/enroll-students'),
        icon: Bot,
      },
      {
        title: 'Bulk Signup Students',
        icon: BookOpen,
        items: [
          {
            title: 'One by One',
            onClick: () => handleNavigate('/admin/signup-one-by-one'),
          },
          {
            title: 'By Json File',
            onClick: () => handleNavigate('/admin/signup-by-json'),
          },
        ],
      },
    ],
  }

  return (
    <Sidebar variant='inset' {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <a href='#' onClick={() => handleNavigate('/admin')}>
                <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                  <Command className='size-4' />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>Admin Panel</span>
                  <span className='truncate text-xs'>Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
