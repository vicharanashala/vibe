import { PanelLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Top-left floating control. Opens the course progress / navigation drawer.
 * Pausing the video on click is handled by the parent via onClick.
 */
export function FloatingBackButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="absolute left-4 top-4 z-50 sm:left-6 sm:top-6">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            aria-label="Course progress & lessons"
            className="grid h-9 w-9 place-items-center rounded-full bg-glass text-stage-foreground backdrop-blur-md ring-1 ring-glass-border shadow-lg transition hover:bg-white/15 hover:scale-105"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Course progress &amp; lessons</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default FloatingBackButton;
