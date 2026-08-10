import { Sparkles, MessageSquare, Mic, MessagesSquare, Flag } from "lucide-react";
import { useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type AiActionId = "chat" | "talk" | "discussion" | "report";

const actions: { id: AiActionId; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "AI chat", icon: MessageSquare },
  { id: "talk", label: "AI talk", icon: Mic },
  { id: "discussion", label: "Discussion", icon: MessagesSquare },
  { id: "report", label: "Report", icon: Flag },
];

type Props = {
  expanded: boolean;
  onExpandedChange: (b: boolean) => void;
  /** Parent pauses the video and opens the relevant surface. */
  onAction: (id: AiActionId) => void;
  /** Called when the compact icon itself is clicked (parent pauses the video). */
  onIconClick?: () => void;
};

/**
 * Top-right AI companion. Compact (just the sparkle icon); expands horizontally
 * on hover or click to reveal chat / talk / discussion / report. Collapses on
 * Escape; the parent collapses it on background click / video resume.
 */
export function AiCompanion({ expanded, onExpandedChange, onAction, onIconClick }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExpandedChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExpandedChange]);

  return (
    <div
      className="absolute right-4 top-4 z-50 sm:right-6 sm:top-6"
      onMouseEnter={() => onExpandedChange(true)}
      onMouseLeave={() => onExpandedChange(false)}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-row-reverse items-center gap-2">
        <button
          aria-label="AI companion"
          aria-expanded={expanded}
          // Always expand on click (pausing the video). Collapse happens on
          // mouse-leave, Escape, background click, or choosing an action — this
          // avoids the hover+click "toggle to collapsed while still hovering" trap.
          onClick={() => { onIconClick?.(); onExpandedChange(true); }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground ring-1 ring-glass-border shadow-lg transition hover:scale-105"
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <div
          className={`flex flex-row-reverse items-center gap-1.5 overflow-hidden transition-all duration-300 ${
            expanded ? "max-w-72 opacity-100" : "max-w-0 opacity-0"
          }`}
        >
          {actions.map((a) => (
            <Tooltip key={a.id}>
              <TooltipTrigger asChild>
                <button
                  aria-label={a.label}
                  onClick={() => onAction(a.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-glass text-stage-foreground backdrop-blur-md ring-1 ring-glass-border transition hover:bg-white/15"
                >
                  <a.icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{a.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AiCompanion;
