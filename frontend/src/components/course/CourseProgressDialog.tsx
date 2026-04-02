import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Loader2,
  Search,
  Star,
} from "lucide-react";

import { useCourseStore } from "@/store/course-store";
import {
  useCourseVersionById,
  useModuleProgress,
  useUserProgress,
  useUserProgressPercentage,
} from "@/hooks/hooks";
import { apiClient } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils/utils";

type Difficulty = "EASY" | "MEDIUM" | "HARD" | "UNKNOWN";

type DialogItem = {
  id: string;
  title: string;
  type: string;
  difficulty: Difficulty;
  completed: boolean;
  revision: boolean;
  moduleId: string;
  sectionId: string;
};

type DialogSection = {
  id: string;
  title: string;
  items: DialogItem[];
};

type DialogModule = {
  id: string;
  title: string;
  sections: DialogSection[];
  totalItems?: number;
  completedItems?: number;
};

const difficultyMeta: Record<
  Exclude<Difficulty, "UNKNOWN">,
  { label: string; dot: string; badgeClass: string }
> = {
  EASY: {
    label: "Easy",
    dot: "bg-emerald-500",
    badgeClass: "border-emerald-500/25 bg-emerald-500/12 text-emerald-400",
  },
  MEDIUM: {
    label: "Medium",
    dot: "bg-amber-500",
    badgeClass: "border-amber-500/25 bg-amber-500/12 text-amber-300",
  },
  HARD: {
    label: "Hard",
    dot: "bg-rose-500",
    badgeClass: "border-rose-500/25 bg-rose-500/12 text-rose-300",
  },
};

const coerceString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const coerceBoolean = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "completed", "done", "watched"].includes(normalized)) return true;
      if (["false", "pending", "not_started"].includes(normalized)) return false;
    }
  }
  return false;
};

const normalizeDifficulty = (item: any): Difficulty => {
  const raw = coerceString(
    item?.difficulty,
    item?.level,
    item?.metadata?.difficulty,
    item?.content?.difficulty
  ).toUpperCase();

  if (raw.includes("EASY")) return "EASY";
  if (raw.includes("MEDIUM")) return "MEDIUM";
  if (raw.includes("HARD")) return "HARD";
  return "UNKNOWN";
};

const sortItemsByOrder = (items: any[]) =>
  [...items].sort((a, b) => {
    const orderA = typeof a?.order === "string" ? a.order : "";
    const orderB = typeof b?.order === "string" ? b.order : "";
    return orderA.localeCompare(orderB);
  });

const normalizeModules = (
  structureModules: any[] | undefined,
  sectionItemsMap: Map<string, any[]>,
  moduleProgressData:
    | {
        moduleId: string;
        moduleName: string;
        totalItems: number;
        completedItems: number;
      }[]
    | undefined
) => {
  const progressMap = new Map(
    (moduleProgressData || []).map((module) => [module.moduleId, module])
  );

  if (!Array.isArray(structureModules)) return [] as DialogModule[];

  return structureModules.map((module: any, moduleIndex: number) => {
    const moduleId =
      coerceString(module?._id, module?.id, module?.moduleId) ||
      `module-${moduleIndex + 1}`;
    const progress = progressMap.get(moduleId);

    return {
      id: moduleId,
      title:
        coerceString(module?.name, module?.title, module?.moduleName) ||
        `Module ${moduleIndex + 1}`,
      totalItems: progress?.totalItems,
      completedItems: progress?.completedItems,
      sections: (Array.isArray(module?.sections) ? module.sections : []).map(
        (section: any, sectionIndex: number) => {
          const sectionId =
            coerceString(section?._id, section?.id, section?.sectionId) ||
            `section-${moduleIndex + 1}-${sectionIndex + 1}`;

          return {
            id: sectionId,
            title:
              coerceString(section?.name, section?.title, section?.sectionName) ||
              `Section ${sectionIndex + 1}`,
            items: (
              sectionItemsMap.get(sectionId) ||
              (Array.isArray(section?.items) ? section.items : [])
            ).map(
              (item: any, itemIndex: number) => ({
                id:
                  coerceString(item?._id, item?.id, item?.itemId, item?.watchItemId) ||
                  `item-${moduleIndex + 1}-${sectionIndex + 1}-${itemIndex + 1}`,
                title:
                  coerceString(item?.name, item?.title, item?.itemName, item?.label) ||
                  "Untitled item",
                type:
                  coerceString(item?.type, item?.itemType, item?.contentType).toUpperCase() ||
                  "CONTENT",
                difficulty: normalizeDifficulty(item),
                completed: coerceBoolean(
                  item?.completed,
                  item?.isCompleted,
                  item?.isAlreadyWatched,
                  item?.watched,
                  item?.done,
                  item?.status,
                  item?.progressStatus
                ),
                revision: coerceBoolean(
                  item?.revision,
                  item?.isRevision,
                  item?.markedForRevision,
                  item?.isMarkedForRevision,
                  item?.starred,
                  item?.bookmark
                ),
                moduleId,
                sectionId,
              })
            ),
          };
        }
      ),
    };
  });
};

