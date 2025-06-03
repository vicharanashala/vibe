import React, { useState, useEffect, useCallback } from "react";
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
  SidebarInset, SidebarProvider, SidebarTrigger, SidebarFooter
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCourseVersionById, useUserProgress, useItemsBySectionId, useUpdateProgress } from "@/lib/api/hooks";
import { useAuthStore } from "@/lib/store/auth-store";
import { useCourseStore } from "@/lib/store/course-store";
import { Link } from "@tanstack/react-router";
import ItemContainer, { Item } from "@/components/Item-container";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronRight,
  BookOpen,
  CheckCircle,
  Play,
  FileText,
  HelpCircle,
  Target,
  Home,
  GraduationCap,
} from "lucide-react";

// Temporary IDs for development
// const TEMP_USER_ID = "6831c13a7d17e06882be43ca";
// const TEMP_COURSE_ID = "6831b9651f79c52d445c5d8b";
// const TEMP_VERSION_ID = "6831b9651f79c52d445c5d8c";

// Helper function to get icon for item type
const getItemIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'video':
      return <Play className="h-3 w-3" />;
    case 'blog':
    case 'article':
      return <FileText className="h-3 w-3" />;
    case 'quiz':
      return <HelpCircle className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

// Helper function to sort items by order property
const sortItemsByOrder = (items: any[]) => {
  return [...items].sort((a, b) => {
    const orderA = a.order || '';
    const orderB = b.order || '';
    return orderA.localeCompare(orderB);
  });
};

