// Import required UI components
import { Calendar } from '@/components/ui/calendar'
import { SidebarGroup, SidebarGroupContent } from '@/components/ui/sidebar'

// DatePicker component that renders a calendar within a sidebar group
export function DatePicker() {
  return (
    // SidebarGroup with no horizontal padding
    <SidebarGroup className='px-0'>
      <SidebarGroupContent>
        {/* Calendar component with custom styling for grid cells:
            - Selected dates use sidebar primary color for background
            - Selected dates use sidebar primary foreground color for text
            - Each grid cell has fixed width of 33px */}
        <Calendar className='[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px]' />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
