import React, { useState, useEffect, useCallback, use, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCourseVersionById, useUserProgress, useItemsBySectionId, useUpdateProgress, useItemById, useProctoringSettings } from "@/hooks/hooks";
import { useAuthStore } from "@/store/auth-store";
import { useCourseStore } from "@/store/course-store";
import { Link } from "@tanstack/react-router";
import ItemContainer, { Item, ItemContainerRef } from "@/components/Item-container";
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
  AlertCircle,
} from "lucide-react";
import FloatingVideo from "@/components/floating-video";
import { isError } from "util";
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

interface itemref {
  order?: string;
  type?: string;
  _id?: string;
}

// Helper function to sort items by order property
const sortItemsByOrder = (items: any[]) => {
  return [...items].sort((a, b) => {
    const orderA = a.order || '';
    const orderB = b.order || '';
    return orderA.localeCompare(orderB);
  });
};

export default function CoursePage() {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const USER_ID = useAuthStore.getState().user?.userId || "";
  const COURSE_ID = useCourseStore.getState().currentCourse?.courseId || "";
  const VERSION_ID = useCourseStore.getState().currentCourse?.versionId || "";

  // Get the setCurrentCourse function from the store
  const { setCurrentCourse } = useCourseStore();
 
  // ✅ Add the missing ref declaration
  const itemContainerRef = useRef<ItemContainerRef>(null);

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
  const [doGesture, setDoGesture] = useState<boolean>(false);
  const [isItemForbidden, setIsItemForbidden] = useState<boolean>(false);

  // State to store all fetched section items
  const [sectionItems, setSectionItems] = useState<Record<string, itemref[]>>({});

  // Track which section to fetch items for
  const [activeSectionInfo, setActiveSectionInfo] = useState<{
    moduleId: string;
    sectionId: string;
  } | null>(null);

  // Initialize API hooks
  const updateProgress = useUpdateProgress();

  // Fetch course version data
  const { data: courseVersionData, isLoading: versionLoading, error: versionError } =
    useCourseVersionById(VERSION_ID);

  // Fetch user progress
  const { data: progressData, isLoading: progressLoading, error: progressError, refetch: refetchProgress } =
    useUserProgress(USER_ID, COURSE_ID, VERSION_ID);

  // Fetch proctoring settings for the course (fetched once when component loads)
  const { data: proctoringData, isLoading: proctoringLoading } =
    useProctoringSettings(USER_ID, COURSE_ID, VERSION_ID);

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
    shouldFetchItems ? sectionId : '6831b98e1f79c52d445c5db6'
  );

  // Fetch individual item details when an item is selected
  const shouldFetchItem = Boolean(selectedItemId && COURSE_ID && VERSION_ID);
  const {
    data: itemData,
    isLoading: itemLoading,
    error: itemError
  } = useItemById(
    shouldFetchItem ? COURSE_ID : '',
    shouldFetchItem ? VERSION_ID : '',
    shouldFetchItem ? selectedItemId! : ''
  );
  useEffect(() => {
    console.error('Current item error:', itemError);
    if (itemError) {
      setIsItemForbidden(true);
    } else {
      setIsItemForbidden(false);
    }
  }, [itemError]);

  useEffect(() => {
    console.log('Current item data:', itemData);
  }, [itemData]);

  // Log proctoring settings when loaded (only logs once when data is available)
  useEffect(() => {
    if (proctoringData) {
      console.log('Proctoring settings loaded:', proctoringData);
    }
  }, [proctoringData]);

  // Update section items when data is loaded
  useEffect(() => {
    if (
      shouldFetchItems &&
      activeSectionInfo?.sectionId &&
      currentSectionItems &&
      !itemsLoading
    ) {
      // Safely handle the response structure
      const itemsArray = (currentSectionItems as any)?.items || 
                         (Array.isArray(currentSectionItems) ? currentSectionItems : []);
      
      // Sort items by order property before storing
      const sortedItems = sortItemsByOrder(itemsArray);
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

  // ✅ Additional effect to handle progress updates from handleNext
  useEffect(() => {
    if (progressData && updateProgress.isSuccess) {
      const moduleId = progressData.currentModule;
      const sectionId = progressData.currentSection;
      const itemId = progressData.currentItem;

      // Only update if we're not already on this item
      if (itemId !== selectedItemId) {
        setSelectedModuleId(moduleId);
        setSelectedSectionId(sectionId);
        setSelectedItemId(itemId);

        // ✅ Ensure new section items are loaded if switching sections
        if (sectionId !== selectedSectionId) {
          setActiveSectionInfo({
            moduleId,
            sectionId
          });
        }

        // ✅ Auto-expand the new module and section
        setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
        setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

        updateCourseNavigation(moduleId, sectionId, itemId);
      }
    }
  }, [progressData, updateProgress.isSuccess, selectedItemId, selectedSectionId, updateCourseNavigation]);

  // Effect to set current item when item data is fetched
  useEffect(() => {
    if (itemData && !itemLoading) {
      // Handle the different possible response structures
      const item = (itemData as any)?.item || itemData;
      if (item && typeof item === 'object' && item._id) {
        setCurrentItem(item);
      }
    }
  }, [itemData, itemLoading]);

  // Handle item selection
  const handleSelectItem = (moduleId: string, sectionId: string, _id: string) => {
    // ✅ Stop current item before switching
    if (itemContainerRef.current) {
      itemContainerRef.current.stopCurrentItem();
    }

    setSelectedModuleId(moduleId);
    setSelectedSectionId(sectionId);
    setSelectedItemId(_id);

    // ✅ Ensure section items are loaded if not already
    if (!sectionItems[sectionId]) {
      setActiveSectionInfo({
        moduleId,
        sectionId
      });
    }

    // ✅ Expand the module and section automatically
    setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
    setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

    // Update the course store with the new navigation state
    updateCourseNavigation(moduleId, sectionId, _id);
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

  const handleNext = useCallback(() => {
    // ✅ Stop current item before moving to next
    if (itemContainerRef.current) {
      itemContainerRef.current.stopCurrentItem();
    }

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
          watchItemId: useCourseStore.getState().currentCourse?.watchItemId,
          attemptId: attemptId,
        },
      }
    );
    
    // ✅ Wait for progress update to complete, then refetch and update state
    setTimeout(() => {
      refetchProgress();
    }, 300);
  }, [updateProgress, USER_ID, COURSE_ID, VERSION_ID, selectedModuleId, selectedSectionId, selectedItemId, refetchProgress]);

  if (versionLoading || progressLoading || proctoringLoading) {
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
              <Target className="h-8 w-8 mx-auto"></Target>
            </div>
            <p className="text-destructive font-medium">Error loading course data</p>
            <p className="text-muted-foreground text-sm mt-1">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const modules = (courseVersionData as any)?.modules || [];

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        {/* Enhanced Course Navigation Sidebar */}
        <Sidebar variant="inset" className="border-r border-border/40 bg-sidebar/50 backdrop-blur-sm">
          <SidebarHeader className="border-b border-border/40 bg-gradient-to-b from-sidebar/80 to-sidebar/60">
            {/* Vibe Logo and Brand */}
            <div className="flex items-center gap-3 px-0 py-0">
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

          <SidebarContent className="bg-card/50 pl-2 shadow-sm border border-border/30">
            <ScrollArea className="flex-1 transition-colors">
              <SidebarMenu className="space-y-1 text-sm pr-0">
                {modules.map((module: any) => {
                  const moduleId = module.moduleId;
                  const isModuleExpanded = expandedModules[moduleId];
                  const isCurrentModule = moduleId === selectedModuleId;

                  return (
                    <SidebarMenuItem key={moduleId}>
                      <SidebarMenuButton
                        onClick={() => toggleModule(moduleId)}
                        isActive={isCurrentModule}
                        className="group relative h-10 px-3 w-full rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/5 hover:shadow-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/15 data-[state=active]:to-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 transition-transform duration-200 flex-shrink-0 ${isModuleExpanded ? 'rotate-90' : ''
                            }`}
                        />
                        <div className="flex-1 text-left min-w-0 ml-2">
                          <div className="font-medium text-xs truncate" title={module.name}>
                            {module.name.length > 34 ? `${module.name.substring(0, 31)}...` : module.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {module.sections?.length || 0} sections
                          </div>
                        </div>
                      </SidebarMenuButton>

                      {isModuleExpanded && module.sections && (
                        <SidebarMenuSub className="ml-0 mt-1 space-y-1">
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
                                  className="group relative h-8 px-3 w-full rounded-md text-xs transition-all duration-200 hover:bg-accent/10 hover:text-accent-foreground data-[state=active]:bg-accent/15 data-[state=active]:text-accent-foreground"
                                >
                                  <ChevronRight
                                    className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${isSectionExpanded ? 'rotate-90' : ''
                                      }`}
                                  />
                                  <div className="font-medium truncate flex-1 min-w-0 ml-2" title={section.name}>
                                    {section.name.length > 27 ? `${section.name.substring(0, 24)}...` : section.name}
                                  </div>
                                </SidebarMenuSubButton>

                                {isSectionExpanded && (
                                  <SidebarMenuSub className="ml-0 mt-1 space-y-0.5">
                                    {isLoadingItems ? (
                                      <div className="space-y-1 p-2">
                                        <Skeleton className="h-4 w-full rounded" />
                                        <Skeleton className="h-4 w-4/5 rounded" />
                                      </div>
                                    ) : sectionItems[sectionId] ? (
                                      sortItemsByOrder(sectionItems[sectionId]).map((item: any) => {
                                        const itemId = item._id;
                                        const isCurrentItem = itemId === selectedItemId;

                                        return (
                                          <SidebarMenuSubItem key={itemId}>
                                            <SidebarMenuSubButton
                                              onClick={() => handleSelectItem(moduleId, sectionId, itemId)}
                                              isActive={isCurrentItem}
                                              className="group relative h-8 px-3 w-full rounded-md transition-all duration-200 hover:bg-accent/10 data-[state=active]:bg-primary/10 data-[state=active]:text-primary justify-start"
                                            >
                                              <div className="flex items-center gap-2 w-full min-w-0">
                                                <div className={`p-0.5 rounded transition-colors flex-shrink-0 ${isCurrentItem
                                                    ? "bg-primary/15 text-primary"
                                                    : "bg-accent/15 text-accent-foreground group-hover:bg-accent/25"
                                                  }`}>
                                                  {getItemIcon(item.type)}
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                  <div className="text-xs font-medium truncate w-full" title={currentItem?.name || 'Loading...'}>
                                                    {selectedItemId === itemId && itemLoading ? 'Loading...' : 
                                                     selectedItemId === itemId && currentItem?.name ? 
                                                     (currentItem.name.length > 18 ? `${currentItem.name.substring(0, 19)}...` : currentItem.name) : 
                                                     `${item.name||item.type[0] + item.type.slice(1).toLowerCase() || ''} Item `}
                                                  </div>
                                                </div>
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
            <SidebarFooter className="border-t border-border/40 bg-gradient-to-t from-sidebar/80 to-sidebar/60 ">
              <FloatingVideo setDoGesture={setDoGesture} settings={proctoringData}></FloatingVideo>
            </SidebarFooter>
          {/* Navigation Footer */}
          <SidebarFooter className="border-t border-border/40 bg-gradient-to-t from-sidebar/80 to-sidebar/60">
            <SidebarMenu className="space-y-1 pl-2 py-3">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="h-9 px-3 w-full rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/5 hover:shadow-sm"
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
                  className="h-9 px-3 w-full rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/5 hover:shadow-sm"
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
                  className="h-10 px-3 w-full rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/5 hover:shadow-sm"
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
                <b>{currentItem ? currentItem.name : 'Select content to begin learning'}</b>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <ThemeToggle />
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative">
            {/* Ambient background effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.01] via-transparent to-secondary/[0.01] pointer-events-none" />

            {/* ✅ Item Access Error Notification */}
            {isItemForbidden && (
              <Card className="fixed top-8 right-8 z-50 w-96 border-2 border-destructive/40 bg-destructive/95 text-destructive-foreground shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2 duration-300">
                <CardContent className="flex items-center gap-4 px-6 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive-foreground/20">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Badge variant="outline" className="border-destructive-foreground/30 bg-destructive-foreground/10 text-destructive-foreground font-bold">
                      Access Restricted
                    </Badge>
                    <p className="text-sm font-medium leading-relaxed">
                      The item does not match current progress. Please complete current item first.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsItemForbidden(false)}
                    className="text-destructive-foreground hover:bg-destructive-foreground/10"
                  >
                    ×
                  </Button>
                </CardContent>
              </Card>
             )}

            {/* Gesture Popup */}
            {doGesture && (
              <Card className="fixed top-8 right-8 z-50 w-90 border-2 border-destructive/40 bg-destructive/95 text-destructive-foreground shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2 duration-300">
                <CardContent className="flex items-center gap-4 px-6 py-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive-foreground/20 text-3xl">
                    👍
                  </div>
                  <div className="flex-1 space-y-1">
                    <Badge variant="outline" className="border-destructive-foreground/30 bg-destructive-foreground/10 text-destructive-foreground font-bold">
                      Gesture Required
                    </Badge>
                    <p className="text-sm font-medium">
                      Please show a <strong>thumbs up</strong> to continue!
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentItem ? (
              <div className="relative z-10 h-full">
                <ItemContainer 
                  ref={itemContainerRef} 
                  item={currentItem} 
                  doGesture={doGesture}
                  onNext={handleNext}
                  isProgressUpdating={updateProgress.isPending}
                  attemptId={attemptId || undefined}
                  setAttemptId={setAttemptId}
                />
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
      </div>
    </SidebarProvider>
  );
};