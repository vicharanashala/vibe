/**
 * Home
 * The main layout component for the authenticated user experience.
 * This component provides a comprehensive layout structure with the following features:
 *
 * Key Features:
 * - Left sidebar navigation
 * - Right sidebar for additional tools/information
 * - Top header with breadcrumbs and controls
 * - Dark/Light mode toggle
 * - Dynamic content rendering via React Router's Outlet
 *
 * Layout Structure:
 * - SidebarProvider wraps the entire layout for sidebar state management
 * - Left Sidebar: Main navigation
 * - Header: Breadcrumbs, mode toggle, and right sidebar toggle
 * - Main Content Area: Renders child routes
 * - Right Sidebar: Collapsible panel for additional tools
 */

import React, { useState } from 'react'
import { SidebarLeft } from '@/components/sidebar-left'
import { SidebarRight } from '@/components/sidebar-right'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PanelRight } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { Toaster } from '@/components/ui/sonner'
import { ProfileDropdown } from '@/components/Profile-Dropdown'
import { useDispatch } from 'react-redux'
import { logoutState } from '@/store/slices/authSlice'
import { useLogoutMutation } from '@/store/apiService'
import { DashboardDropdown } from '@/components/ui/DashboardDropdown'

const Home = () => {
  // State to control right sidebar visibility
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(false)

  // Toggle handler for right sidebar
  const toggleRightSidebar = () => {
    setIsRightSidebarVisible(!isRightSidebarVisible)
  }
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [logout] = useLogoutMutation()

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

  return (
    <SidebarProvider>
      {/* Global toast notifications */}
      <Toaster />

      {/* Left sidebar navigation */}
      <SidebarLeft />

      {/* Main content area */}
      <SidebarInset>
        {/* Header with navigation and controls */}
        <header className='sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background'>
          <div className='flex flex-1 items-center gap-2 px-3'>
            <SidebarTrigger />
            <Separator orientation='vertical' className='mr-2 h-4' />
            {/* Breadcrumb navigation */}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className='line-clamp-1'>
                    Student Portal
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {/* Header controls */}
            <div className='ml-auto mr-4 flex gap-4'>
              <DashboardDropdown />
              {/* <Button onClick={() => navigate('/')}>Dashboard</Button>
              <Button onClick={() => navigate('/analytics')}>Analytics</Button>
              <Button onClick={handleLogout}>Logout</Button> */}
              {/* <Button variant='ghost' size='icon' onClick={toggleRightSidebar}>
                <PanelRight />
              </Button> */}
            </div>
          </div>
        </header>

        {/* Dynamic content area */}
        <div className='flex flex-1 flex-col gap-4 p-4'>
          <Outlet />
        </div>
      </SidebarInset>

      {/* Right sidebar with animation */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isRightSidebarVisible ? 'w-64 opacity-100' : 'w-0 opacity-0'
        }`}
        style={{
          overflow: isRightSidebarVisible ? 'visible' : 'hidden',
        }}
      >
        <SidebarRight />
      </div>
    </SidebarProvider>
  )
}

export default Home
