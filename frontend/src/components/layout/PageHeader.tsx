import type { ReactNode } from "react";
import { cn } from "@/utils/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned controls (e.g. a refresh button, view toggles). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared page heading used across the student pages for a consistent title,
 * subtitle and right-aligned actions. Keep page-specific markup out of here —
 * pass it via `actions`.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-1">
        <h1 className="text-lg font-bold tracking-tight md:text-xl">{title}</h1>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
