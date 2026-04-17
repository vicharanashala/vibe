import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"
import { useSidebar } from "./sidebar"

import { cn } from "@/utils/utils"
import { useIsMobile } from "@/hooks/use-mobile"

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = ResizablePrimitive.Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
)

function SidebarResizablePanel({ 
  children,
  defaultSize = 20,
  minSize = 20,
  maxSize=40,
  ...props 
}: React.ComponentProps<typeof ResizablePanel>) {
  const { state,openMobile } = useSidebar();
  const isMobile=useIsMobile();
  const shouldClose=(!isMobile && state==="collapsed")||(isMobile && !openMobile)
  
  return (
    <ResizablePanel
      defaultSize={shouldClose?0:defaultSize}
      minSize={shouldClose?0:minSize}
      maxSize={shouldClose?0:maxSize}
      className="hidden md:block"
      {...props}
    >
      {children}
    </ResizablePanel>
  );
}

export { ResizablePanelGroup, SidebarResizablePanel,ResizablePanel, ResizableHandle }
