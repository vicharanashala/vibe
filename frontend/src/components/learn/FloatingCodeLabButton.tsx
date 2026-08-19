import { Code2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  /** Whether CodeLab is currently open. */
  open: boolean;
  /** Toggle CodeLab. Parent pauses the video and opens/closes the panel. */
  onToggle: () => void;
};

/**
 * Bottom-left floating control. Toggles the CodeLab split-screen panel.
 * Pausing/resuming the video on toggle is handled by the parent via the
 * existing awayPaused mechanism — identical to FloatingCameraButton.
 */
export function FloatingCodeLabButton({ open, onToggle }: Props) {
  return (
    <div className="absolute left-4 bottom-24 z-50 sm:left-6">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggle}
            aria-label={open ? "Close CodeLab" : "Open CodeLab"}
            aria-pressed={open}
            className={`grid h-9 w-9 place-items-center rounded-full bg-glass text-stage-foreground shadow-lg ring-1 ring-glass-border backdrop-blur-md transition hover:scale-105 ${
              open ? "opacity-100 ring-primary" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Code2 className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{open ? "Close CodeLab" : "Open CodeLab"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default FloatingCodeLabButton;
