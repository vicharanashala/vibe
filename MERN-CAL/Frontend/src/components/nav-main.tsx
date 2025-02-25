'use client'

// Import Lucide icon type for navigation items
import { type LucideIcon } from 'lucide-react'

// Import sidebar UI components for navigation menu
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

// NavMain component that renders the main navigation menu
export function NavMain({
  items,
}: {
  // Array of navigation items with title, URL, icon and active state
  items: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
  }[]
}) {
  return (
    <SidebarMenu>
      {/* Map through navigation items */}
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          {/* Menu button that renders as an anchor tag with active state */}
          <SidebarMenuButton asChild isActive={item.isActive}>
            <a href={item.url}>
              {/* Render the item's icon component */}
              <item.icon />
              <span>{item.title}</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