export default function CoursePage() {
  const { user } = useAuthStore();
  const USER_ID = useAuthStore.getState().user?.userId || "";
  const COURSE_ID = useCourseStore.getState().currentCourse?.courseId || "";
  const VERSION_ID = useCourseStore.getState().currentCourse?.versionId || "";

  // Get the setCurrentCourse function from the store
  const { setCurrentCourse } = useCourseStore();

  // Helper function to update course store navigation state
  const updateCourseNavigation = useCallback((moduleId: string, sectionId: string, itemId: string) => {
    const currentCourse = useCourseStore.getState().currentCourse;
    if (currentCourse) {
      setCurrentCourse({
        ...currentCourse,
        moduleId,
        sectionId,
        itemId
      });
    }
  }, [setCurrentCourse]);

  // State for tracking selected module, section, and item
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<Item | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // State to store all fetched section items
  const [sectionItems, setSectionItems] = useState<Record<string, any[]>>({});

  // Track which section to fetch items for
  const [activeSectionInfo, setActiveSectionInfo] = useState<{
    moduleId: string;
    sectionId: string;
  } | null>(null);

  // Fetch course version data
  const { data: courseVersionData, isLoading: versionLoading, error: versionError } =
    useCourseVersionById(VERSION_ID);

  // Fetch user progress
  const { data: progressData, isLoading: progressLoading, error: progressError, refetch: refetchProgress } =
    useUserProgress(USER_ID, COURSE_ID, VERSION_ID);

  const shouldFetchItems = Boolean(activeSectionInfo?.moduleId && activeSectionInfo?.sectionId);
  const sectionModuleId = activeSectionInfo?.moduleId ?? '';
  const sectionId = activeSectionInfo?.sectionId ?? '';

  const {
    data: currentSectionItems,
    isLoading: itemsLoading,
    error: itemsError
  } = useItemsBySectionId(
    shouldFetchItems ? VERSION_ID : '',
    shouldFetchItems ? sectionModuleId : '6831b98e1f79c52d445c5db5',
    shouldFetchItems ? sectionId : '6831b98e1f79c52d445c5db6',
  );

  // Update section items when data is loaded
  useEffect(() => {
    if (
      shouldFetchItems &&
      activeSectionInfo?.sectionId &&
      currentSectionItems &&
      !itemsLoading
    ) {
      // Sort items by order property before storing
      const sortedItems = sortItemsByOrder(currentSectionItems);
      setSectionItems(prev => ({
        ...prev,
        [activeSectionInfo.sectionId]: sortedItems
      }));
    }
  }, [currentSectionItems, itemsLoading, activeSectionInfo, shouldFetchItems]);
  console.log('Section items:', sectionItems);

  // Effect to initialize based on user progress when data loads
  useEffect(() => {
    if (progressData) {
      const moduleId = progressData.currentModule;
      const sectionId = progressData.currentSection;
      const itemId = progressData.currentItem;

      setSelectedModuleId(moduleId);
      setSelectedSectionId(sectionId);
      setSelectedItemId(itemId);

      // Auto-expand the module and section
      setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
      setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

      // Set active section to fetch items
      setActiveSectionInfo({
        moduleId,
        sectionId
      });

      // Update the course store with the current progress
      updateCourseNavigation(moduleId, sectionId, itemId);
    }
  }, [progressData, updateCourseNavigation]);

  // Effect to set current item when selection changes
  useEffect(() => {
    if (selectedSectionId && selectedItemId && sectionItems[selectedSectionId]) {
      const items = sectionItems[selectedSectionId] || [];
      const found = items.find((item: any) => item.itemId === selectedItemId);

      if (found) {
        setCurrentItem(found);
      }
    }
  }, [selectedItemId, sectionItems, selectedSectionId]);

  // Handle item selection
  const handleSelectItem = (moduleId: string, sectionId: string, itemId: string) => {
    setSelectedModuleId(moduleId);
    setSelectedSectionId(sectionId);
    setSelectedItemId(itemId);

    // Update the course store with the new navigation state
    updateCourseNavigation(moduleId, sectionId, itemId);
  };

  // Toggle module expansion
  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  // Toggle section expansion
  const toggleSection = (moduleId: string, sectionId: string) => {
    setActiveSectionInfo({
      moduleId,
      sectionId
    });

    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const updateProgress = useUpdateProgress();

  const handleNext = () => {
    updateProgress.mutate(
      {
        params: {
          path: {
            userId: USER_ID,
            courseId: COURSE_ID,
            courseVersionId: VERSION_ID
          },
        },
        body: {
          moduleId: selectedModuleId ? selectedModuleId : '',
          sectionId: selectedSectionId ? selectedSectionId : '',
          itemId: selectedItemId ? selectedItemId : '',
          watchItemId: useCourseStore.getState().currentCourse?.watchItemId || '',
        },
      }
    );
        
          refetchProgress();
          if (progressData) {
            const { currentModule, currentSection, currentItem } = progressData;
            setSelectedModuleId(currentModule);
            setSelectedSectionId(currentSection);
            setSelectedItemId(currentItem);
            updateCourseNavigation(currentModule, currentSection, currentItem);
          }
  };


  if (versionLoading || progressLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  if (versionError || progressError) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="text-destructive mb-2">
              <Target className="h-8 w-8 mx-auto" />
            </div>
            <p className="text-destructive font-medium">Error loading course data</p>
            <p className="text-muted-foreground text-sm mt-1">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const modules = courseVersionData?.modules || [];
  const isCurrentItemVideo = currentItem?.type?.toLowerCase() === 'video';

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        {/* Enhanced Course Navigation Sidebar */}
        <Sidebar variant="inset" className="border-r border-border/40 bg-sidebar/50 backdrop-blur-sm">
          <SidebarHeader className="border-b border-border/40 bg-gradient-to-b from-sidebar/80 to-sidebar/60">
            {/* Vibe Logo and Brand */}
            <div className="flex items-center gap-3 px-2 py-0">
              <div className="relative p-1">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 transition-all duration-300" />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="relative h-5 w-5 text-primary drop-shadow-sm"
                >
                  <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                  Vibe
                </h1>
                <p className="text-xs text-muted-foreground">Learning Platform</p>
              </div>
            </div>

            <Separator className="opacity-50" />

            {/* Course Info */}
            {/* <div className="flex items-center gap-2 px-4 py-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate">
                  {courseVersionData?.name || "Course Content"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {modules.length} modules • Learning Progress
                </p>
              </div>
            </div> */}
          </SidebarHeader>

          <SidebarContent className="rounded-lg bg-card/50 p-3 shadow-sm border border-border/30">
            <ScrollArea className="flex-1 px-2 transition-colors">
              <SidebarMenu className="space-y-1 text-sm">
                {modules.map((module: any) => {
                  const moduleId = module.moduleId;
                  const isModuleExpanded = expandedModules[moduleId];
                  const isCurrentModule = moduleId === selectedModuleId;

                  return (
                    <SidebarMenuItem key={moduleId}>
                      <SidebarMenuButton
                        onClick={() => toggleModule(moduleId)}
                        isActive={isCurrentModule}
                        className="group relative h-10 px-3 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/5 hover:shadow-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/15 data-[state=active]:to-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                      >
                        <div className={`p-1.5 rounded-md transition-colors ${isCurrentModule
                            ? "bg-primary/20 text-primary"
                            : "bg-accent/20 text-accent-foreground group-hover:bg-accent/30"
                          }`}>
                          <BookOpen className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-medium text-xs truncate" title={module.name}>{module.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {module.sections?.length || 0} sections
                          </div>
                        </div>
                        <ChevronRight
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${isModuleExpanded ? 'rotate-90' : ''
                            }`}
                        />
                      </SidebarMenuButton>

                      {isModuleExpanded && module.sections && (
                        <SidebarMenuSub className="ml-4 mt-1 space-y-1">
                          {module.sections.map((section: any) => {
                            const sectionId = section.sectionId;
                            const isSectionExpanded = expandedSections[sectionId];
                            const isCurrentSection = sectionId === selectedSectionId;
                            const isLoadingItems = activeSectionInfo?.sectionId === sectionId && itemsLoading;

                            return (
                              <SidebarMenuSubItem key={sectionId}>
                                <SidebarMenuSubButton
                                  onClick={() => toggleSection(moduleId, sectionId)}
                                  isActive={isCurrentSection}
                                  className="group relative h-8 px-2 rounded-md text-xs transition-all duration-200 hover:bg-accent/10 hover:text-accent-foreground data-[state=active]:bg-accent/15 data-[state=active]:text-accent-foreground"
                                >
                                  <div className="font-medium truncate flex-1 min-w-0" title={section.name}>{section.name}</div>
                                  <ChevronRight
                                    className={`h-3 w-3 ml-auto flex-shrink-0 transition-transform duration-200 ${isSectionExpanded ? 'rotate-90' : ''
                                      }`}
                                  />
                                </SidebarMenuSubButton>

                                {isSectionExpanded && (
                                  <SidebarMenuSub className="ml-3 mt-1 space-y-0.5">
                                    {isLoadingItems ? (
                                      <div className="space-y-1 p-2">
                                        <Skeleton className="h-4 w-full rounded" />
                                        <Skeleton className="h-4 w-4/5 rounded" />
                                      </div>
                                    ) : sectionItems[sectionId] ? (
                                      // Ensure items are sorted by "order" property before rendering
                                      sortItemsByOrder(sectionItems[sectionId]).map((item: any) => {
                                        const itemId = item.itemId;
                                        const isCurrentItem = itemId === selectedItemId;

                                        return (
                                          <SidebarMenuSubItem key={itemId}>
                                            <SidebarMenuSubButton
                                              onClick={() => handleSelectItem(moduleId, sectionId, itemId)}
                                              isActive={isCurrentItem}
                                              className="group relative h-8 px-2 rounded-md transition-all duration-200 hover:bg-accent/10 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                                            >
                                              <div className="flex items-center gap-2 w-full min-w-0">
                                                <div className={`p-0.5 rounded transition-colors flex-shrink-0 ${isCurrentItem
                                                    ? "bg-primary/15 text-primary"
                                                    : "bg-accent/15 text-accent-foreground group-hover:bg-accent/25"
                                                  }`}>
                                                  {getItemIcon(item.type)}
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                  <div className="text-xs font-medium truncate" title={item.name}>{item.name}</div>
                                                </div>
                                                {isCurrentItem && (
                                                  <CheckCircle className="h-3 w-3 text-primary flex-shrink-0" />
                                                )}
                                              </div>
                                            </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                        );
                                      })
                                    ) : (
                                      <div className="p-3 text-center">
                                        <div className="text-xs text-muted-foreground">No items found</div>
                                      </div>
                                    )}
                                  </SidebarMenuSub>
                                )}
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </ScrollArea>
          </SidebarContent>

          {/* Navigation Footer */}
          <SidebarFooter className="border-t border-border/40 bg-gradient-to-t from-sidebar/80 to-sidebar/60">
            <SidebarMenu className="space-y-1 px-2 py-3">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="h-9 px-3 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/5 hover:shadow-sm"
                >
                  <Link to="/student" className="flex items-center gap-3">
                    <div className="p-1 rounded-md bg-accent/15">
                      <Home className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <span className="text-sm font-medium">Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="h-9 px-3 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/5 hover:shadow-sm"
                >
                  <Link to="/student/courses" className="flex items-center gap-3">
                    <div className="p-1 rounded-md bg-accent/15">
                      <GraduationCap className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <span className="text-sm font-medium">Courses</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <Separator className="my-2 opacity-50" />

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="h-10 px-3 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/5 hover:shadow-sm"
                >
                  <Link to="/student/profile" className="flex items-center gap-3">
                    <Avatar className="h-6 w-6 border border-border/20">
                      <AvatarImage src={user?.avatar} alt={user?.name} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-bold text-xs">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium truncate" title={user?.name || 'Profile'}>{user?.name || 'Profile'}</div>
                      <div className="text-xs text-muted-foreground">View Profile</div>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content Area */}
        <SidebarInset className="flex-1 bg-gradient-to-br from-background via-background to-background/95">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/20 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 px-4">
            <SidebarTrigger className="-ml-1 h-8 w-8 rounded-md hover:bg-accent/10 transition-colors" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="text-xl font-medium text-foreground truncate" title={currentItem ? currentItem.name : 'Select content to begin learning'}>
                {currentItem ? currentItem.name : 'Select content to begin learning'}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <ThemeToggle />
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative">
            {/* Ambient background effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.01] via-transparent to-secondary/[0.01] pointer-events-none" />

            {currentItem ? (
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  <ItemContainer item={currentItem} />
                </div>

                {/* Next Button for Video Content */}
                {isCurrentItemVideo && (
                  <div className="pb-4 pr-3 border-t border-border/20 bg-background/50 backdrop-blur-sm">
                    <div className="flex justify-end">
                      <Button
                        onClick={handleNext}
                        disabled={updateProgress.isPending}
                        className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
                        size="lg"
                      >
                        {updateProgress.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />
                            Processing
                          </>
                        ) : (
                          <>
                            Next Lesson
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center relative z-10">
                <div className="text-center max-w-md">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 rounded-full blur-xl opacity-60" />
                    <div className="relative p-6 rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
                      <BookOpen className="h-12 w-12 text-primary mx-auto" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Ready to Learn?
                  </h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Select an item from the course navigation to begin your learning journey and unlock new knowledge.
                  </p>
                  <Button
                    variant="outline"
                    className="transition-all duration-200 hover:bg-gradient-to-r hover:from-accent/10 hover:to-accent/5 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/10"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Browse Content
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SidebarInset>

        {/* Enhanced Next Button - Only for non-video content */}
        {currentItem && !isCurrentItemVideo && (
          <div className="fixed bottom-6 right-6 z-50">
            <Button
              onClick={handleNext}
              disabled={updateProgress.isPending}
              className="shadow-2xl hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
              size="lg"
            >
              {updateProgress.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />
                  Processing
                </>
              ) : (
                <>
                  Next Lesson
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
};
