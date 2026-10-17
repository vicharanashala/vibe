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
    default:
      return <FileText className="h-3 w-3" />;
  }
};

const sortItemsByOrder = (items: any[]) =>
  [...items].sort((a, b) => (a.order || "").localeCompare(b.order || ""));

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
};

// Theme-aware row transition (works in light & dark).
const rowBase = "transition-[background-color,color,transform] duration-200 ease-out";

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
        className="flex w-[88vw] flex-col gap-0 border-r border-border bg-background p-0 text-foreground sm:max-w-md [&>button]:text-muted-foreground [&>button]:transition-colors [&>button:hover]:text-foreground"
      >
        {/* Header — course title + overall progress */}
        <div className="shrink-0 border-b border-border px-5 pb-3 pt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Course
          </p>
          <h2 className="mt-1 pr-8 text-lg font-semibold leading-snug text-foreground" title={courseName || "Course content"}>
            {courseName || "Course content"}
          </h2>
          {totalItems > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {totalCompleted}/{totalItems}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
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
          <div className="space-y-1 p-3" data-testid="course-drawer-tree">
            {modules.map((module: any) => {
              const moduleId = module.moduleId;
              const progress = moduleProgressMap.get(moduleId);
              const isModuleExpanded = expandedModules[moduleId];
              const isCurrentModule = moduleId === selectedModuleId;
              const done =
                progress?.completedItems === progress?.totalItems && progress?.totalItems > 0;

              return (
                <div key={moduleId} data-testid="course-module" data-module-id={moduleId}>
                  <button
                    data-testid="course-module-toggle"
                    data-module-id={moduleId}
                    onClick={() => onToggleModule(moduleId)}
                    aria-expanded={isModuleExpanded}
                    className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${rowBase} hover:bg-foreground/[0.06] ${
                      isCurrentModule ? "bg-foreground/[0.08] text-foreground" : "text-foreground/80"
                    }`}
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out ${isModuleExpanded ? "rotate-90" : ""}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-medium">{module.name}</span>
                        <span
                          className={`shrink-0 text-[10px] tabular-nums ${done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                        >
                          {moduleProgressLoading
                            ? "…"
                            : `${progress?.completedItems ?? 0}/${progress?.totalItems ?? 0}`}
                        </span>
                      </span>
                      <span className="block text-[10px] text-muted-foreground/70">
                        {module.sections?.length || 0} sections
                      </span>
                    </span>
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${isModuleExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="overflow-hidden">
                      {module.sections && (
                        <div className="ml-3 mt-1 space-y-1 border-l border-border pl-2">
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
                              >
                                <button
                                  data-testid="course-section-toggle"
                                  data-section-id={sectionId}
                                  data-module-id={moduleId}
                                  onClick={() => onToggleSection(moduleId, sectionId)}
                                  aria-expanded={isSectionExpanded}
                                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs ${rowBase} hover:bg-foreground/[0.06] ${
                                    isCurrentSection ? "text-foreground" : "text-muted-foreground"
                                  }`}
                                >
                                  <ChevronRight
                                    className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 ease-out ${isSectionExpanded ? "rotate-90" : ""}`}
                                  />
                                  <span className="truncate font-medium">{section.name}</span>
                                </button>

                                {isSectionExpanded && (
                                  <div className="ml-3 mt-0.5 space-y-0.5 animate-vibe-fade-in">
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
                                            onClick={() =>
                                              !locked && onSelectItem(moduleId, sectionId, itemId)
                                            }
                                            className={`group relative flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left ${rowBase} ${
                                              isCurrentItem
                                                ? "bg-foreground/[0.05] ring-1 ring-border"
                                                : "hover:bg-foreground/[0.04]"
                                            } ${locked ? "cursor-not-allowed opacity-45 hover:bg-transparent" : ""}`}
                                          >
                                            {/* Completion indicator — check (done) · pulsing dot (current) · ring (next) · empty (todo) */}
                                            <span
                                              className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-200 ${
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
                                                <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                                              ) : completed ? (
                                                <Check className="h-3 w-3 animate-vibe-fade-in" />
                                              ) : isCurrentItem ? (
                                                <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse" />
                                              ) : null}
                                            </span>
                                            {/* Title + type */}
                                            <span className="min-w-0 flex-1">
                                              <span
                                                className={`block truncate text-xs ${
                                                  isCurrentItem || isNext
                                                    ? "font-semibold text-foreground"
                                                    : completed
                                                      ? "font-medium text-muted-foreground"
                                                      : "font-medium text-foreground/85"
                                                }`}
                                              >
                                                {isCurrentItem && itemLoading
                                                  ? "Loading…"
                                                  : item?.name || item?.title || "Untitled"}
                                              </span>
                                              <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                <span className="opacity-80">{getItemIcon(item.type)}</span>
                                                <span>{typeLabel(item.type)}</span>
                                                {isNext && (
                                                  <span className="ml-0.5 rounded-full bg-warm/15 px-1.5 py-px text-[9px] font-medium text-warm">
                                                    Up next
                                                  </span>
                                                )}
                                              </span>
                                            </span>
                                          </button>
                                        );
                                      })
                                    ) : (
                                      <div className="p-2 text-center text-[11px] text-muted-foreground/70">
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

        {/* Footer navigation — compact */}
        <div className="mt-auto shrink-0 border-t border-border p-2">
          <Link
            to="/student"
            onClick={() => onOpenChange(false)}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/80 ${rowBase} hover:bg-foreground/[0.06] hover:text-foreground`}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-foreground/[0.06]">
              <Home className="h-3.5 w-3.5" />
            </span>
            Dashboard
          </Link>
          {supportHref && (
            <a
              href={supportHref}
              target={supportIsEmail ? undefined : "_blank"}
              rel={supportIsEmail ? undefined : "noopener noreferrer"}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/80 ${rowBase} hover:bg-foreground/[0.06] hover:text-foreground`}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-foreground/[0.06]">
                <Headphones className="h-3.5 w-3.5" />
              </span>
              Get Support
              <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
            </a>
          )}
          <Link
            to="/student/profile"
            onClick={() => onOpenChange(false)}
            className={`mt-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${rowBase} hover:bg-foreground/[0.06]`}
          >
            <Avatar className="h-6 w-6 border border-border">
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback className="bg-foreground/10 text-[10px] font-bold text-foreground">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium text-foreground">{user?.name || "Profile"}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">View profile</span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default CourseDrawer;