const CircularProgress = ({ value }: { value: number }) => {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className="grid h-20 w-20 place-items-center rounded-full"
      style={{
        background: `conic-gradient(rgb(34 197 94) ${clampedValue * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
      }}
    >
      <div className="grid h-15 w-15 place-items-center rounded-full bg-[#1a1a1a] text-xl font-semibold text-white">
        {Math.round(clampedValue)}%
      </div>
    </div>
  );
};

export function CourseProgressDialog({
  open,
  onOpenChange,
  courseId,
  versionId,
  cohortId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId?: string;
  versionId?: string;
  cohortId?: string;
}) {
  const navigate = useNavigate();
  const { setCurrentCourse } = useCourseStore();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("ALL");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [revisionOverrides, setRevisionOverrides] = useState<Record<string, boolean>>({});
  const normalizedCohortId = cohortId && cohortId.trim() ? cohortId : undefined;
  const revisionStorageKey =
    courseId && versionId ? `student-course-revision:${courseId}:${versionId}` : null;

  const enabled = open && !!courseId && !!versionId;

  const { data: courseVersionData, isLoading: versionLoading } = useCourseVersionById(
    versionId || "",
    enabled,
    normalizedCohortId
  );
  const { data: progressData, isLoading: progressLoading } = useUserProgress(
    courseId || "",
    versionId || "",
    normalizedCohortId
  );
  const { data: percentageData, isLoading: percentageLoading } =
    useUserProgressPercentage(courseId || "", versionId || "");
  const { data: moduleProgressData, isLoading: moduleProgressLoading, error: moduleProgressError } =
    useModuleProgress(courseId || "", versionId || "", normalizedCohortId);

  const structureModules = useMemo(
    () => ((courseVersionData as any)?.modules && Array.isArray((courseVersionData as any)?.modules)
      ? (courseVersionData as any).modules
      : []),
    [courseVersionData]
  );

  const sectionDescriptors = useMemo(
    () =>
      structureModules.flatMap((module: any) => {
        const moduleId = coerceString(module?._id, module?.id, module?.moduleId);
        const sections = Array.isArray(module?.sections) ? module.sections : [];

        return sections.map((section: any) => ({
          moduleId,
          sectionId: coerceString(section?._id, section?.id, section?.sectionId),
        }));
      }).filter((entry) => entry.moduleId && entry.sectionId),
    [structureModules]
  );

  const sectionItemQueries = useQueries({
    queries: enabled
      ? sectionDescriptors.map(({ moduleId, sectionId }) => ({
          queryKey: [
            "course-progress-dialog-items",
            versionId,
            moduleId,
            sectionId,
            normalizedCohortId || "",
          ],
          queryFn: async () => {
            const query = normalizedCohortId
              ? `?${new URLSearchParams({ cohortId: normalizedCohortId }).toString()}`
              : "";
            const response = await apiClient.get<any[] | { items?: any[] }>(
              `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items${query}`
            );

            if (Array.isArray(response.data)) {
              return sortItemsByOrder(response.data);
            }

            if (Array.isArray((response.data as any)?.items)) {
              return sortItemsByOrder((response.data as any).items);
            }

            return [];
          },
          enabled: Boolean(versionId && moduleId && sectionId),
          staleTime: 5 * 60 * 1000,
        }))
      : [],
  });

  const sectionItemsMap = useMemo(() => {
    const map = new Map<string, any[]>();

    sectionDescriptors.forEach((descriptor, index) => {
      const queryData = sectionItemQueries[index]?.data;
      if (Array.isArray(queryData)) {
        map.set(descriptor.sectionId, queryData);
      }
    });

    return map;
  }, [sectionDescriptors, sectionItemQueries]);

  const modules = useMemo(
    () =>
      normalizeModules(
        structureModules,
        sectionItemsMap,
        moduleProgressData
      ),
    [structureModules, sectionItemsMap, moduleProgressData]
  );

  useEffect(() => {
    if (!revisionStorageKey || typeof window === "undefined") {
      setRevisionOverrides({});
      return;
    }

    try {
      const stored = window.localStorage.getItem(revisionStorageKey);
      setRevisionOverrides(stored ? JSON.parse(stored) : {});
    } catch {
      setRevisionOverrides({});
    }
  }, [revisionStorageKey]);

  useEffect(() => {
    if (!revisionStorageKey || typeof window === "undefined") return;

    window.localStorage.setItem(
      revisionStorageKey,
      JSON.stringify(revisionOverrides)
    );
  }, [revisionOverrides, revisionStorageKey]);

  const displayModules = useMemo(
    () =>
      modules.map((module) => ({
        ...module,
        sections: module.sections.map((section) => ({
          ...section,
          items: section.items.map((item) => ({
            ...item,
            revision:
              revisionOverrides[item.id] !== undefined
                ? revisionOverrides[item.id]
                : item.revision,
          })),
        })),
      })),
    [modules, revisionOverrides]
  );

  const difficultySummary = useMemo(() => {
    const items = displayModules.flatMap((module) =>
      module.sections.flatMap((section) => section.items)
    );

    return {
      EASY: {
        completed: items.filter((item) => item.difficulty === "EASY" && item.completed).length,
        total: items.filter((item) => item.difficulty === "EASY").length,
      },
      MEDIUM: {
        completed: items.filter((item) => item.difficulty === "MEDIUM" && item.completed).length,
        total: items.filter((item) => item.difficulty === "MEDIUM").length,
      },
      HARD: {
        completed: items.filter((item) => item.difficulty === "HARD" && item.completed).length,
        total: items.filter((item) => item.difficulty === "HARD").length,
      },
    };
  }, [displayModules]);

  const filteredModules = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return displayModules
      .map((module) => ({
        ...module,
        sections: module.sections
          .map((section) => ({
            ...section,
            items: section.items.filter((item) => {
              const matchesTab = activeTab === "revision" ? item.revision : true;
              const matchesDifficulty =
                difficultyFilter === "ALL" ? true : item.difficulty === difficultyFilter;
              const matchesSearch =
                !search ||
                item.title.toLowerCase().includes(search) ||
                module.title.toLowerCase().includes(search) ||
                section.title.toLowerCase().includes(search);

              return matchesTab && matchesDifficulty && matchesSearch;
            }),
          }))
          .filter((section) => section.items.length > 0),
      }))
      .filter((module) => module.sections.length > 0);
  }, [displayModules, activeTab, difficultyFilter, searchQuery]);

  const overallPercent = percentageData?.percentCompleted ?? 0;
  const completedItems = percentageData?.completedItems ?? 0;
  const totalItems = percentageData?.totalItems ?? 0;
  const currentPath = progressData
    ? `Module ${progressData.currentModuleNumber || "--"} • Section ${progressData.currentSectionNumber || "--"}`
    : null;
  const sectionItemsLoading = sectionItemQueries.some((query) => query.isLoading);
  const sectionItemsError =
    sectionItemQueries.find((query) => query.error)?.error instanceof Error
      ? (sectionItemQueries.find((query) => query.error)?.error as Error).message
      : null;

  const isLoading =
    versionLoading ||
    progressLoading ||
    percentageLoading ||
    moduleProgressLoading ||
    sectionItemsLoading;

  const combinedError = moduleProgressError || sectionItemsError || null;

  const handleWatch = (item: DialogItem) => {
    if (!courseId || !versionId) return;

    setCurrentCourse({
      courseId,
      versionId,
      moduleId: item.moduleId,
      sectionId: item.sectionId,
      itemId: item.id,
      watchItemId: null,
      cohortId: normalizedCohortId || null,
      cohortName: null,
    });

    onOpenChange(false);
    navigate({ to: "/student/learn" });
  };

  const handleToggleRevision = (item: DialogItem) => {
    setRevisionOverrides((prev) => {
      const currentValue =
        prev[item.id] !== undefined ? prev[item.id] : item.revision;

      return {
        ...prev,
        [item.id]: !currentValue,
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-[min(92vw,1100px)] overflow-hidden border border-border/60 bg-background/95 p-0 text-foreground shadow-2xl backdrop-blur">
        <DialogHeader className="border-b border-border/50 px-5 py-4 text-left md:px-6 md:py-5">
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {(courseVersionData as any)?.course?.name ||
              (courseVersionData as any)?.courseName ||
              (courseVersionData as any)?.name ||
              "Course Progress"}
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-4xl text-sm text-muted-foreground md:text-base">
            {(courseVersionData as any)?.description ||
              "Track your module-by-module progress, revision list, and item difficulty from one place."}
            {currentPath ? ` Currently on ${currentPath}.` : ""}
          </DialogDescription>
          <div className="mt-4 flex justify-end">
            <div className="rounded-xl border border-border/50 bg-card px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Last updated
              </div>
              <div className="mt-1 text-lg text-foreground md:text-xl">
                {(courseVersionData as any)?.updatedAt
                  ? new Date((courseVersionData as any).updatedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : new Date().toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[70vh] bg-background">
          <div className="space-y-5 px-5 py-5 md:px-6 md:py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
                <TabsList className="h-12 rounded-2xl bg-muted/70 p-1">
                  <TabsTrigger value="all" className="h-10 rounded-xl px-5 text-sm">
                    All Modules
                  </TabsTrigger>
                  <TabsTrigger value="revision" className="h-10 rounded-xl px-5 text-sm">
                    Revision
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex w-full flex-col gap-3 md:flex-row lg:w-auto">
                <div className="relative min-w-[280px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="h-11 rounded-xl pl-10"
                  />
                </div>
                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                  <SelectTrigger className="h-11 w-full rounded-xl md:w-[160px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="EASY">Easy</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HARD">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="rounded-[24px] border-border/60 bg-card/80 text-card-foreground shadow-none">
              <CardContent className="flex flex-col gap-6 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <CircularProgress value={overallPercent} />
                  <div className="space-y-1">
                    <div className="text-2xl font-semibold md:text-3xl">Overall Progress</div>
                    <div className="text-base text-muted-foreground md:text-lg">
                      {completedItems} / {totalItems || "--"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {(["EASY", "MEDIUM", "HARD"] as const).map((key) => (
                    <div key={key} className="flex items-center gap-3 rounded-2xl border border-border/50 px-4 py-3">
                      <span className={cn("h-2.5 w-2.5 rounded-full", difficultyMeta[key].dot)} />
                      <div className="flex items-center gap-2 text-base md:text-lg">
                        <span className="text-muted-foreground">{difficultyMeta[key].label}</span>
                        <span className="font-semibold text-foreground">
                          {difficultySummary[key].completed}/{difficultySummary[key].total}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {combinedError && (
              <Card className="rounded-2xl border-destructive/30 bg-destructive/5 shadow-none">
                <CardContent className="p-4 text-sm text-destructive">
                  Progress details could not fully load. {combinedError}
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-border/60 bg-card/40">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading progress...
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredModules.length === 0 && (
                  <Card className="rounded-[24px] border-border/60 bg-card/40 shadow-none">
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      No module/topic rows were returned for this course yet.
                    </CardContent>
                  </Card>
                )}
                {filteredModules.map((module) => {
                  const total =
                    module.totalItems ??
                    module.sections.reduce((sum, section) => sum + section.items.length, 0);
                  const completed =
                    module.completedItems ??
                    module.sections.reduce(
                      (sum, section) =>
                        sum + section.items.filter((item) => item.completed).length,
                      0
                    );
                  const moduleProgress = total > 0 ? (completed / total) * 100 : 0;
                  const isExpanded = expandedModules[module.id] ?? true;

                  return (
                    <Card key={module.id} className="rounded-[24px] border-border/60 bg-card/80 text-card-foreground shadow-none">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedModules((prev) => ({
                            ...prev,
                            [module.id]: !isExpanded,
                          }))
                        }
                        className="flex w-full items-center gap-4 px-6 py-6 text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-2xl font-semibold md:text-3xl">{module.title}</div>
                        </div>
                        <div className="hidden min-w-[200px] items-center gap-4 md:flex">
                          <Progress value={moduleProgress} className="h-2 bg-muted [&_[data-slot=progress-indicator]]:bg-emerald-500" />
                          <span className="text-lg text-muted-foreground md:text-xl">
                            {completed} / {total}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <CardContent className="px-5 pb-5 pt-0">
                          <div className="overflow-hidden rounded-2xl border border-border/50">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-border/50 bg-muted/30 hover:bg-muted/30">
                                  <TableHead className="h-12 px-5 text-xs uppercase tracking-wide text-muted-foreground">Status</TableHead>
                                  <TableHead className="h-12 px-5 text-xs uppercase tracking-wide text-muted-foreground">Topic</TableHead>
                                  <TableHead className="h-12 px-5 text-xs uppercase tracking-wide text-muted-foreground">Watch</TableHead>
                                  <TableHead className="h-12 px-5 text-xs uppercase tracking-wide text-muted-foreground">Revision</TableHead>
                                  <TableHead className="h-12 px-5 text-xs uppercase tracking-wide text-muted-foreground">Difficulty</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {module.sections.flatMap((section) =>
                                  section.items.map((item) => (
                                    <TableRow key={item.id} className="border-border/50 hover:bg-muted/20">
                                      <TableCell className="px-5 py-4">
                                        <span
                                          className={cn(
                                            "grid h-5 w-5 place-items-center rounded-md border",
                                            item.completed
                                              ? "border-emerald-500 bg-emerald-500 text-white"
                                              : "border-border bg-transparent text-transparent"
                                          )}
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </span>
                                      </TableCell>
                                      <TableCell className="px-5 py-4">
                                        <div className="space-y-1">
                                          <div className="font-medium text-foreground">{item.title}</div>
                                          <div className="text-xs text-muted-foreground">{section.title}</div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="px-5 py-4">
                                        <button
                                          type="button"
                                          onClick={() => handleWatch(item)}
                                          className="font-semibold text-amber-400 transition-colors hover:text-amber-300"
                                        >
                                          Watch
                                        </button>
                                      </TableCell>
                                      <TableCell className="px-5 py-4">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleRevision(item)}
                                          aria-label={
                                            item.revision
                                              ? `Remove ${item.title} from revision`
                                              : `Mark ${item.title} for revision`
                                          }
                                          className="rounded-md p-1 transition-colors hover:bg-muted/60"
                                        >
                                          {item.revision ? (
                                            <Star className="h-4 w-4 fill-current text-amber-400" />
                                          ) : (
                                            <Circle className="h-4 w-4 text-muted-foreground/40" />
                                          )}
                                        </button>
                                      </TableCell>
                                      <TableCell className="px-5 py-4">
                                        {item.difficulty === "UNKNOWN" ? (
                                          <Badge variant="outline" className="rounded-full border-border/50 bg-muted/40 px-3 py-1 text-muted-foreground">
                                            Unknown
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "rounded-full px-3 py-1",
                                              difficultyMeta[item.difficulty].badgeClass
                                            )}
                                          >
                                            {difficultyMeta[item.difficulty].label}
                                          </Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
