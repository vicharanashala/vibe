// Import Lucide icons and icon type for UI elements
import {
  Folder,
  MoreHorizontal,
  Share,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

// Import dropdown menu components for actions
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Import sidebar UI components and hooks
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

// NavProjects component for displaying project items in sidebar
export function NavProjects({
  projects,
}: {
  // Array of project items with name, URL and icon
  projects: {
    name: string
    url: string
    icon: LucideIcon
  }[]
}) {
  // Get mobile status from sidebar context
  const { isMobile } = useSidebar()

  return (
    // Main sidebar group that hides when collapsed to icon-only mode
    <SidebarGroup className='group-data-[collapsible=icon]:hidden'>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {/* Map through project items */}
        {projects.map((item) => (
          <SidebarMenuItem key={item.name}>
            {/* Link wrapper for project item */}
            <SidebarMenuButton asChild>
              <a href={item.url}>
                <item.icon />
                <span>{item.name}</span>
              </a>
            </SidebarMenuButton>
            {/* Dropdown menu for additional actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className='sr-only'>More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              {/* Dropdown content with responsive positioning */}
              <DropdownMenuContent
                className='w-48'
                side={isMobile ? 'bottom' : 'right'}
                align={isMobile ? 'end' : 'start'}
              >
                {/* View project option */}
                <DropdownMenuItem>
                  <Folder className='text-muted-foreground' />
                  <span>View Project</span>
                </DropdownMenuItem>
                {/* Share project option */}
                <DropdownMenuItem>
                  <Share className='text-muted-foreground' />
                  <span>Share Project</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Delete project option */}
                <DropdownMenuItem>
                  <Trash2 className='text-muted-foreground' />
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        {/* More options button */}
        <SidebarMenuItem>
          <SidebarMenuButton>
            <MoreHorizontal />
            <span>More</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
