import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Play,
  FileText,
  HelpCircle,
  FileEdit,
  Check,
  Lock,
  Home,
  Headphones,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmotionSelector, type EmotionType } from "@/components/EmotionSelector";

const getItemIcon = (type: string) => {
  switch ((type || "").toLowerCase()) {
    case "video":
      return <Play className="h-3 w-3" />;
    case "blog":
    case "article":
      return <FileText className="h-3 w-3" />;
    case "quiz":
      return <HelpCircle className="h-3 w-3" />;
    case "form":
    case "feedback":
      return <FileEdit className="h-3 w-3" />;
    case "case_study":
      return <FileEdit className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

const sortItemsByOrder = (items: any[]) =>
  [...items].sort((a, b) => (a.order || "").localeCompare(b.order || ""));

// A subtle, consistent color per item type — gives the eye something to
// pattern-match on in a long list, beyond the type label text alone.
const typeAccent = (type: string): string => {
  switch ((type || "").toLowerCase()) {
    case "video":
      return "text-sky-600 dark:text-sky-400";
    case "blog":
    case "article":
      return "text-amber-600 dark:text-amber-400";
    case "quiz":
      return "text-violet-600 dark:text-violet-400";
    case "form":
    case "feedback":
      return "text-teal-600 dark:text-teal-400";
    case "project":
      return "text-pink-600 dark:text-pink-400";
    case "case_study":
      return "text-indigo-600 dark:text-indigo-400";
    default:
      return "text-muted-foreground";
  }
};

const typeLabel = (type: string) => {
  switch ((type || "").toLowerCase()) {
    case "video":
      return "Video";
    case "quiz":
      return "Quiz";
    case "blog":
    case "article":
      return "Reading";
    case "form":
    case "feedback":
      return "Feedback";
    case "project":
      return "Project";
    case "case_study":
      return "Case Study";
    default:
      return type || "Item";
  }
};

type EmotionConfig = {
  itemId: string;
  onEmotionSelect: (emotion: EmotionType, feedbackText?: string) => Promise<void>;
  selectedEmotion?: EmotionType | null;
} | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  courseName?: string;
  supportLink?: string;
  user?: { name?: string; avatar?: string } | null;

  modules: any[];
  moduleProgressMap: Map<any, any>;
  moduleProgressLoading: boolean;
  expandedModules: Record<string, boolean>;
  expandedSections: Record<string, boolean>;
  selectedModuleId: string | null;
  selectedSectionId: string | null;
  selectedItemId: string | null;
  sectionItems: Record<string, any[]>;
  activeSectionInfo: { moduleId: string; sectionId: string } | null;
  itemsLoading: boolean;
  itemLoading: boolean;
  shouldRandomize: boolean;

  onToggleModule: (moduleId: string) => void;
  onToggleSection: (moduleId: string, sectionId: string) => void;
  onSelectItem: (moduleId: string, sectionId: string, itemId: string) => void;
  isItemLocked: (moduleId: string, sectionId: string, itemId: string) => boolean;

  emotion?: EmotionConfig;

  /**
   * Plays the "close" stage animation before leaving, instead of the
   * Dashboard link's default instant navigation. Falls back to a plain
   * link (no animation) when the caller doesn't pass one.
   */
  onExitToDashboard?: () => void;
};

// Theme-aware row transition (works in light & dark). Every interactive row
// shares a visible keyboard-focus ring — the drawer has no other way to show
// where keyboard focus is, since none of these rows are plain links/buttons
// with a browser-default outline that would otherwise show through.
const rowBase =
  "transition-[background-color,color,transform] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-warm/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function CourseDrawer({
  open,
  onOpenChange,
  courseName,
  supportLink,
  user,
  modules,
  moduleProgressMap,
  moduleProgressLoading,
  expandedModules,
  expandedSections,
  selectedModuleId,
  selectedSectionId,
  selectedItemId,
  sectionItems,
  activeSectionInfo,
  itemsLoading,
  itemLoading,
  shouldRandomize,
  onToggleModule,
  onToggleSection,
  onSelectItem,
  isItemLocked,
  emotion,
  onExitToDashboard,
}: Props) {
  const supportHref = (() => {
    if (!supportLink) return null;
    const link = supportLink;
    if (link.startsWith("mailto:")) return link;
    if (link.startsWith("http://") || link.startsWith("https://") || link.startsWith("//")) return link;
    if (link.includes("@")) return `mailto:${link}`;
    return link;
  })();
  const supportIsEmail = !!supportHref && (supportHref.startsWith("mailto:") || (!supportHref.startsWith("http") && supportHref.includes("@")));

  // Overall course progress (summed across modules) for the header bar.
  let totalCompleted = 0;
  let totalItems = 0;
  moduleProgressMap.forEach((p: any) => {
    totalCompleted += p?.completedItems ?? 0;
    totalItems += p?.totalItems ?? 0;
  });
  const progressPct = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;

  // The "up next" target: first unlocked, not-yet-completed item in course order
  // (excluding the one currently open). Used to visually flag what to do next.
  let nextToDoId: string | null = null;
  for (const m of modules) {
    if (nextToDoId) break;
    for (const s of m.sections || []) {
      if (nextToDoId) break;
      const items = sectionItems[s.sectionId];
      if (!items) continue;
      const ordered = shouldRandomize ? items : sortItemsByOrder(items);
      for (const it of ordered) {
        if (it._id === selectedItemId || it.isCompleted) continue;
        if (isItemLocked(m.moduleId, s.sectionId, it._id)) continue;
        nextToDoId = it._id;
        break;
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Theme-aware: uses background/foreground tokens so it adapts to light & dark. */}
      <SheetContent
        side="left"
        aria-label={`${courseName || "Course content"}: lesson menu`}
        className="flex w-[88vw] flex-col gap-0 border-r border-border bg-background p-0 text-foreground sm:max-w-md [&>button]:top-5 [&>button]:right-4 [&>button]:rounded-full [&>button]:bg-foreground/[0.06] [&>button]:p-1.5 [&>button]:text-muted-foreground [&>button]:opacity-100 [&>button]:transition-colors [&>button:hover]:bg-foreground/10 [&>button:hover]:text-foreground"
      >
        {/* Header — course title + overall progress */}
        <div className="shrink-0 border-b border-border bg-foreground/[0.02] px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5 pr-8">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warm/15 text-warm">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Course
              </p>
              <h2 className="truncate text-base font-semibold leading-snug text-foreground" title={courseName || "Course content"}>
                {courseName || "Course content"}
              </h2>
            </div>
          </div>
          {totalItems > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Your progress</span>
                <span
                  className={`font-semibold tabular-nums ${progressPct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
                >
                  {totalCompleted}/{totalItems} &middot; {progressPct}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Course completion"
                className="h-2 w-full overflow-hidden rounded-full bg-foreground/10"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                    progressPct >= 100 ? "bg-emerald-500" : "bg-warm"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Emotion check-in for the current item — compact */}
        {emotion && (
          <div className="shrink-0 border-b border-border px-3 py-2">
            <EmotionSelector
              compact
              itemId={emotion.itemId}
              onEmotionSelect={emotion.onEmotionSelect}
              selectedEmotion={emotion.selectedEmotion ?? null}
            />
          </div>
        )}

        {/* Module / section / item tree — scrollable, gets the most room */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2.5 p-3" data-testid="course-drawer-tree">
            {modules.map((module: any) => {
              const moduleId = module.moduleId;
              const progress = moduleProgressMap.get(moduleId);
              const isModuleExpanded = expandedModules[moduleId];
              const isCurrentModule = moduleId === selectedModuleId;
              const done =
                progress?.completedItems === progress?.totalItems && progress?.totalItems > 0;

              return (
                <div
                  key={moduleId}
                  data-testid="course-module"
                  data-module-id={moduleId}
                  className={`overflow-hidden rounded-2xl border transition-colors duration-200 ${
                    isCurrentModule ? "border-warm/40 bg-warm/[0.04]" : "border-border bg-foreground/[0.02]"
                  }`}
                >
                  <button
                    data-testid="course-module-toggle"
                    data-module-id={moduleId}
                    onClick={() => onToggleModule(moduleId)}
                    aria-expanded={isModuleExpanded}
                    aria-current={isCurrentModule ? "true" : undefined}
                    className={`group flex w-full items-center gap-2.5 px-3.5 py-3 text-left ${rowBase} hover:bg-foreground/[0.05] ${
                      isCurrentModule ? "text-foreground" : "text-foreground/90"
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg transition-colors duration-200 ${
                        isCurrentModule ? "bg-warm/20 text-warm" : "bg-foreground/[0.07] text-muted-foreground"
                      }`}
                    >
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform duration-200 ease-out ${isModuleExpanded ? "rotate-90" : ""}`}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold">{module.name}</span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                        >
                          {done && <Check className="h-2.5 w-2.5" />}
                          {moduleProgressLoading
                            ? "…"
                            : `${progress?.completedItems ?? 0}/${progress?.totalItems ?? 0}`}
                        </span>
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {module.sections?.length || 0} sections
                      </span>
                    </span>
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${isModuleExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="overflow-hidden">
                      {module.sections && (
                        <div className="space-y-2 border-t border-border/70 px-3.5 pb-3 pt-2.5">
                          {module.sections.map((section: any) => {
                            const sectionId = section.sectionId;
                            const isSectionExpanded = expandedSections[sectionId];
                            const isCurrentSection = sectionId === selectedSectionId;
                            const isLoadingItems =
                              activeSectionInfo?.sectionId === sectionId && itemsLoading;

                            return (
                              <div
                                key={sectionId}
                                data-testid="course-section"
                                data-section-id={sectionId}
                                data-module-id={moduleId}
                                className="border-l-2 border-border pl-2.5"
                              >
                                <button
                                  data-testid="course-section-toggle"
                                  data-section-id={sectionId}
                                  data-module-id={moduleId}
                                  onClick={() => onToggleSection(moduleId, sectionId)}
                                  aria-expanded={isSectionExpanded}
                                  aria-current={isCurrentSection ? "true" : undefined}
                                  className={`flex w-full items-center gap-1.5 rounded-md py-1 text-left ${rowBase} ${
                                    isCurrentSection ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                                  }`}
                                >
                                  <ChevronRight
                                    className={`h-3 w-3 shrink-0 transition-transform duration-200 ease-out ${isSectionExpanded ? "rotate-90" : ""}`}
                                  />
                                  <span className="truncate text-[11px] font-semibold uppercase tracking-wide">
                                    {section.name}
                                  </span>
                                </button>

                                {isSectionExpanded && (
                                  <div className="mt-1.5 space-y-1 animate-vibe-fade-in">
                                    {isLoadingItems ? (
                                      <div className="space-y-1 p-2">
                                        <Skeleton className="h-4 w-full rounded" />
                                        <Skeleton className="h-4 w-4/5 rounded" />
                                      </div>
                                    ) : sectionItems[sectionId] ? (
                                      (shouldRandomize
                                        ? sectionItems[sectionId]
                                        : sortItemsByOrder(sectionItems[sectionId])
                                      ).map((item: any) => {
                                        const itemId = item._id;
                                        const isCurrentItem = itemId === selectedItemId;
                                        const locked = isItemLocked(moduleId, sectionId, itemId);
                                        const completed = !!item.isCompleted;
                                        const isNext = !locked && !completed && !isCurrentItem && itemId === nextToDoId;
                                        return (
                                          <button
                                            key={itemId}
                                            data-testid="course-item"
                                            data-item-id={itemId}
                                            data-section-id={sectionId}
                                            data-module-id={moduleId}
                                            data-item-type={item.type?.toLowerCase()}
                                            disabled={locked}
                                            aria-current={isCurrentItem ? "true" : undefined}
                                            onClick={() =>
                                              !locked && onSelectItem(moduleId, sectionId, itemId)
                                            }
                                            className={`group relative flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left ${rowBase} ${
                                              isCurrentItem
                                                ? "bg-foreground/[0.05] ring-1 ring-border"
                                                : isNext
                                                  ? "bg-warm/[0.06] hover:bg-warm/10"
                                                  : "hover:bg-foreground/[0.04]"
                                            } ${locked ? "cursor-not-allowed opacity-45 hover:bg-transparent" : ""}`}
                                          >
                                            {/* Left accent bar — the clearest at-a-glance signal for "you are here" */}
                                            {isCurrentItem && (
                                              <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-foreground" aria-hidden="true" />
                                            )}
                                            {/* Completion indicator — check (done) · pulsing dot (current) · ring (next) · empty (todo) */}
                                            <span
                                              className={`mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200 ${
                                                completed
                                                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                  : isCurrentItem
                                                    ? "border-foreground text-foreground"
                                                    : isNext
                                                      ? "border-warm/60 text-warm"
                                                      : "border-muted-foreground/30 text-transparent"
                                              }`}
                                            >
                                              {locked ? (
                                                <Lock className="h-3 w-3 text-muted-foreground" />
                                              ) : completed ? (
                                                <Check className="h-3.5 w-3.5 animate-vibe-fade-in" />
                                              ) : isCurrentItem ? (
                                                <span className="h-2 w-2 rounded-full bg-foreground animate-pulse" />
                                              ) : null}
                                            </span>
                                            {/* Title + type */}
                                            <span className="min-w-0 flex-1">
                                              <span
                                                className={`block truncate text-sm ${
                                                  isCurrentItem || isNext
                                                    ? "font-semibold text-foreground"
                                                    : completed
                                                      ? "font-medium text-muted-foreground"
                                                      : "font-medium text-foreground/90"
                                                }`}
                                              >
                                                {isCurrentItem && itemLoading
                                                  ? "Loading…"
                                                  : item?.name || item?.title || "Untitled"}
                                              </span>
                                              <span className={`mt-1 flex items-center gap-1.5 text-[11px] font-medium ${locked ? "text-muted-foreground" : typeAccent(item.type)}`}>
                                                {getItemIcon(item.type)}
                                                <span>{typeLabel(item.type)}</span>
                                                {isNext && (
                                                  <span className="ml-0.5 rounded-full bg-warm/15 px-1.5 py-px text-[9px] font-medium text-warm">
                                                    Up next
                                                  </span>
                                                )}
                                                {/* The status above is conveyed by color/icon alone — say it in words too. */}
                                                {(locked || completed || isCurrentItem) && (
                                                  <span className="sr-only">
                                                    {locked ? "Locked" : completed ? "Completed" : "Currently playing"}
                                                  </span>
                                                )}
                                              </span>
                                            </span>
                                          </button>
                                        );
                                      })
                                    ) : (
                                      <div className="p-2 text-center text-[11px] text-muted-foreground">
                                        No items found
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer navigation — quick actions up top (easiest to reach with a
            thumb when the sheet opens from the left), profile pinned last. */}
        <div className="mt-auto shrink-0 border-t border-border bg-foreground/[0.02] p-3">
          <div className={`grid gap-2 ${supportHref ? "grid-cols-2" : "grid-cols-1"}`}>
            <Link
              to="/student"
              onClick={(e) => {
                onOpenChange(false);
                // Let the stage play its close animation before navigating,
                // when the caller gave us one, instead of leaving instantly.
                if (onExitToDashboard) {
                  e.preventDefault();
                  onExitToDashboard();
                }
              }}
              className={`flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-foreground/80 ${rowBase} hover:border-foreground/20 hover:bg-foreground/[0.06] hover:text-foreground`}
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            {supportHref && (
              <a
                href={supportHref}
                target={supportIsEmail ? undefined : "_blank"}
                rel={supportIsEmail ? undefined : "noopener noreferrer"}
                className={`flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-foreground/80 ${rowBase} hover:border-foreground/20 hover:bg-foreground/[0.06] hover:text-foreground`}
              >
                <Headphones className="h-4 w-4" />
                <span className="inline-flex items-center gap-1">
                  Get Support
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" aria-hidden="true" />
                </span>
              </a>
            )}
          </div>
          <Link
            to="/student/profile"
            onClick={() => onOpenChange(false)}
            className={`mt-2 flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 ${rowBase} hover:border-foreground/20 hover:bg-foreground/[0.06]`}
          >
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback className="bg-foreground/10 text-xs font-bold text-foreground">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{user?.name || "Profile"}</span>
              <span className="block text-[10px] text-muted-foreground">View profile</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default CourseDrawer;
