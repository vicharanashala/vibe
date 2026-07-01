import { Card } from "@/components/ui/card";
import type { StatCardProps } from "@/types/ui.types";
import { cn } from "@/utils/utils";

/**
 * Tone presets keep the icon chip + ambient glow readable in BOTH light and
 * dark themes (solid icon color, soft tinted chip, low-opacity glow).
 */
const TONES = {
  amber: {
    chip: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400 dark:ring-amber-400/20",
    glow: "from-amber-500/15",
  },
  blue: {
    chip: "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400 dark:ring-blue-400/20",
    glow: "from-blue-500/15",
  },
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400 dark:ring-emerald-400/20",
    glow: "from-emerald-500/15",
  },
  violet: {
    chip: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400 dark:ring-violet-400/20",
    glow: "from-violet-500/15",
  },
} as const;

export const StatCard = ({ icon, value, label, sublabel, tone = "amber", decoration, className }: StatCardProps) => {
  const t = TONES[tone] ?? TONES.amber;

  return (
    <Card
      className={cn(
        "group relative h-full min-h-[128px] overflow-hidden rounded-2xl border p-5 gap-4",
        // Light: clean white surface. Dark: soft glassy gray (not black).
        "bg-white border-neutral-200/80 dark:bg-white/[0.035] dark:border-white/[0.07]",
        "ring-1 ring-black/[0.02] dark:ring-white/[0.04] shadow-sm",
        "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-white/[0.06]",
        className
      )}
    >
      {/* Glossy ambient accent */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          t.glow
        )}
      />

      <div className="relative flex items-start justify-between">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1", t.chip)}>
          {icon}
        </div>
        {decoration ? <div className="text-xl leading-none">{decoration}</div> : null}
      </div>

      <div className="relative flex min-w-0 flex-col gap-0.5">
        <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">{value}</span>
        <span className="text-sm font-semibold text-foreground/90">{label}</span>
        {sublabel ? <span className="truncate text-xs text-muted-foreground">{sublabel}</span> : null}
      </div>
    </Card>
  );
};
