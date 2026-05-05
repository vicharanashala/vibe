import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

type PasswordVisibilityToggleProps = {
  visible: boolean;
  onToggle: () => void;
  className?: string;
  label?: string;
};

export function PasswordVisibilityToggle({
  visible,
  onToggle,
  className,
  label = "password",
}: PasswordVisibilityToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggle}
      data-state={visible ? "visible" : "hidden"}
      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
      className={cn(
        "group absolute inset-y-0 right-2 my-auto h-10 w-10 overflow-hidden rounded-xl !border-0 !text-white transition-all duration-300 ease-out focus-visible:ring-2 focus-visible:ring-offset-2",
        visible
          ? "!bg-[linear-gradient(135deg,rgba(228,143,57,0.98),rgba(217,119,6,0.98))] !shadow-[0_0_0_2px_rgba(255,255,255,0.75),0_0_22px_rgba(217,119,6,0.45)] hover:scale-110 hover:!shadow-[0_0_0_2px_rgba(255,255,255,0.82),0_0_30px_rgba(217,119,6,0.58)] focus-visible:ring-amber-300/70"
          : "!bg-[linear-gradient(135deg,rgba(52,152,169,0.98),rgba(25,90,105,0.98))] !shadow-[0_10px_24px_rgba(25,90,105,0.35)] hover:scale-105 hover:!shadow-[0_14px_30px_rgba(52,152,169,0.45)] focus-visible:ring-cyan-300/70",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl transition-all duration-500",
          visible
            ? "bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.65),rgba(255,255,255,0)_55%)] opacity-100 scale-100"
            : "bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),rgba(255,255,255,0)_55%)] opacity-70 scale-95 group-hover:opacity-100 group-hover:scale-100",
        )}
      />

      {visible ? (
        <EyeOff className="relative z-10 h-5 w-5 drop-shadow-sm transition-all duration-300 group-hover:-rotate-12 group-hover:scale-110" />
      ) : (
        <Eye className="relative z-10 h-5 w-5 drop-shadow-sm transition-all duration-300 group-hover:rotate-12 group-hover:scale-110" />
      )}
    </Button>
  );
}
