import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useCourseVersionById, useUserProgress, useItemsBySectionId, useItemById, useProctoringSettings, useGetProcotoringSettings } from "@/hooks/hooks";
import { useAuthStore } from "@/store/auth-store";
import { useCourseStore } from "@/store/course-store";
import { Link, Navigate, useRouter } from "@tanstack/react-router";
import ItemContainer from "@/components/Item-container";
import type { Item, ItemContainerRef } from "@/types/item-container.types";
import { Skeleton } from "@/components/ui/skeleton";
import { AuroraText } from "@/components/magicui/aurora-text";
import confetti from "canvas-confetti";
import {
  ChevronRight,
  BookOpen,
  Play,
  FileText,
  HelpCircle,
  Target,
  Home,
  GraduationCap,
  AlertCircle,
  ArrowLeft,
  CheckCircle
} from "lucide-react";
import FloatingVideo from "@/components/floating-video";
import type { itemref } from "@/types/course.types";
import { logout } from "@/utils/auth";
import { StudentProctoringSettings } from "@/types/video.types";
import { getProctoringSettings } from "../testing-proctoring/proctoring";
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

  const [attemptId, setAttemptId] = useState<string | null>(null);
  // Dialog state for proctoring declaration
  const [showProctorDialog, setShowProctorDialog] = useState(true);
  const { user } = useAuthStore();
  const router = useRouter();
  const COURSE_ID = useCourseStore.getState().currentCourse?.courseId || "";
  const VERSION_ID = useCourseStore.getState().currentCourse?.versionId || "";
  const { getSettings, settingLoading: proctoringLoading, settingError } = useGetProcotoringSettings();


  // Check for microphone and camera access, otherwise redirect to dashboard
  useEffect(() => {
    if (!showProctorDialog) {
      async function checkMediaPermissions() {
        try {
          // Try to get both camera and microphone access
          await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err) {
          // If access denied or not available, redirect to dashboard
          alert("Please allow camera and microphone access to continue. You will be redirected to the dashboard if access is denied.");
          try {
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch (err) {
            router.navigate({ to: '/student' });
          }
        }
      }
      checkMediaPermissions();
    }
    // Only run on mount or when dialog is accepted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProctorDialog]);

  // Get the setCurrentCourse function from the store
  const { setCurrentCourse } = useCourseStore();

  // ✅ Add the missing ref declaration
  const itemContainerRef = useRef<ItemContainerRef>(null);

  // Ref for autoscroll to selected sidebar item
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

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
  const [isNavigatingToNext, setIsNavigatingToNext] = useState<boolean>(false);
  const [rewindVid, setRewindVid] = useState<boolean>(false);
  const [pauseVid, setPauseVid] = useState<boolean>(false);
  const [quizPassed, setQuizPassed] = useState(2);
  const [anomalies, setAnomalies] = useState<string[]>([]);

  // State to store all fetched section items
  const [sectionItems, setSectionItems] = useState<Record<string, itemref[]>>({});

  // Track which section to fetch items for
  const [activeSectionInfo, setActiveSectionInfo] = useState<{
    moduleId: string;
    sectionId: string;
  } | null>(null);

  // Fetch course version data
  const { data: courseVersionData, isLoading: versionLoading, error: versionError } =
    useCourseVersionById(VERSION_ID);

  // Fetch user progress
  const { data: progressData, isLoading: progressLoading, error: progressError } =
    useUserProgress(COURSE_ID, VERSION_ID);

  // Fetch proctoring settings for the course (fetched once when component loads)
  const [proctoringData, setProctoringData] = useState<StudentProctoringSettings | null>(null);

  const shouldFetchItems = Boolean(activeSectionInfo?.moduleId && activeSectionInfo?.sectionId);
  const sectionModuleId = activeSectionInfo?.moduleId ?? '';
  const sectionId = activeSectionInfo?.sectionId ?? '';

  const {
    data: currentSectionItems,
    isLoading: itemsLoading
  } = useItemsBySectionId(
    shouldFetchItems ? VERSION_ID : '',
    shouldFetchItems ? sectionModuleId : '6831b98e1f79c52d445c5db5',
    shouldFetchItems ? sectionId : '6831b98e1f79c52d445c5db6'
  )

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
  // State to track previous valid item for reverting
  const [previousValidItem, setPreviousValidItem] = useState<{
    moduleId: string;
    sectionId: string;
    itemId: string;
  } | null>(null);

  // Separate effect for handling item errors - prevents circular dependencies
  useEffect(() => {
    console.error('Current item error:', itemError);
    if (itemError === "Firebase ID token has expired. Get a fresh ID token from your client app and try again (auth/id-token-expired). See https://firebase.google.com/docs/auth/admin/verify-id-tokens for details on how to retrieve an ID token.") {
      logout();
      Navigate({ to: '/auth' });
      return;
    }

    if (itemError && selectedItemId) {
      // Clear loading state on error
      setIsNavigatingToNext(false);
      setIsItemForbidden(true);

      // Only revert if we have a previous valid item
      if (previousValidItem) {
        console.log('Access denied. Reverting to previous valid item:', previousValidItem);

        // Revert selection state immediately
        setSelectedModuleId(previousValidItem.moduleId);
        setSelectedSectionId(previousValidItem.sectionId);
        setSelectedItemId(previousValidItem.itemId);

        // Update course store navigation
        updateCourseNavigation(
          previousValidItem.moduleId,
          previousValidItem.sectionId,
          previousValidItem.itemId
        );
      }

      // Always clear error after a delay, regardless of whether we reverted
      const clearErrorTimeout = setTimeout(() => {
        setIsItemForbidden(false);
      }, 3000);

      return () => clearTimeout(clearErrorTimeout);
    }
  }, [itemError, selectedItemId, previousValidItem, updateCourseNavigation]);

  useEffect(() => {
    console.log('Current item data:', itemData);
  }, [itemData]);

  // Log proctoring settings when loaded (only logs once when data is available)
  useEffect(() => {
    async function fetch() {
      setProctoringData(await getSettings(COURSE_ID, VERSION_ID))
    }
    fetch();
  }, []);

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
  // console.log('Section items:', sectionItems);

  // Notification effects
  useEffect(() => {
    if (quizPassed !== 2) setTimeout(() => setQuizPassed(2), 5000);
  }, [quizPassed]);
  // Add a flag to track if initial load from progress is complete
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Effect to initialize based on user progress ONLY ON INITIAL LOAD
  useEffect(() => {
    if (progressData && !initialLoadComplete) {
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

      // Mark initial load as complete so it doesn't run again
      setInitialLoadComplete(true);
    }
  }, [progressData, updateCourseNavigation, initialLoadComplete]);

  // Effect to set current item when item data is fetched
  useEffect(() => {
    if (itemData && !itemLoading) {
      // Handle the different possible response structures
      const item = (itemData as any)?.item || itemData;
      if (item && typeof item === 'object' && item._id) {
        setCurrentItem(item);
        // Clear loading state when new item is successfully loaded
        setIsNavigatingToNext(false);
      }
    }
  }, [itemData, itemLoading]);

  // Handle item selection
  // Handle item selection - simplified and more robust
  const handleSelectItem = (moduleId: string, sectionId: string, itemId: string) => {
    // Set loading state when changing items from sidebar - same as with Next button
    setIsNavigatingToNext(true);

    // Stop current item before switching - make this more robust
    if (itemContainerRef.current) {
      console.log('Stopping current item before switching');
      itemContainerRef.current.stopCurrentItem();

      // Add a small delay to ensure cleanup completes
      setTimeout(() => {
        // Store current valid item before switching (only if not in error state)
        if (selectedItemId && selectedSectionId && selectedModuleId && !isItemForbidden) {
          setPreviousValidItem({
            moduleId: selectedModuleId,
            sectionId: selectedSectionId,
            itemId: selectedItemId
          });
        }

        // Always clear any existing item errors when manually selecting an item
        setIsItemForbidden(false);

        // Attempt the switch
        setSelectedModuleId(moduleId);
        setSelectedSectionId(sectionId);
        setSelectedItemId(itemId);

        // Ensure section items are loaded if not already
        if (!sectionItems[sectionId]) {
          setActiveSectionInfo({
            moduleId,
            sectionId
          });
        }

        // Expand the module and section automatically
        setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
        setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

        // Update the course store with the new navigation state
        updateCourseNavigation(moduleId, sectionId, itemId);
      }, 50); // Small delay to ensure cleanup completes
    } else {
      // Set loading state even without a ref
      setIsNavigatingToNext(true);

      // Store current valid item before switching (only if not in error state)
      if (selectedItemId && selectedSectionId && selectedModuleId && !isItemForbidden) {
        setPreviousValidItem({
          moduleId: selectedModuleId,
          sectionId: selectedSectionId,
          itemId: selectedItemId
        });
      }

      // Always clear any existing item errors when manually selecting an item
      setIsItemForbidden(false);

      // Attempt the switch
      setSelectedModuleId(moduleId);
      setSelectedSectionId(sectionId);
      setSelectedItemId(itemId);

      // Ensure section items are loaded if not already
      if (!sectionItems[sectionId]) {
        setActiveSectionInfo({
          moduleId,
          sectionId
        });
      }

      // Expand the module and section automatically
      setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
      setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

      // Update the course store with the new navigation state
      updateCourseNavigation(moduleId, sectionId, itemId);
    }
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

  // Helper function to find the next item in the course structure
  const findNextItem = useCallback(() => {
    if (!courseVersionData || !selectedModuleId || !selectedSectionId || !selectedItemId) {
      return null;
    }

    const modules = (courseVersionData as any)?.modules || [];

    // Find current module index
    const currentModuleIndex = modules.findIndex((m: any) => m.moduleId === selectedModuleId);
    if (currentModuleIndex === -1) return null;

    const currentModule = modules[currentModuleIndex];
    const sections = currentModule.sections || [];

    // Find current section index
    const currentSectionIndex = sections.findIndex((s: any) => s.sectionId === selectedSectionId);
    if (currentSectionIndex === -1) return null;

    const currentSectionItems = sectionItems[selectedSectionId] || [];

    // Find current item index
    const currentItemIndex = currentSectionItems.findIndex((item: any) => item._id === selectedItemId);
    if (currentItemIndex === -1) return null;

    // Try to get next item in current section
    if (currentItemIndex < currentSectionItems.length - 1) {
      const nextItem = currentSectionItems[currentItemIndex + 1];
      return {
        moduleId: selectedModuleId,
        sectionId: selectedSectionId,
        itemId: nextItem._id
      };
    }

    // Try to get first item of next section in current module
    if (currentSectionIndex < sections.length - 1) {
      const nextSection = sections[currentSectionIndex + 1];
      const nextSectionItems = sectionItems[nextSection.sectionId];
      if (nextSectionItems && nextSectionItems.length > 0) {
        return {
          moduleId: selectedModuleId,
          sectionId: nextSection.sectionId,
          itemId: nextSectionItems[0]._id
        };
      }
    }

    // Try to get first item of first section in next module
    if (currentModuleIndex < modules.length - 1) {
      const nextModule = modules[currentModuleIndex + 1];
      const nextModuleSections = nextModule.sections || [];
      if (nextModuleSections.length > 0) {
        const firstNextSection = nextModuleSections[0];
        const nextModuleItems = sectionItems[firstNextSection.sectionId];
        if (nextModuleItems && nextModuleItems.length > 0) {
          return {
            moduleId: nextModule.moduleId,
            sectionId: firstNextSection.sectionId,
            itemId: nextModuleItems[0]._id
          };
        }
      }
    }

    // No next item found
    return null;
  }, [courseVersionData, selectedModuleId, selectedSectionId, selectedItemId, sectionItems]);

  const handleNext = useCallback(async () => {
    // Set loading state
    setIsNavigatingToNext(true);

    try {
      // Stop current item before moving to next with proper cleanup
      if (itemContainerRef.current) {
        itemContainerRef.current.stopCurrentItem();

        // Allow a small delay for cleanup
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Find and navigate to the actual next item
      const nextItem = findNextItem();

      if (!nextItem) {
        console.log('No next item found - course completed!');

        // Clear loading state
        setIsNavigatingToNext(false);

        // Trigger confetti celebration
        const end = Date.now() + 3 * 1000; // 3 seconds
        const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

        const frame = () => {
          if (Date.now() > end) return;

          confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            startVelocity: 60,
            origin: { x: 0, y: 0.5 },
            colors: colors,
          });
          confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            startVelocity: 60,
            origin: { x: 1, y: 0.5 },
            colors: colors,
          });

          requestAnimationFrame(frame);
        };

        frame();

        // Redirect to dashboard after celebration
        setTimeout(() => {
          router.navigate({ to: '/student' });
        }, 3500);

        return;
      }

      const { moduleId, sectionId, itemId } = nextItem;

      // Ensure all values are defined before switching
      if (!moduleId || !sectionId || !itemId) {
        console.log('Invalid next item data');
        return;
      }

      // Store current valid item before switching
      if (selectedItemId && selectedSectionId && selectedModuleId) {
        setPreviousValidItem({
          moduleId: selectedModuleId,
          sectionId: selectedSectionId,
          itemId: selectedItemId
        });
      }

      // Clear any existing item errors to ensure navigation works
      setIsItemForbidden(false);

      // Update local state immediately to the NEXT item
      setSelectedModuleId(moduleId);
      setSelectedSectionId(sectionId);
      setSelectedItemId(itemId);

      // Auto-expand the module and section
      setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
      setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

      // Set active section to fetch items if not already loaded
      if (!sectionItems[sectionId]) {
        setActiveSectionInfo({
          moduleId,
          sectionId
        });
      }

      // Update the course store with the next item
      updateCourseNavigation(moduleId, sectionId, itemId);
    } catch (error) {
      console.error('Error navigating to next item:', error);
      // Clear loading state on error
      setIsNavigatingToNext(false);
    }
  }, [
    findNextItem,
    selectedModuleId,
    selectedSectionId,
    selectedItemId,
    sectionItems,
    updateCourseNavigation,
    router
  ]);

  // Helper function to find the last video item before the current item
  const findPreviousVideoItem = useCallback(() => {
    if (!courseVersionData || !selectedModuleId || !selectedSectionId || !selectedItemId) {
      return null;
    }

    const modules = (courseVersionData as any)?.modules || [];

    // Find current module index
    const currentModuleIndex = modules.findIndex((m: any) => m.moduleId === selectedModuleId);
    if (currentModuleIndex === -1) return null;

    const currentModule = modules[currentModuleIndex];
    const sections = currentModule.sections || [];

    // Find current section index
    const currentSectionIndex = sections.findIndex((s: any) => s.sectionId === selectedSectionId);
    if (currentSectionIndex === -1) return null;

    const currentSectionItems = sectionItems[selectedSectionId] || [];

    // Find current item index
    const currentItemIndex = currentSectionItems.findIndex((item: any) => item._id === selectedItemId);
    if (currentItemIndex === -1) return null;

    // Search backwards through current section for video items
    for (let i = currentItemIndex - 1; i >= 0; i--) {
      const item = currentSectionItems[i];
      if (item.type && item.type.toLowerCase() === 'video') {
        return {
          moduleId: selectedModuleId,
          sectionId: selectedSectionId,
          itemId: item._id
        };
      }
    }

    // Search backwards through previous sections in current module
    for (let sectionIdx = currentSectionIndex - 1; sectionIdx >= 0; sectionIdx--) {
      const section = sections[sectionIdx];
      const sectionItemsArray = sectionItems[section.sectionId] || [];

      // Search from end of section backwards
      for (let i = sectionItemsArray.length - 1; i >= 0; i--) {
        const item = sectionItemsArray[i];
        if (item.type && item.type.toLowerCase() === 'video') {
          return {
            moduleId: selectedModuleId,
            sectionId: section.sectionId,
            itemId: item._id
          };
        }
      }
    }

    // Search backwards through previous modules
    for (let moduleIdx = currentModuleIndex - 1; moduleIdx >= 0; moduleIdx--) {
      const module = modules[moduleIdx];
      const moduleSections = module.sections || [];

      // Search from end of module backwards
      for (let sectionIdx = moduleSections.length - 1; sectionIdx >= 0; sectionIdx--) {
        const section = moduleSections[sectionIdx];
        const sectionItemsArray = sectionItems[section.sectionId] || [];

        // Search from end of section backwards
        for (let i = sectionItemsArray.length - 1; i >= 0; i--) {
          const item = sectionItemsArray[i];
          if (item.type && item.type.toLowerCase() === 'video') {
            return {
              moduleId: module.moduleId,
              sectionId: section.sectionId,
              itemId: item._id
            };
          }
        }
      }
    }

    // No previous video item found
    return null;
  }, [courseVersionData, selectedModuleId, selectedSectionId, selectedItemId, sectionItems]);

  // Handle navigation to previous video (used by quiz component)
  const handlePrevVideo = useCallback(async () => {
    // Set loading state
    setIsNavigatingToNext(true);

    try {
      // Stop current item before moving to previous video with proper cleanup
      if (itemContainerRef.current) {
        itemContainerRef.current.stopCurrentItem();

        // Allow a small delay for cleanup
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Find the previous video item
      const prevVideoItem = findPreviousVideoItem();

      if (!prevVideoItem) {
        console.log('No previous video item found');
        setIsNavigatingToNext(false);
        return;
      }

      const { moduleId, sectionId, itemId } = prevVideoItem;

      // Ensure all values are defined before switching
      if (!moduleId || !sectionId || !itemId) {
        console.log('Invalid previous video item data');
        setIsNavigatingToNext(false);
        return;
      }

      // Store current valid item before switching
      if (selectedItemId && selectedSectionId && selectedModuleId) {
        setPreviousValidItem({
          moduleId: selectedModuleId,
          sectionId: selectedSectionId,
          itemId: selectedItemId
        });
      }

      // Clear any existing item errors to ensure navigation works
      setIsItemForbidden(false);

      // Update local state immediately to the previous video item
      setSelectedModuleId(moduleId);
      setSelectedSectionId(sectionId);
      setSelectedItemId(itemId);

      // Auto-expand the module and section
      setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
      setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

      // Set active section to fetch items if not already loaded
      if (!sectionItems[sectionId]) {
        setActiveSectionInfo({
          moduleId,
          sectionId
        });
      }

      // Update the course store with the previous video item
      updateCourseNavigation(moduleId, sectionId, itemId);
    } catch (error) {
      console.error('Error navigating to previous video:', error);
      // Clear loading state on error
      setIsNavigatingToNext(false);
    }
  }, [
    findPreviousVideoItem,
    selectedModuleId,
    selectedSectionId,
    selectedItemId,
    sectionItems,
    updateCourseNavigation
  ]);

  // Handle going back to courses
  const handleGoBack = () => {
    // Stop current item before navigating away
    if (itemContainerRef.current) {
      itemContainerRef.current.stopCurrentItem();
    }
    // Navigate back to courses page
    window.history.back();
  };

  // Autoscroll to selected sidebar item when selectedItemId changes
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedItemId]);

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

  // Show proctoring declaration dialog before requesting permissions
  // Render the dialog overlay above the main content, not as a return branch

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
            <Button asChild className="mt-4">
              <Link to="/student">Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const modules = (courseVersionData as any)?.modules || [];

  return (
    <>
      <Dialog open={showProctorDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Declaration</DialogTitle>
          </DialogHeader>
          <ul className="text-base text-foreground mb-4 list-disc pl-6 space-y-2">
            <li>
              I understand that my camera and microphone will be used for proctoring during this exam.
            </li>
            <li>
              I agree that images from my webcam may be captured at various points if unusual activity is detected.
            </li>
            <li>
              I acknowledge that the microphone is used for monitoring purposes only, and that no audio or video will be recorded or stored elsewhere.
            </li>
          </ul>
          <div className="w-full flex justify-end">
            <Button onClick={() => { setShowProctorDialog(false) }} className="w-full">ACCEPT</Button>
          </div>
        </DialogContent>
      </Dialog>
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-screen w-full">
          {/* Enhanced Course Navigation Sidebar */}
          <Sidebar variant="inset" className="border-r border-border/40 bg-sidebar/50 backdrop-blur-sm">
            <SidebarHeader className="border-b border-border/40 bg-gradient-to-b from-sidebar/80 to-sidebar/60">
              {/* Vibe Logo and Brand */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg overflow-hidden">
                  <img
                    src="https://continuousactivelearning.github.io/vibe/img/logo.png"
                    alt="Vibe Logo"
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[1.15rem] font-bold leading-none">
                    <AuroraText colors={["#A07CFE", "#FE8FB5", "#FFBE7B"]}><b>ViBe</b></AuroraText>
                  </span>
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
                            <div className="text-[10px] text-muted-fore</div>ground truncate">
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
                                          if (item.type === 'QUIZ') return null; // Skip quizzes in sidebar
                                          return (
                                            <SidebarMenuSubItem key={itemId}>
                                              <SidebarMenuSubButton
                                                onClick={() => handleSelectItem(moduleId, sectionId, itemId)}
                                                isActive={isCurrentItem}
                                                className="group relative h-8 px-3 w-full rounded-md transition-all duration-200 hover:bg-accent/10 data-[state=active]:bg-primary/10 data-[state=active]:text-primary justify-start"
                                                // Assign ref only to the selected item for autoscroll
                                                ref={isCurrentItem ? selectedItemRef : undefined}
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
                                                      {(() => {
                                                        // Find all non-QUIZ items in this section, sorted by order
                                                        const itemsInSection = sortItemsByOrder(sectionItems[sectionId] || []).filter((i: any) => i.type !== 'QUIZ');
                                                        // Find the index of this item among non-QUIZ items
                                                        const itemIndex = itemsInSection.findIndex((i: any) => i._id === itemId);
                                                        // Compose the label with numbering
                                                        let label = '';
                                                        if (selectedItemId === itemId && itemLoading) {
                                                          label = 'Loading...';
                                                        } else if (selectedItemId === itemId && currentItem?.name) {
                                                          label = currentItem.name.length > 18 ? `${currentItem.name.substring(0, 15)}...` : currentItem.name;
                                                        } else {
                                                          label = ' ';
                                                        }
                                                        // Add numbering prefix (e.g., Video 1, Article 2, etc.)
                                                        const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase();
                                                        return label === ' ' ? `${typeLabel} ${itemIndex + 1}` : `${label}`;
                                                      })()}
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
              <FloatingVideo
                isVisible={true}
                onClose={() => { }}
                onAnomalyDetected={() => { }}
                setDoGesture={setDoGesture}
                settings={proctoringData || {
                  _id: "",
                  studentId: "",
                  versionId: "",
                  courseId: "",
                  settings: {
                    proctors: {
                      detectors: []
                    }
                  }
                }}
                anomalies={anomalies}
                setAnomalies={setAnomalies}
                rewindVid={rewindVid}
                setRewindVid={setRewindVid}
                pauseVid={pauseVid}
                setPauseVid={setPauseVid}
              />
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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="relative h-10 w-10 p-0 mr-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
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

              {/* Notification Stack */}
              <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 w-90">
                {/* ✅ Item Access Error Notification */}
                {isItemForbidden && (
                  <Card className="border border-red-400/40 bg-red-600/95 text-red-50 shadow-lg backdrop-blur-md animate-in slide-in-from-right-3 duration-300">
                    <CardContent className="flex items-center gap-3 px-4 py-0">
                      <div className="flex h-22 w-22 items-center justify-center rounded-l border-red-50/30 bg-red-50/10 text-4xl p-4">
                        <AlertCircle className="h-16 w-16" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Badge variant="outline" className="border-red-50/30 bg-red-50/10 text-red-50 text-lg font-bold">
                          Access Restricted
                        </Badge>
                        <p className="text-md font-medium leading-relaxed">
                          {previousValidItem
                            ? "Returning to previous valid content."
                            : "Complete current item first to access this content."
                          }
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsItemForbidden(false)}
                        className="h-6 w-6 p-0 text-red-50 hover:bg-red-50/10"
                      >
                        ×
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Gesture Notification */}
                {doGesture && currentItem?.type !== 'VIDEO' && (
                  <Card className="border border-amber-400/20 bg-amber-600/90 text-amber-50 shadow-lg backdrop-blur-md animate-in slide-in-from-right-3 duration-300">
                    <CardContent className="flex items-center gap-3 px-4 py-0">
                      <div className="flex h-22 w-22 items-center justify-center rounded-lg bg-white text-4xl p-4">
                        <img src="https://em-content.zobj.net/source/microsoft/309/thumbs-up_1f44d.png" className="w-auto h-full" />
                      </div>
                      <div className="flex-1 space-y-1 py-3">
                        <Badge variant="outline" className="border-amber-50/30 bg-amber-50/10 text-amber-50 text-xl font-bold">
                          Gesture Required
                        </Badge>
                        <p className="text-lg font-medium leading-relaxed m-1">
                          Show a <strong>thumbs up</strong>!
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quiz Passed/Failed */}
                {quizPassed !== 2 && (
                  <Card className={`border shadow-lg backdrop-blur-md animate-in slide-in-from-right-3 duration-300 ${quizPassed === 1
                    ? "border-green-400/40 bg-green-500/95 text-green-50"
                    : "border-red-400/40 bg-red-500/95 text-red-50"
                    }`}>
                    <CardContent className="flex items-center gap-3 px-4 py-0">
                      <div className={`flex h-22 w-22 items-center justify-center rounded-l ${quizPassed === 1
                        ? "border-green-50/30 bg-green-50/10"
                        : "border-red-50/30 bg-red-50/10"
                        } text-4xl p-4`}>
                        {quizPassed === 1 ? (
                          <CheckCircle className="h-16 w-16" />
                        ) : (
                          // Use XCircle for fail/cross icon
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                            <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <Badge variant="outline" className={`text-lg font-bold ${quizPassed === 1
                          ? "border-green-50/30 bg-green-50/10 text-green-50"
                          : "border-red-50/30 bg-red-50/10 text-red-50"
                          }`}>
                          {quizPassed === 1 ? "Quiz Passed" : "Quiz Failed"}
                        </Badge>
                        <p className="text-md font-medium leading-relaxed">
                          {quizPassed === 1
                            ? "Congratulations! You passed the quiz."
                            : "Redirecting to the previous video..."}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuizPassed(2)}
                        className={`h-6 w-6 p-0 ${quizPassed === 1
                          ? "text-green-50 hover:bg-green-50/10"
                          : "text-red-50 hover:bg-red-50/10"
                          }`}
                      >
                        ×
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {currentItem ? (
                <div className="relative z-10 h-full">
                  <ItemContainer
                    ref={itemContainerRef}
                    item={currentItem}
                    doGesture={doGesture}
                    onNext={handleNext}
                    onPrevVideo={handlePrevVideo}
                    isProgressUpdating={isNavigatingToNext}
                    attemptId={attemptId || undefined}
                    setAttemptId={setAttemptId}
                    rewindVid={rewindVid}
                    pauseVid={pauseVid}
                    displayNextLesson={false}
                    setQuizPassed={setQuizPassed}
                    anomalies={anomalies}
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
                    <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
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
    </>
  );
};