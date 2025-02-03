// Import React and Lucide icon type
import * as React from 'react'
import { type LucideIcon } from 'lucide-react'

// Import sidebar UI components
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

// NavSecondary component for rendering secondary navigation items
export function NavSecondary({
  items,
  ...props
}: {
  // Array of navigation items with title, URL and icon
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    // Main sidebar group that accepts additional props
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Map through navigation items */}
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {/* Menu button that renders as a small anchor tag */}
              <SidebarMenuButton asChild size='sm'>
                <a href={item.url}>
                  {/* Render the item's icon component */}
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
