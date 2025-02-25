// Import required React and icon components
import * as React from 'react'
import { Check, ChevronRight } from 'lucide-react'

// Import collapsible UI components
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

// Import sidebar UI components
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'

// Interface for calendar items
export function Calendars({
  calendars,
}: {
  calendars: {
    name: string
    items: string[]
  }[]
}) {
  return (
    <>
      {/* Map through each calendar section */}
      {calendars.map((calendar, index) => (
        <React.Fragment key={calendar.name}>
          <SidebarGroup key={calendar.name} className='py-0'>
            {/* Collapsible section for each calendar group */}
            <Collapsible
              defaultOpen={index === 0}
              className='group/collapsible'
            >
              {/* Calendar group header/label that triggers collapse */}
              <SidebarGroupLabel
                asChild
                className='group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              >
                <CollapsibleTrigger>
                  {calendar.name}{' '}
                  {/* Rotating chevron icon for collapse state */}
                  <ChevronRight className='ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90' />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              {/* Collapsible content containing calendar items */}
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {/* Map through calendar items */}
                    {calendar.items.map((item, index) => (
                      <SidebarMenuItem key={item}>
                        <SidebarMenuButton>
                          {/* Checkbox-style indicator for active items */}
                          <div
                            data-active={index < 2}
                            className='group/calendar-item flex aspect-square size-4 shrink-0 items-center justify-center rounded-sm border border-sidebar-border text-sidebar-primary-foreground data-[active=true]:border-sidebar-primary data-[active=true]:bg-sidebar-primary'
                          >
                            <Check className='hidden size-3 group-data-[active=true]/calendar-item:block' />
                          </div>
                          {item}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
          {/* Separator between calendar groups */}
          <SidebarSeparator className='mx-0' />
        </React.Fragment>
      ))}
    </>
  )
}
