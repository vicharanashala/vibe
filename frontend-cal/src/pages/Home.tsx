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
import { Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PanelRight } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { Toaster } from '@/components/ui/sonner'

const Home = () => {
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(false)

  const toggleRightSidebar = () => {
    setIsRightSidebarVisible(!isRightSidebarVisible)
  }

  return (
    <SidebarProvider>
      <Toaster />
      <SidebarLeft />
      <SidebarInset>
        <header className='sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background'>
          <div className='flex flex-1 items-center gap-2 px-3'>
            <SidebarTrigger />
            <Separator orientation='vertical' className='mr-2 h-4' />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className='line-clamp-1'>
                    Student Portal
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className='ml-auto'>
              <ModeToggle />
              <Button variant='ghost' size='icon' onClick={toggleRightSidebar}>
                <PanelRight />
              </Button>
            </div>
          </div>
        </header>
        <div className='flex flex-1 flex-col gap-4 p-4'>
          <Outlet />
        </div>
      </SidebarInset>
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
