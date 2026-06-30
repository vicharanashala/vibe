import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCourseVersionById, useUserProgress, useItemsBySectionId, useItemById, useGetProcotoringSettings, useSubmitFlag, enqueueNavigation, useSkipOptionalItem, useRecalculateStudentProgress, useInvites, useAcceptInvite } from "@/hooks/hooks";
import { useAuthStore } from "@/store/auth-store";
import { useCourseStore } from "@/store/course-store";
import { Link, Navigate, useRouter } from "@tanstack/react-router";
import StudentProjectItem from "./components/StudentProjectItem";
const LazyStudentTimeslotModal = lazy(() => import("@/components/course/StudentTimeslotModal"));
import type { Item, ItemContainerRef } from "@/types/item-container.types";
import type { PendingStudentQuestionContext } from "@/types/student-question.types";
import { Skeleton } from "@/components/ui/skeleton";
import confetti from "canvas-confetti";
import {
  ChevronRight,
  BookOpen,
  Target,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  CircleCheckIcon,
} from "lucide-react";
import FloatingVideo from "@/components/floating-video";
import type { itemref } from "@/types/course.types";
import { logout } from "@/utils/auth";
import { StudentProctoringSettings } from "@/types/video.types";
import { FlagModal } from "@/components/FlagModal";
import { EntityType } from "@/types/flag.types";
import { toast } from "sonner";
import ItemContainer from "@/components/Item-container";
import { registerStream, unRegisterStream } from "@/lib/MediaRegistry";
import { useModuleProgress } from "@/hooks/hooks";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileFallbackScreen from "@/components/MobileFallbackScreen";
import { EmotionType } from "@/components/EmotionSelector";
import { useSubmitEmotion } from "@/hooks/use-emotion";

import { runProctoringChecks } from "@/utils/proctoring/proctoringGuard";
import { EthicsConsentModal } from "./components/policies/EthicsConsentModal";
import { useGetEthicsConsent } from "@/hooks/system-notification-hooks";
// Focused learn-page UI
import { FloatingBackButton } from "@/components/learn/FloatingBackButton";
import { FloatingCameraButton } from "@/components/learn/FloatingCameraButton";
import { AiCompanion } from "@/components/learn/AiCompanion";
import { AiActionSheet } from "@/components/learn/AiActionSheet";
import { InitialWebcamPopup } from "@/components/learn/InitialWebcamPopup";
import { ProctorAlertOverlay } from "@/components/learn/ProctorAlertOverlay";
import { NoiseIndicator } from "@/components/learn/NoiseIndicator";
import { AwayOverlay } from "@/components/learn/AwayOverlay";
import { CourseDrawer } from "@/components/learn/CourseDrawer";

// Proctoring anomalies that should block the video and surface the buttonless
// alert (with webcam) — covers "no person" (noFace) and "more than one person".
const BLOCKING_ANOMALIES = ["noFace", "faceCountDetection", "multipleFaces", "faceRecognition"];

// Helper function to sort items by order property
const sortItemsByOrder = (items: any[]) => {
  return [...items].sort((a, b) => {
    const orderA = a.order || '';
    const orderB = b.order || '';
    return orderA.localeCompare(orderB);
  });
};


export default function CoursePage() {
  useEffect(() => {
    return () => {
      unRegisterStream("course-page-stream");
      unRegisterStream("course-page-retrystream");
    };
  }, []);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  // Dialog state for proctoring declaration
  const [showProctorDialog, setShowProctorDialog] = useState(true);
  const { user } = useAuthStore();
  const router = useRouter();
  const currentCourse = useCourseStore((state) => state.currentCourse);
  const COURSE_ID = currentCourse?.courseId || "";
  const VERSION_ID = currentCourse?.versionId || "";
  const COHORT_ID = currentCourse?.cohortId || "";
  const COHORT_NAME = currentCourse?.cohortName || "";
  // Ethics consent gate: must be signed once per course before entering content
  const { signed: ethicsConsentSigned, isLoading: ethicsConsentLoading } =
    useGetEthicsConsent(COURSE_ID, VERSION_ID);
  const [ethicsConsentSignedLocal, setEthicsConsentSignedLocal] = useState(false);
  const consentSatisfied = ethicsConsentSigned || ethicsConsentSignedLocal;
  const { getSettings, settingLoading: proctoringLoading } = useGetProcotoringSettings();

  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [isFlagSubmitted, setIsFlagSubmitted] = useState(false);
  const [isSkippingItem, setIsSkippingItem] = useState(false);
  const [courseJustCompleted, setCourseJustCompleted] = useState(false);
  // Follow-up invite unlocked by completing this course (shown as a claim card).
  const [followUpInvite, setFollowUpInvite] = useState<any | null>(null);
  const { getInvites: getPendingInvites } = useInvites();
  const { acceptInvite: acceptFollowUpInvite } = useAcceptInvite();
  const { mutateAsync: submitFlagAsyncMutate, isPending } = useSubmitFlag();
  const { mutateAsync: skipItemAsync, isPending: isSkipping } = useSkipOptionalItem();
  const { mutateAsync: recalculateStudentProgressAsync } = useRecalculateStudentProgress();
  const [allProctorsDisabled, setAllProctorsDisabled] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Emotion tracking state
  const [selectedEmotion, setSelectedEmotion] = useState<{ [key: string]: EmotionType }>({});
  const { mutateAsync: submitEmotionAsync } = useSubmitEmotion();

  const isMobile = useIsMobile();


  // Check for microphone and camera access, otherwise redirect to dashboard
  useEffect(() => {
    async function checkMediaPermissions() {
      try {
        // Try to get both camera and microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // Proctoring check: block virtual camera usage at session start
        // This ensures user cannot enter course with spoofed camera
        const violations = await runProctoringChecks(stream);

        if (violations.length > 0) {
          stream.getTracks().forEach(t => t.stop());

          alert(violations[0].reason);

          router.navigate({ to: "/student" });
          return;
        }
        
        unRegisterStream("course-page-stream");
        registerStream("course-page-stream", stream);
        streamRef.current = stream;
      } catch (err) {
        alert("Please allow camera and microphone access to continue. You will be redirected to the dashboard if access is denied.");
        try {
          const retryStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const violations = await runProctoringChecks(retryStream);
          
          if (violations.length > 0) {
          retryStream.getTracks().forEach(t => t.stop());

          alert(violations[0].reason);

          router.navigate({ to: "/student" });
          return;
        }
          
          unRegisterStream("course-page-retrystream");
          registerStream("course-page-retrystream", retryStream);
          streamRef.current = retryStream;
        } catch (err) {
          router.navigate({ to: '/student' });
        }
      }
    }
    if (consentSatisfied && !showProctorDialog && !allProctorsDisabled) {
      checkMediaPermissions();
    }
    return () => {
      // Clean up media tracks on unmount or navigation
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProctorDialog, consentSatisfied]);

  // Get the setCurrentCourse function from the store
  const { setCurrentCourse } = useCourseStore();

  // ✅ Add the missing ref declaration
  const itemContainerRef = useRef<ItemContainerRef>(null);
  const navInFlightRef = useRef(false);

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
        itemId,
        cohortId: COHORT_ID,
        cohortName: COHORT_NAME,
        watchItemId: null
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
  // Time-slot / commitment gate block (distinct from linear-progression ForbiddenError).
  const [timeSlotBlock, setTimeSlotBlock] = useState<string | null>(null);
  const [showTimeslotPicker, setShowTimeslotPicker] = useState<boolean>(false);
  const [isNavigatingToNext, setIsNavigatingToNext] = useState<boolean>(false);
  const [rewindVid, setRewindVid] = useState<boolean>(false);
  const [pauseVid, setPauseVid] = useState<boolean>(false);
  const [quizPassed, setQuizPassed] = useState(2);
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [isQuizSkipped, setIsQuizSkipped] = useState(false);
  const [readyToDetect, setReadyToDetect] = useState(false);

  // --- Focused learn-page UI state ---
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiSheet, setAiSheet] = useState<"chat" | "talk" | "discussion" | null>(null);
  const [camPinned, setCamPinned] = useState(false);
  const [camHover, setCamHover] = useState(false);
  const [pauseSignal, setPauseSignal] = useState(0);
  // Cursor stepped off the page → pause; auto-resumes on return (handled in the player).
  const [awayPaused, setAwayPaused] = useState(false);
  // Pause the lesson video imperatively (without the anomaly overlay) whenever a
  // floating control is used.
  const pauseVideoForControl = useCallback(() => setPauseSignal((n) => n + 1), []);

  // Debounced "blocking anomaly" (no person / multiple people / identity / etc.).
  // Face detection is noisy, so require the anomaly to persist briefly before we
  // block + show the alert; clear instantly when it resolves to avoid flicker.
  const [blockingActive, setBlockingActive] = useState(false);
  // Anomaly alert is held on screen for a minimum duration once shown (no flashes).
  const [alertVisible, setAlertVisible] = useState(false);
  const alertShownAtRef = useRef(0);
  const rawBlocking =
    !showProctorDialog &&
    !allProctorsDisabled &&
    (anomalies || []).some((a) => BLOCKING_ANOMALIES.includes(a));
  useEffect(() => {
    if (rawBlocking) {
      const t = setTimeout(() => setBlockingActive(true), 400);
      return () => clearTimeout(t);
    }
    setBlockingActive(false);
  }, [rawBlocking]);
  const [isNavigatingToPrev, setIsNavigatingToPrev] = useState<boolean>(false);
  const [pendingStudentQuestionContext, setPendingStudentQuestionContext] = useState<PendingStudentQuestionContext | null>(null);
  const completedItemIdsRef = useRef<Set<string>>(new Set());

  const [isGoingToNext, setIsGoingToNext] = useState(false);


  // State to track when we're waiting for next section items to load
  const [waitingForNextSection, setWaitingForNextSection] = useState<{
    moduleId: string;
    sectionId: string;
  } | null>(null);


  // State to store all fetched section items
  const [sectionItems, setSectionItems] = useState<Record<string, itemref[]>>({});

  // Track which section to fetch items for
  const [activeSectionInfo, setActiveSectionInfo] = useState<{
    moduleId: string;
    sectionId: string;
  } | null>(null);

  // Fetch course version data
  const { data: courseVersionData, isLoading: versionLoading, error: versionError, refetch: refetchVersion } =
    useCourseVersionById(VERSION_ID, undefined, COHORT_ID);

  const shouldRandomize = courseVersionData?.shouldRandomize || false;

    // Fetch user progress
  const { data: progressData, isLoading: progressLoading, error: progressError } =
    useUserProgress(COURSE_ID, VERSION_ID, COHORT_ID);
  const { data: moduleProgressData, isLoading: moduleProgressLoading } =
    useModuleProgress(COURSE_ID, VERSION_ID, COHORT_ID);


  // Fetch proctoring settings for the course (fetched once when component loads)
  const [proctoringData, setProctoringData] = useState<StudentProctoringSettings | null>(null);


  
  const sectionId = activeSectionInfo?.sectionId ?? '';

  // ---------------------------------------------
  // SECTION ITEM FETCH (ONCE PER SECTION)
  // ---------------------------------------------
  const hasSectionItems =
    !!activeSectionInfo?.sectionId &&
    !!sectionItems[activeSectionInfo.sectionId];

  const shouldFetchItems =
    !!activeSectionInfo?.moduleId &&
    !!activeSectionInfo?.sectionId &&
    !hasSectionItems;

  const {
    data: currentSectionItems,
    isLoading: itemsLoading,
  } = useItemsBySectionId(
    shouldFetchItems ? VERSION_ID : '',
    shouldFetchItems ? activeSectionInfo!.moduleId : '',
    shouldFetchItems ? activeSectionInfo!.sectionId : '',
    shouldFetchItems ? COHORT_ID : ''
  );


  // Fetch individual item details when an item is selected
  // Don't fetch during navigation to prevent race condition with stopItem
  // Bind the item fetch to the IDs that actually identify the selected item.
  // activeSectionInfo drifts when the user expands another section in the sidebar
  // (toggleSection) — using it here sent mismatched (moduleId, sectionId, itemId)
  // triples that made the backend's previous-item check fail with ForbiddenError.
  const shouldFetchItem = Boolean(
    selectedItemId && selectedModuleId && selectedSectionId && COURSE_ID && VERSION_ID && !isNavigatingToNext
  );
  const {
    data: itemData,
    isLoading: itemLoading,
    error: itemError,
    errorName: itemErrorName
  } = useItemById(
    shouldFetchItem ? COURSE_ID : '',
    shouldFetchItem ? VERSION_ID : '',
    shouldFetchItem ? selectedItemId! : '',
    shouldFetchItem ? selectedModuleId! : '',
    shouldFetchItem ? selectedSectionId! : '',
    shouldFetchItem ? COHORT_ID : ''
  );
  // State to track previous valid item for reverting
  const [previousValidItem, setPreviousValidItem] = useState<{
    moduleId: string;
    sectionId: string;
    itemId: string;
  } | null>(null);

  // ---------------------------------------------
  // SAFE SECTION ACTIVATION (PREVENT RE-FETCH)
  // ---------------------------------------------
  const safeSetActiveSection = useCallback(
    (moduleId: string, sectionId: string) => {
      setActiveSectionInfo(prev => {
        if (
          prev?.moduleId === moduleId &&
          prev?.sectionId === sectionId
        ) {
          return prev; // 🚫 no state change → no refetch
        }
        return { moduleId, sectionId };
      });
    },
    []
  );



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Tab") return;
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (
      shouldFetchItems &&
      activeSectionInfo?.sectionId &&
      currentSectionItems &&
      !itemsLoading
    ) {
      // The backend returns items directly as an array, not wrapped in an object
      let itemsArray = [];

      if (Array.isArray(currentSectionItems)) {
        itemsArray = currentSectionItems;
      } else if ((currentSectionItems as any)?.items) {
        itemsArray = (currentSectionItems as any).items;
      } else {
        // Fallback: treat as direct response
        itemsArray = currentSectionItems;
      }

      setSectionItems(prev => ({
        ...prev,
        [activeSectionInfo.sectionId]: shouldRandomize? itemsArray : sortItemsByOrder(itemsArray),
      }));
    }
  }, [
    currentSectionItems,
    itemsLoading,
    shouldFetchItems,
    activeSectionInfo
  ]);


  // Separate effect for handling item errors - prevents circular dependencies
  useEffect(() => {
    if (!itemError) return;
    console.error('Current item error:', itemError);
    // if (itemError === "Firebase ID token has expired. Get a fresh ID token from your client app and try again (auth/id-token-expired). See https://firebase.google.com/docs/auth/admin/verify-id-tokens for details on how to retrieve an ID token.")
    if (itemError.includes("auth/id-token-expired")) {
      logout();
      Navigate({ to: '/auth' });
      return;
    }

    if (itemError && selectedItemId && itemErrorName === "ForbiddenError") {

      // toast.error(itemError);
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

        // Ensure section items are loaded for the previous valid item
        if (!sectionItems[previousValidItem.sectionId]) {
          setActiveSectionInfo({
            moduleId: previousValidItem.moduleId,
            sectionId: previousValidItem.sectionId
          });
        }

        // Update course store navigation
        updateCourseNavigation(
          previousValidItem.moduleId,
          previousValidItem.sectionId,
          previousValidItem.itemId
        );
      } else {
        setIsNavigatingToNext(false);
      }

      // Always clear error after a delay, regardless of whether we reverted
      const clearErrorTimeout = setTimeout(() => {
        setIsItemForbidden(false);
      }, 3000);

      return () => clearTimeout(clearErrorTimeout);
    }
  }, [itemError, selectedItemId, previousValidItem, updateCourseNavigation]);

  useEffect(() => {
  }, [itemData]);

  // Log proctoring settings when loaded (only logs once when data is available)
  useEffect(() => {
    async function fetch() {
      const data = await getSettings(COURSE_ID, VERSION_ID);
      setProctoringData(data);
      const allProctorsDisabled =
        data.settings.proctors.detectors.every(
          (detector: any) => detector.settings.enabled === false
        );
      if (allProctorsDisabled) {
        setShowProctorDialog(false);
        setAllProctorsDisabled(true);
        setReadyToDetect(true);
      }
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
      const sortedItems = shouldRandomize? itemsArray : sortItemsByOrder(itemsArray);
      setSectionItems(prev => ({
        ...prev,
        [activeSectionInfo.sectionId]: sortedItems
      }));
    }
  }, [currentSectionItems, itemsLoading, activeSectionInfo, shouldFetchItems]);
  // console.log('Section items:', sectionItems);

  // Handle navigation to next section after items are loaded
  useEffect(() => {
    if (waitingForNextSection &&
      sectionItems[waitingForNextSection.sectionId] &&
      sectionItems[waitingForNextSection.sectionId].length > 0) {

      const firstItem = sectionItems[waitingForNextSection.sectionId][0];

      // If the first item of the newly-loaded section isn't a quiz, drop any
      // pending pre-quiz prompt that was tentatively set before this section
      // finished loading.
      if (firstItem?.type?.toLowerCase() !== 'quiz') {
        setPendingStudentQuestionContext(null);
      }

      // Clear waiting state
      setWaitingForNextSection(null);

      // Navigate to the first item of the newly loaded section
      setSelectedModuleId(waitingForNextSection.moduleId);
      setSelectedSectionId(waitingForNextSection.sectionId);
      setSelectedItemId(firstItem._id);

      // Auto-expand the module and section
      setExpandedModules(prev => ({ ...prev, [waitingForNextSection.moduleId]: true }));
      setExpandedSections(prev => ({ ...prev, [waitingForNextSection.sectionId]: true }));

      // Update course store navigation
      updateCourseNavigation(waitingForNextSection.moduleId, waitingForNextSection.sectionId, firstItem._id);

      // Clear loading state
      setIsNavigatingToNext(false);

    }
  }, [sectionItems, waitingForNextSection, updateCourseNavigation]);

  // Notification effects
  useEffect(() => {
    if (quizPassed !== 2) setTimeout(() => setQuizPassed(2), 2000);
  }, [quizPassed]);
  // Add a flag to track if initial load from progress is complete
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Track the last known progress data to detect resets
  const [lastProgressData, setLastProgressData] = useState<any>(null);

  // Effect to detect progress reset and clear cached data
  useEffect(() => {
    if (progressData && lastProgressData) {
      // Check if progress has been reset (current position moved backward significantly)
      const currentModule = progressData.currentModule;
      const currentSection = progressData.currentSection;
      const currentItem = progressData.currentItem;

      const lastModule = lastProgressData.currentModule;
      const lastSection = lastProgressData.currentSection;
      const lastItem = lastProgressData.currentItem;

      // If we've moved to a different module/section/item that suggests a reset
      const hasProgressChanged = (
        currentModule !== lastModule ||
        currentSection !== lastSection ||
        currentItem !== lastItem
      );

      if (hasProgressChanged) {
        console.log('Progress reset detected, clearing cached section items');

        // Clear all cached section items to force fresh load
        setSectionItems({});

        // Clear waiting states
        setWaitingForNextSection(null);

        // Update selected items
        setSelectedModuleId(currentModule);
        setSelectedSectionId(currentSection);
        setSelectedItemId(currentItem);

        // Auto-expand the module and section
        setExpandedModules(prev => ({ ...prev, [currentModule]: true }));
        setExpandedSections(prev => ({ ...prev, [currentSection]: true }));

        // Set active section to fetch items fresh
        setActiveSectionInfo({
          moduleId: currentModule,
          sectionId: currentSection
        });

        // Update the course store with the current progress
        updateCourseNavigation(currentModule, currentSection, currentItem);
      }
    }

    // Update last known progress data
    setLastProgressData(progressData);
  }, [progressData, lastProgressData, updateCourseNavigation]);

  // Effect to initialize based on user progress ONLY ON INITIAL LOAD
  useEffect(() => {
    if (progressData && !initialLoadComplete) {
      const moduleId = progressData.currentModule;
      const sectionId = progressData.currentSection;
      const itemId = progressData.currentItem;

      setSelectedModuleId(moduleId);
      setSelectedSectionId(sectionId);
      setSelectedItemId(itemId);

      // Initialize previous valid item to always have a fallback
      setPreviousValidItem({
        moduleId,
        sectionId,
        itemId
      });

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
        // Get completion status from section items if available
        if (selectedSectionId && sectionItems[selectedSectionId]) {
          const sectionItem = sectionItems[selectedSectionId].find(
            (sectionItem: any) => sectionItem._id === item._id
          );
          if (sectionItem && (sectionItem as any).isCompleted !== undefined) {
            (item as any).isCompleted = (sectionItem as any).isCompleted;
          }
        }

        setCurrentItem(item);
        // Clear loading state when new item is successfully loaded
        setIsNavigatingToNext(false);
      }
    }
  }, [itemData, itemLoading, selectedSectionId, sectionItems]);

  // Flag handling function
  const handleFlagSubmit = async (reason: string) => {
    try {
      if (!currentItem?._id) return;

      if (!currentItem) {
        return;
      }
      const submitFlagBody = {
        courseId: COURSE_ID,
        versionId: VERSION_ID,
        entityId: currentItem._id,
        entityType: currentItem.type as EntityType,
        reason,
        questionId: itemContainerRef.current?.getCurrentDetails?.()?.questionId,
        cohortId: COHORT_ID
      }

      await submitFlagAsyncMutate({ body: submitFlagBody })
      toast.success("Flag submitted successfully", { position: 'top-right' })
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit flag", { position: 'top-right' });
    } finally {
      setIsFlagSubmitted(true);
      setIsFlagModalOpen(false);
    }
  };

  // Emotion tracking handler
  const handleEmotionSubmit = async (emotion: EmotionType, feedbackText?: string) => {
    try {
      if (!currentItem?._id) return;
      if (!COURSE_ID || !VERSION_ID) {
        throw new Error("Course context is not ready yet. Please wait a moment and try again.");
      }

      const payload = {
        courseId: COURSE_ID,
        courseVersionId: VERSION_ID,
        itemId: currentItem._id,
        emotion,
        feedbackText,
        cohortId: COHORT_ID,
      };

      await submitEmotionAsync(payload);
      setSelectedEmotion(prev => ({ ...prev, [currentItem._id]: emotion }));
      toast.success(
        feedbackText?.trim() ? "Your emotion and note have been recorded!" : "Your feedback has been recorded!",
        { position: 'top-right', duration: 2000 }
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to record emotion", { position: 'top-right' });
    }
  };
  const moduleProgressMap = useMemo(() => {
    const map = new Map();

    moduleProgressData?.forEach((m: any) => {
      map.set(m.moduleId, m);
    });

    return map;
  }, [moduleProgressData]);



  // Handle item selection
  // Handle item selection - simplified and more robust
  // const handleSelectItem = (moduleId: string, sectionId: string, itemId: string) => {
  //   // Set loading state when changing items from sidebar - same as with Next button
  //   setIsNavigatingToNext(true);

  //   // Stop current item before switching - make this more robust
  //   if (itemContainerRef.current) {
  //     console.log('Stopping current item before switching');
  //     itemContainerRef.current.stopCurrentItem();

  //     // Add a small delay to ensure cleanup completes
  //     setTimeout(() => {
  //       // Store current valid item before switching (only if not in error state)
  //       if (selectedItemId && selectedSectionId && selectedModuleId && !isItemForbidden) {
  //         setPreviousValidItem({
  //           moduleId: selectedModuleId,
  //           sectionId: selectedSectionId,
  //           itemId: selectedItemId
  //         });
  //       }

  //       // Always clear any existing item errors when manually selecting an item
  //       setIsItemForbidden(false);

  //       // Attempt the switch
  //       setSelectedModuleId(moduleId);
  //       setSelectedSectionId(sectionId);
  //       setSelectedItemId(itemId);

  //       // Ensure section items are loaded if not already
  //       if (!sectionItems[sectionId]) {
  //         setActiveSectionInfo({
  //           moduleId,
  //           sectionId
  //         });
  //       }

  //       // Expand the module and section automatically
  //       setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
  //       setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

  //       // Update the course store with the new navigation state
  //       updateCourseNavigation(moduleId, sectionId, itemId);
  //       console.log('States updated - unblocking fetch for', itemId);
  //     setIsNavigatingToNext(false);
  //     }, 50); // Small delay to ensure cleanup completes
  //   } else {
  //     // Set loading state even without a ref
  //     setIsNavigatingToNext(true);

  //     // Store current valid item before switching (only if not in error state)
  //     if (selectedItemId && selectedSectionId && selectedModuleId && !isItemForbidden) {
  //       setPreviousValidItem({
  //         moduleId: selectedModuleId,
  //         sectionId: selectedSectionId,
  //         itemId: selectedItemId
  //       });
  //     }

  //     // Always clear any existing item errors when manually selecting an item
  //     setIsItemForbidden(false);

  //     // Attempt the switch
  //     setSelectedModuleId(moduleId);
  //     setSelectedSectionId(sectionId);
  //     setSelectedItemId(itemId);

  //     // Ensure section items are loaded if not already
  //     if (!sectionItems[sectionId]) {
  //       setActiveSectionInfo({
  //         moduleId,
  //         sectionId
  //       });
  //     }

  //     // Expand the module and section automatically
  //     setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
  //     setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

  //     // Update the course store with the new navigation state
  //     updateCourseNavigation(moduleId, sectionId, itemId);
  //     console.log('States updated - unblocking fetch for', itemId);
  //   setIsNavigatingToNext(false);
  //   }
  // };
  // Handle item selection - now with immediate flag clear and enqueued for safety
  const handleSelectItem = useCallback((moduleId: string, sectionId: string, itemId: string) => {
    enqueueNavigation(async () => {
      setIsNavigatingToNext(true);
      // Sidebar navigation away cancels any pending pre-quiz prompt.
      setPendingStudentQuestionContext(null);

      try {
        // Record completion for the current item before leaving.
        // Documents (BLOG) only get their completion recorded by an explicit stop
        // call; unlike video/quiz/project they don't auto-complete on their own
        // event. Without this, leaving a document via the sidebar (instead of the
        // "Next Lesson" button) left it un-ticked and stuck students below 100%.
        // Scoped to BLOG so half-watched videos / unfinished quizzes are untouched,
        // and wrapped so a stop failure can never block navigation.
        if (itemContainerRef.current && currentItem?.type === 'BLOG') {
          try {
            await itemContainerRef.current.stopCurrentItem();
          } catch (e) {
            console.error('Failed to record document completion on sidebar nav:', e);
          }
        }
        // Small delay for API/callback cleanup
        await new Promise(resolve => setTimeout(resolve, 50));

        // Store previous valid for fallback (only if not forbidden)
        if (selectedItemId && selectedSectionId && selectedModuleId && !isItemForbidden) {
          setPreviousValidItem({
            moduleId: selectedModuleId!,
            sectionId: selectedSectionId!,
            itemId: selectedItemId!,
          });
        }

        // Clear errors 
        setIsItemForbidden(false);

        // Update states to trigger fetch/expansion
        setSelectedModuleId(moduleId);
        setSelectedSectionId(sectionId);
        setSelectedItemId(itemId);

        // Load section items if needed
        if (!sectionItems[sectionId]) {
          safeSetActiveSection(moduleId, sectionId);
        }

        // Auto-expand sidebar
        setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
        setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

        // Update store
        updateCourseNavigation(moduleId, sectionId, itemId);
        setIsNavigatingToNext(false);

      } catch (error) {
        console.error('Error in handleSelectItem:', error);
        toast.error('Failed to switch item. Please try again.');
        setIsNavigatingToNext(false);
      }
    });
  }, [
    selectedModuleId,
    selectedSectionId,
    selectedItemId,
    sectionItems,
    isItemForbidden,
    updateCourseNavigation,
    itemContainerRef,
    currentItem,
  ]);

  const handleSkipItem = async () => {
    if (!currentItem?._id) return;

    try {
      setIsSkippingItem(true);
      await skipItemAsync({ params: { path: { itemId: currentItem._id } } });
      toast.success('Item skipped successfully');
      handleNext(); // Move to the next item
    } catch (error) {
      console.error('Error skipping item:', error);
      toast.error('Failed to skip item');
    } finally {
      setIsSkippingItem(false);
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
  const findNextItem = useCallback((): {
    moduleId: string;
    sectionId: string;
    itemId: string | null;
    type?: string | null;
    needsLoading?: boolean;
  } | null => {
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
        itemId: nextItem._id,
        type: nextItem.type?.toLowerCase() ?? null,
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
          itemId: nextSectionItems[0]._id,
          type: nextSectionItems[0].type?.toLowerCase() ?? null,
        };
      } else {
        // Next section exists but items not loaded - return section info to trigger loading
        return {
          moduleId: selectedModuleId,
          sectionId: nextSection.sectionId,
          itemId: null, // Will be set after items are loaded
          type: null,
          needsLoading: true
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
            itemId: nextModuleItems[0]._id,
            type: nextModuleItems[0].type?.toLowerCase() ?? null,
          };
        } else {
          // Next section exists but items not loaded - return section info to trigger loading
          return {
            moduleId: nextModule.moduleId,
            sectionId: firstNextSection.sectionId,
            itemId: null, // Will be set after items are loaded
            type: null,
            needsLoading: true
          };
        }
      }
    }

    // No next item found
    return null;
  }, [courseVersionData, selectedModuleId, selectedSectionId, selectedItemId, sectionItems]);

  // const handleNext = useCallback(async () => {
  //   // Set loading state
  //   setIsNavigatingToNext(true);

  //   try {
  //     // Stop current item before moving to next with proper cleanup
  //     if (itemContainerRef.current) {
  //       itemContainerRef.current.stopCurrentItem();

  //       // Allow a small delay for cleanup
  //       await new Promise(resolve => setTimeout(resolve, 50));
  //     }

  //     // Find and navigate to the actual next item
  //     const nextItem = findNextItem();

  //     if (!nextItem) {
  //       console.log('No next item found - course completed!');

  //       // Clear loading state
  //       setIsNavigatingToNext(false);

  //       // Trigger confetti celebration
  //       const end = Date.now() + 3 * 1000; // 3 seconds
  //       const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

  //       const frame = () => {
  //         if (Date.now() > end) return;

  //         confetti({
  //           particleCount: 2,
  //           angle: 60,
  //           spread: 55,
  //           startVelocity: 60,
  //           origin: { x: 0, y: 0.5 },
  //           colors: colors,
  //         });
  //         confetti({
  //           particleCount: 2,
  //           angle: 120,
  //           spread: 55,
  //           startVelocity: 60,
  //           origin: { x: 1, y: 0.5 },
  //           colors: colors,
  //         });

  //         requestAnimationFrame(frame);
  //       };

  //       frame();

  //       // Redirect to dashboard after celebration
  //       setTimeout(() => {
  //         router.navigate({ to: '/student' });
  //       }, 3500);

  //       return;
  //     }

  //     // Check if we need to load items for the next section
  //     if ((nextItem as any).needsLoading) {
  //       const { moduleId, sectionId } = nextItem;
  //       console.log('Next section items need loading. Triggering load for:', { moduleId, sectionId });

  //       // Store current valid item before switching
  //       if (selectedItemId && selectedSectionId && selectedModuleId) {
  //         setPreviousValidItem({
  //           moduleId: selectedModuleId,
  //           sectionId: selectedSectionId,
  //           itemId: selectedItemId
  //         });
  //       }

  //       // Set waiting state to track when items are loaded
  //       setWaitingForNextSection({ moduleId, sectionId });

  //       // Trigger loading of next section items
  //       safeSetActiveSection(moduleId, sectionId);

  //       // Keep loading state active (will be cleared when navigation completes)
  //       return;
  //     }

  //     const { moduleId, sectionId, itemId } = nextItem;

  //     // Ensure all values are defined before switching (for regular navigation)
  //     if (!moduleId || !sectionId || !itemId) {
  //       console.log('Invalid next item data');
  //       setIsNavigatingToNext(false);
  //       return;
  //     }

  //     // Store current valid item before switching
  //     if (selectedItemId && selectedSectionId && selectedModuleId) {
  //       setPreviousValidItem({
  //         moduleId: selectedModuleId,
  //         sectionId: selectedSectionId,
  //         itemId: selectedItemId
  //       });
  //     }

  //     // Clear any existing item errors to ensure navigation works
  //     setIsItemForbidden(false);

  //     // Update local state immediately to the NEXT item
  //     setSelectedModuleId(moduleId);
  //     setSelectedSectionId(sectionId);
  //     setSelectedItemId(itemId);

  //     // Auto-expand the module and section
  //     setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
  //     setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

  //     // Set active section to fetch items if not already loaded
  //     if (!sectionItems[sectionId]) {
  //       setActiveSectionInfo({
  //         moduleId,
  //         sectionId
  //       });
  //     }

  //     // Update the course store with the next item
  //     updateCourseNavigation(moduleId, sectionId, itemId);

  //     console.log('Successfully navigated to next item:', { moduleId, sectionId, itemId });
  //   } catch (error) {
  //     console.error('Error navigating to next item:', error);
  //     // Clear loading state on error
  //     setIsNavigatingToNext(false);
  //   }
  // }, [
  //   findNextItem,
  //   selectedModuleId,
  //   selectedSectionId,
  //   selectedItemId,
  //   sectionItems,
  //   updateCourseNavigation,
  //   router
  // ]);

  // Helper function to find the last video item before the current item



  const handleNext = useCallback(() => {
    if (navInFlightRef.current || itemLoading) return;
    navInFlightRef.current = true;
    enqueueNavigation(async () => {
      setIsNavigatingToNext(true);
      try {
        // 1️⃣ Stop current item (clean + API)
        if (itemContainerRef.current) {
          try {
            console.log("Handle next is called to end the current item.....")
            await itemContainerRef.current.stopCurrentItem();
          } catch (error: any) {
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to save progress. Please try again.';
            toast.error(errorMessage);

            // Navigate to previous video item on stop API failure
            const previousVideoItem = findPreviousVideoItem();
            if (previousVideoItem && previousVideoItem.itemId && previousVideoItem.itemId !== selectedItemId) {

              // Update local React state to trigger re-render
              setSelectedModuleId(previousVideoItem.moduleId);
              setSelectedSectionId(previousVideoItem.sectionId);
              setSelectedItemId(previousVideoItem.itemId);

              // Expand the module and section
              setExpandedModules(prev => ({ ...prev, [previousVideoItem.moduleId]: true }));
              setExpandedSections(prev => ({ ...prev, [previousVideoItem.sectionId]: true }));

              // Ensure section items are loaded
              if (!sectionItems[previousVideoItem.sectionId]) {
                setActiveSectionInfo({
                  moduleId: previousVideoItem.moduleId,
                  sectionId: previousVideoItem.sectionId
                });
              }

              // Update course store
              updateCourseNavigation(
                previousVideoItem.moduleId,
                previousVideoItem.sectionId,
                previousVideoItem.itemId
              );
            }

            setIsNavigatingToNext(false);
            return;
          }
        }

        setSectionItems(prev => ({
          ...prev,
          [selectedSectionId!]: prev[selectedSectionId!].map(item =>
            item._id === selectedItemId
              ? { ...item, isCompleted: true }
              : item
          )
        }));

        // 2️⃣ Determine next item
        const nextItem = findNextItem();

        // If a video just finished and the next item is a quiz, and the course
        // version has crowdsourced question submission enabled, stage a pre-quiz
        // prompt so the student can contribute an MCQ before the quiz auto-starts.
        const justFinishedItem = sectionItems[selectedSectionId!]?.find(
          (item: any) => item._id === selectedItemId,
        );
        const isVideoToQuizTransition =
          justFinishedItem?.type?.toLowerCase() === 'video' &&
          nextItem?.type === 'quiz';
        if (
          isVideoToQuizTransition &&
          proctoringData?.settings?.crowdsourcedQuestionSubmissionEnabled === true &&
          selectedItemId
        ) {
          setPendingStudentQuestionContext({
            courseId: COURSE_ID,
            courseVersionId: VERSION_ID,
            segmentId: selectedItemId,
          });
        } else {
          setPendingStudentQuestionContext(null);
        }

        if (!nextItem) {
          console.log("🎉 Course complete");
          setIsNavigatingToNext(false);

          const allSections = ((courseVersionData as any)?.modules || [])?.flatMap((m: any) => m.sections || []) || [];
          const allItemIds = new Set<string>();
          const completedItemIds = new Set<string>();

          allSections.forEach((section: any) => {
            const items = sectionItems[section.sectionId] || [];
            items.forEach((item: any) => {
              allItemIds.add(item._id);

              if (item.isCompleted || item._id === selectedItemId) {
                completedItemIds.add(item._id);
              }
            });
          });

          completedItemIdsRef.current.forEach((id: string) => completedItemIds.add(id));

          const isCourseFullyCompleted = allItemIds.size > 0 && allItemIds.size === completedItemIds.size;

          if (isCourseFullyCompleted) {
             setCourseJustCompleted(true);
            // Confetti celebration
            const end = Date.now() + 3000;
            const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

            const frame = () => {
              if (Date.now() > end) return;

              confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                startVelocity: 60,
                origin: { x: 0, y: 0.5 },
                colors,
              });
              confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                startVelocity: 60,
                origin: { x: 1, y: 0.5 },
                colors,
              });

              requestAnimationFrame(frame);
            };
            frame();

            // Check for an exclusive follow-up invite unlocked by completing
            // this course. If one exists, show a claim card instead of the
            // usual auto-redirect so the student can act on it.
            try {
              const inviteRes = await getPendingInvites();
              const invites = inviteRes?.invites ?? [];
              const unlocked = invites.find(
                (inv: any) =>
                  inv?.inviteStatus === "PENDING" &&
                  inv?.courseId?.toString() !== COURSE_ID?.toString(),
              );
              if (unlocked) {
                setFollowUpInvite(unlocked);
              } else {
                setTimeout(() => router.navigate({ to: "/student" }), 3500);
              }
            } catch {
              setTimeout(() => router.navigate({ to: "/student" }), 3500);
            }
          }

          // Recalcualate and update the progress % and completed items count properly
          await recalculateStudentProgressAsync({
            body: {
              courseId: COURSE_ID,
              courseVersionId: VERSION_ID,
              cohortId: COHORT_ID
            },
          });
          return;
        }

        // 3️⃣ If next section requires loading
        if ((nextItem as any).needsLoading) {
          const { moduleId, sectionId } = nextItem;

          // Store current valid item before switching
          if (selectedItemId && selectedSectionId && selectedModuleId) {
            setPreviousValidItem({
              moduleId: selectedModuleId,
              sectionId: selectedSectionId,
              itemId: selectedItemId,
            });
          }

          // Set waiting state to track when items are loaded
          setWaitingForNextSection({ moduleId, sectionId });

          // Trigger loading of next section items
          safeSetActiveSection(moduleId, sectionId);

          // Keep loading state active (will be cleared when navigation completes)
          return;
        }

        // 4️⃣ Normal next item navigation
        const { moduleId, sectionId, itemId } = nextItem;

        if (!moduleId || !sectionId || !itemId) {
          setIsNavigatingToNext(false);
          return;
        }

        // Store current valid item
        if (selectedItemId && selectedSectionId && selectedModuleId) {
          setPreviousValidItem({
            moduleId: selectedModuleId,
            sectionId: selectedSectionId,
            itemId: selectedItemId,
          });
        }

        setIsItemForbidden(false);

        // 5️⃣ Update UI state
        setSelectedModuleId(moduleId);
        setSelectedSectionId(sectionId);
        setSelectedItemId(itemId);

        setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
        setExpandedSections(prev => ({ ...prev, [sectionId]: true }));

        // Fetch section if needed
        if (!sectionItems[sectionId]) {
          safeSetActiveSection(moduleId, sectionId);
        }

        // Update global course store
        updateCourseNavigation(moduleId, sectionId, itemId);


        // Clear loading state after successful navigation
        setIsNavigatingToNext(false);
      } catch (error) {
        console.error('Error navigating to next item:', error);
        // Clear loading state on error
        setIsNavigatingToNext(false);
      } finally {
        navInFlightRef.current = false;
      }
    });
  }, [
    findNextItem,
    itemContainerRef,
    selectedModuleId,
    selectedSectionId,
    selectedItemId,
    sectionItems,
    updateCourseNavigation,
    router,
    courseVersionData,
    recalculateStudentProgressAsync,
    COURSE_ID,
    VERSION_ID,
    itemLoading,
  ]);


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
    setIsNavigatingToPrev(true);

    try {
      // Stop current item before moving to previous video with proper cleanup
      if (itemContainerRef.current) {
        console.log("Stoped the item from the handlePrevVideo....")
        itemContainerRef.current.stopCurrentItem();

        // Allow a small delay for cleanup
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Find the previous video item
      const prevVideoItem = findPreviousVideoItem();

      if (!prevVideoItem) {
        setIsNavigatingToPrev(false);
        return;
      }

      const { moduleId, sectionId, itemId } = prevVideoItem;

      // Ensure all values are defined before switching
      if (!moduleId || !sectionId || !itemId) {
        setIsNavigatingToPrev(false);
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

      // Clear loading state after successful navigation
      setTimeout(() => {
        setIsNavigatingToPrev(false);
      }, 500);
    } catch (error) {
      console.error('Error navigating to previous video:', error);
      // Clear loading state on error
      setIsNavigatingToPrev(false);
    }
  }, [
    findPreviousVideoItem,
    selectedModuleId,
    selectedSectionId,
    selectedItemId,
    sectionItems,
    updateCourseNavigation,
  ]);

const nextItemInfo = findNextItem();

const proctorAlertActive =
  blockingActive || (!showProctorDialog && !allProctorsDisabled && (pauseVid || rewindVid));

// Hold the alert visible for at least 2s once it appears, even if the anomaly
// clears sooner — prevents a jarring flash.
useEffect(() => {
  if (proctorAlertActive) {
    if (!alertVisible) {
      alertShownAtRef.current = Date.now();
      setAlertVisible(true);
    }
    return;
  }
  if (alertVisible) {
    const remaining = Math.max(0, 2000 - (Date.now() - alertShownAtRef.current));
    const t = setTimeout(() => setAlertVisible(false), remaining);
    return () => clearTimeout(t);
  }
}, [proctorAlertActive, alertVisible]);

const isCurrentItemCompleted = Boolean((currentItem as any)?.isCompleted);

const isNextItemAlreadyCompleted = (() => {
  if (!nextItemInfo || (nextItemInfo as any).needsLoading) return false;
  const { sectionId: nextSectionId, itemId: nextItemId } = nextItemInfo;
  const nextSectionItems = sectionItems[nextSectionId] ?? [];
  return nextSectionItems.some(
    (item: any) => item._id === nextItemId && item.isCompleted,
  );
})();

const showGoToNextButton =
  isCurrentItemCompleted && !!nextItemInfo && isNextItemAlreadyCompleted && !isGoingToNext;

const handleGoToNextItem = async () => {
  if (isGoingToNext || !nextItemInfo) return; // guard against double-clicks

  setIsGoingToNext(true);
  try {
    const { moduleId, sectionId: nextSectionId, itemId } = nextItemInfo as any;
    if (!moduleId || !nextSectionId || !itemId) return;

    handleSelectItem(moduleId, nextSectionId, itemId);
  } finally {
    // Re-enable after navigation state has been handed off
    setTimeout(() => setIsGoingToNext(false), 800);
  }
};

  // Autoscroll to selected sidebar item when selectedItemId changes
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedItemId]);

  useEffect(() => {
  if (!courseJustCompleted) return;
  // Don't auto-redirect when there's a follow-up invite to claim.
  if (followUpInvite) return;

  const timer = setTimeout(() => {
    router.navigate({ to: "/student" });
  }, 3500);

  return () => clearTimeout(timer);
}, [courseJustCompleted, followUpInvite, router]);

  useEffect(() => {
    refetchVersion();
  }, [courseVersionData]);

  if (versionLoading || progressLoading || proctoringLoading || ethicsConsentLoading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="flex items-center space-x-4">
          <Skeleton className="rounded-full w-12 h-12" />
          <div className="space-y-2">
            <Skeleton className="w-[250px] h-4" />
            <Skeleton className="w-[200px] h-4" />
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
        <CardContent className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="mb-2 text-destructive">
              <Target className="mx-auto w-8 h-8"></Target>
            </div>
            <p className="font-medium text-destructive">Error loading course data</p>
            <p className="mt-1 text-muted-foreground text-sm">Please try again later</p>
            <Button asChild className="mt-4">
              <Link to="/student">Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isMobile && !allProctorsDisabled)
    return <MobileFallbackScreen />

  const modules = (courseVersionData as any)?.modules || [];

  const isLinearProgressionEnabled = proctoringData?.settings.linearProgressionEnabled ?? true;

  const isItemLocked = (moduleId: string, sectionId: string, itemId: string): boolean => {
    if (!isLinearProgressionEnabled) return false;
    if (!progressData) return false;

    const currentItemId = progressData.currentItem;
    const currentSectionId = progressData.currentSection;
    const currentModuleId = progressData.currentModule;

    // Completed items are never locked
    const sectionItemsList = sectionItems[sectionId] || [];
    const item = sectionItemsList.find((i: any) => i._id === itemId) as any;
    if (item?.isCompleted) return false;

    // Current item is never locked
    if (itemId === currentItemId) return false;

    // Compare position in course structure
    const allModules = (courseVersionData as any)?.modules || [];
    const moduleIndex = allModules.findIndex((m: any) => m.moduleId === moduleId);
    const currentModuleIndex = allModules.findIndex((m: any) => m.moduleId === currentModuleId);

    if (moduleIndex > currentModuleIndex) return true;
    if (moduleIndex < currentModuleIndex) return false;

    const sections = allModules[moduleIndex]?.sections || [];
    const sectionIndex = sections.findIndex((s: any) => s.sectionId === sectionId);
    const currentSectionIndex = sections.findIndex((s: any) => s.sectionId === currentSectionId);

    if (sectionIndex > currentSectionIndex) return true;
    if (sectionIndex < currentSectionIndex) return false;

    const itemIndex = sectionItemsList.findIndex((i: any) => i._id === itemId);
  const currentItemIndex = sectionItemsList.findIndex((i: any) => i._id === currentItemId);

  // Only unlock next item if it's a QUIZ paired with current VIDEO
  if (itemIndex === currentItemIndex + 1) {
    const currentItemInList = sectionItemsList[currentItemIndex] as any;
    const thisItem = sectionItemsList[itemIndex] as any;
    if (currentItemInList?.type === 'VIDEO' && thisItem?.type === 'QUIZ') {
      return false; // unlock paired quiz
    }
    return true; // lock everything else
  }

  if (itemIndex > currentItemIndex + 1) return true;
return false;
  };

  return (
    <>
      {/* Ethical consent gate — must be signed once per course before any content */}
      {!consentSatisfied && (
        <EthicsConsentModal
          open={!consentSatisfied}
          courseId={COURSE_ID}
          versionId={VERSION_ID}
          onSigned={() => setEthicsConsentSignedLocal(true)}
          onCancel={() => router.navigate({ to: "/student" })}
        />
      )}
      {/* Exclusive follow-up invite unlocked by completing this course */}
      <Dialog
        open={!!followUpInvite}
        onOpenChange={(open) => {
          if (!open) {
            setFollowUpInvite(null);
            router.navigate({ to: "/student" });
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-full sm:max-w-lg text-center">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-xl">
              🎉 You've unlocked a new course!
            </DialogTitle>
          </DialogHeader>
          <p className="mt-2 mb-6 text-foreground text-base">
            Congratulations on completing this course. You've earned an exclusive
            spot in{" "}
            <span className="font-semibold">
              {followUpInvite?.course?.name ?? "the next course"}
            </span>
            . Claim it now to get started.
          </p>
          <div className="flex sm:flex-row flex-col justify-center gap-3">
            <Button
              className="font-semibold"
              onClick={async () => {
                const inviteId = followUpInvite?.inviteId?.toString();
                if (!inviteId) return;
                try {
                  await acceptFollowUpInvite(inviteId, "ACCEPT");
                  window.location.assign("/student");
                } catch {
                  /* keep the card open so they can retry */
                }
              }}
            >
              Claim my spot
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFollowUpInvite(null);
                router.navigate({ to: "/student" });
              }}
            >
              Maybe later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={consentSatisfied && showProctorDialog} onOpenChange={(open) => {
        if (!open) {
          router.navigate({ to: '/student' });
        }
      }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg">Declaration</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 mb-4 pl-6 text-foreground text-base list-disc">
            <li>
              I understand that my camera and microphone will be used during this course for proctoring.
            </li>
            <li>
              I agree that images from my webcam may be captured at various points if unusual activity is detected.
            </li>
            <li>
              I acknowledge that the microphone is used for monitoring purposes only, and that no audio or video will be recorded or stored elsewhere.
            </li>
          </ul>
          <div className="flex justify-end w-full">
            <Button onClick={() => { setShowProctorDialog(false) }} className="w-full">ACCEPT</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden proctoring engine — kept mounted (clipped to 1px) so the webcam
          keeps decoding and anomaly detection keeps running off-screen. */}
      {!showProctorDialog && (
        <div
          aria-hidden
          className="bottom-0 left-0 z-0 fixed opacity-0 w-px h-px overflow-hidden pointer-events-none"
        >
          <FloatingVideo
            isVisible={!allProctorsDisabled}
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
                },
                linearProgressionEnabled: true
              }
            }}
            anomalies={anomalies}
            readyToDetect={readyToDetect}
            setReadyToDetect={setReadyToDetect}
            setAnomalies={setAnomalies}
            rewindVid={rewindVid}
            setRewindVid={setRewindVid}
            pauseVid={pauseVid}
            setPauseVid={setPauseVid}
          />
        </div>
      )}

      {/* Focused cinematic stage */}
      <main
        className="fixed inset-0 flex flex-col bg-stage overflow-hidden text-stage-foreground"
        onClick={() => setAiExpanded(false)}
      >
        {/* Lesson content */}
        {currentItem ? (
          currentItem.type === "PROJECT" ? (
            <div className="z-30 absolute inset-0 px-3 sm:px-6 py-16 overflow-y-auto">
              <div className="mx-auto w-full max-w-5xl">
                <StudentProjectItem
                  item={currentItem}
                  onNext={handleNext}
                  isProgressUpdating={isNavigatingToNext || itemLoading}
                  completedItemIdsRef={completedItemIdsRef}
                  isAlreadyWatched={currentItem.isAlreadyWatched}
                />
              </div>
            </div>
          ) : (
            <div className={currentItem.type === "VIDEO" ? "contents" : "absolute inset-0 z-30 overflow-y-auto"}>
              <div
                className={
                  currentItem.type === "VIDEO"
                    ? "contents"
                    : "mx-auto min-h-full w-full max-w-5xl bg-card text-card-foreground sm:my-6 sm:min-h-[calc(100%-3rem)] sm:rounded-2xl sm:shadow-2xl"
                }
              >
                <ItemContainer
                  ref={itemContainerRef}
                  item={currentItem}
                  focusMode={currentItem.type === "VIDEO"}
                  doGesture={doGesture}
                  onNext={handleNext}
                  onPrevVideo={handlePrevVideo}
                  isProgressUpdating={isNavigatingToNext || itemLoading}
                  isNavigatingToPrev={isNavigatingToPrev}
                  attemptId={attemptId || undefined}
                  setAttemptId={setAttemptId}
                  rewindVid={rewindVid}
                  readyToDetect={readyToDetect}
                  pauseVid={pauseVid || showProctorDialog || alertVisible}
                  pauseSignal={pauseSignal}
                  awayPaused={awayPaused}
                  displayNextLesson={false}
                  setQuizPassed={setQuizPassed}
                  anomalies={anomalies}
                  keyboardLockEnabled={!isFlagModalOpen && !drawerOpen && !aiSheet}
                  linearProgressionEnabled={proctoringData?.settings.linearProgressionEnabled || true}
                  seekForwardEnabled={proctoringData?.settings.seekForwardEnabled || false}
                  setIsQuizSkipped={setIsQuizSkipped}
                  courseId={COURSE_ID}
                  versionId={VERSION_ID}
                  sectionId={sectionId}
                  completedItemIdsRef={completedItemIdsRef}
                  nextItem={findNextItem()}
                  cohortId={COHORT_ID}
                  cohortName={COHORT_NAME}
                  pendingStudentQuestionContext={pendingStudentQuestionContext}
                  clearPendingStudentQuestionContext={() => setPendingStudentQuestionContext(null)}
                />
              </div>
            </div>
          )
        ) : (
          <div className="z-30 absolute inset-0 place-items-center grid px-6 text-center">
            <div className="max-w-md">
              <div className="place-items-center grid bg-glass mx-auto mb-5 ring-glass-border rounded-2xl ring-1 w-16 h-16">
                <BookOpen className="w-7 h-7 text-warm" />
              </div>
              <h3 className="font-semibold text-xl">Ready to learn?</h3>
              <p className="mt-2 text-stage-foreground/70 text-sm">
                Open the course panel to choose a lesson and begin.
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); pauseVideoForControl(); setDrawerOpen(true); }}
                className="inline-flex items-center gap-2 bg-warm hover:opacity-90 mt-5 px-5 py-2 rounded-full font-medium text-warm-foreground text-sm transition"
              >
                <Target className="w-4 h-4" /> Browse lessons
              </button>
            </div>
          </div>
        )}

        {/* Floating chrome */}
        <FloatingBackButton onClick={() => { pauseVideoForControl(); setDrawerOpen(true); }} />
        <AiCompanion
          expanded={aiExpanded}
          onExpandedChange={setAiExpanded}
          onIconClick={pauseVideoForControl}
          onAction={(id) => {
            pauseVideoForControl();
            setAiExpanded(false);
            if (id === "report") {
              if (isFlagSubmitted) {
                toast.info("You've already flagged this item.", { position: "top-right" });
                return;
              }
              setIsFlagModalOpen(true);
            } else {
              setAiSheet(id);
            }
          }}
        />
        {!allProctorsDisabled && !showProctorDialog && (
          <FloatingCameraButton
            open={camPinned || camHover}
            pinned={camPinned}
            onToggle={() => { pauseVideoForControl(); setCamPinned((p) => !p); }}
            onHoverChange={setCamHover}
            anomaly={pauseVid || rewindVid}
          />
        )}

        {/* Contextual skip / go-to-next (middle-right) */}
        {currentItem && ((currentItem as any)?.isOptional || showGoToNextButton) && (
          <div className="top-1/2 right-4 sm:right-6 z-50 absolute flex flex-col items-end gap-2 -translate-y-1/2">
            {(currentItem as any)?.isOptional && (
              <button
                onClick={() => { pauseVideoForControl(); handleSkipItem(); }}
                disabled={isSkippingItem || isSkipping}
                className="inline-flex items-center gap-1.5 bg-glass hover:bg-white/15 disabled:opacity-50 backdrop-blur-md px-3.5 py-2 ring-glass-border rounded-full ring-1 font-medium text-stage-foreground text-xs transition"
              >
                Skip <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {showGoToNextButton && (
              <button
                onClick={() => { pauseVideoForControl(); handleGoToNextItem(); }}
                disabled={isGoingToNext}
                className="inline-flex items-center gap-1.5 bg-warm hover:opacity-90 disabled:opacity-50 shadow-lg px-3.5 py-2 rounded-full font-medium text-warm-foreground text-xs transition"
              >
                <CircleCheckIcon className="w-3.5 h-3.5" /> Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Initial webcam popup — first ~11s while the camera sets up */}
        {!allProctorsDisabled && !showProctorDialog && <InitialWebcamPopup seconds={15} />}

        {/* Transient notifications */}
        <div className="top-4 left-1/2 z-90 fixed flex flex-col gap-2 w-[min(92vw,420px)] -translate-x-1/2 pointer-events-none">
          {isItemForbidden && (
            <div className="bg-red-600/95 shadow-xl backdrop-blur-md p-4 border border-red-400/40 rounded-2xl text-red-50 animate-vibe-slide-up pointer-events-auto">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 w-5 h-5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Lesson locked</p>
                  <p className="mt-0.5 text-red-50/90 text-xs leading-relaxed">
                    ViBe lessons unlock in order. Please finish your current lesson to continue.
                  </p>
                </div>
                <button onClick={() => setIsItemForbidden(false)} className="text-red-50/80 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {timeSlotBlock && (
            <div className="bg-amber-600/95 shadow-xl backdrop-blur-md p-4 border border-amber-400/40 rounded-2xl text-amber-50 animate-vibe-slide-up pointer-events-auto">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 w-5 h-5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {/book a time slot|choose a slot/i.test(timeSlotBlock) ? "Book a time slot" : "Outside your study window"}
                  </p>
                  <p className="mt-0.5 text-amber-50/90 text-xs leading-relaxed">{timeSlotBlock}</p>
                  <div className="flex gap-2 mt-2">
                    {/book a time slot|choose a slot/i.test(timeSlotBlock) && (
                      <button onClick={() => setShowTimeslotPicker(true)} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-medium text-xs">
                        Pick a slot
                      </button>
                    )}
                    <button onClick={() => setTimeSlotBlock(null)} className="hover:bg-white/10 px-3 py-1 rounded-full font-medium text-xs">
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {doGesture && currentItem?.type !== "VIDEO" && (
            <div className="bg-amber-600/95 shadow-xl backdrop-blur-md p-4 border border-amber-400/30 rounded-2xl text-amber-50 animate-vibe-slide-up pointer-events-auto">
              <div className="flex items-center gap-3">
                <img src="https://em-content.zobj.net/source/microsoft/309/thumbs-up_1f44d.png" className="w-8 h-8" alt="thumbs up" />
                <div>
                  <p className="font-semibold text-sm">Gesture required</p>
                  <p className="text-xs">Show a <strong>thumbs up</strong> to continue.</p>
                </div>
              </div>
            </div>
          )}

          {quizPassed !== 2 && quizPassed !== 3 && !isQuizSkipped && (
            <div
              className={`pointer-events-auto animate-vibe-slide-up overflow-hidden rounded-2xl p-4 text-white shadow-xl ${
                quizPassed === 1
                  ? "bg-gradient-to-br from-emerald-500 to-green-600"
                  : "bg-gradient-to-br from-rose-500 to-red-600"
              }`}
            >
              <div className="flex items-center gap-3">
                {quizPassed === 1 ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                <div className="flex-1">
                  <p className="font-bold text-sm">{quizPassed === 1 ? "Quiz passed!" : "Quiz failed"}</p>
                  <p className="text-white/90 text-xs">
                    {quizPassed === 1 ? "Moving to the next video" : "Redirecting to the previous video"}
                  </p>
                </div>
                <button onClick={() => setTimeout(() => setQuizPassed(2), 300)} className="text-white/80 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Course progress / navigation drawer (opened by the back button) */}
      <CourseDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        courseName={(courseVersionData as any)?.name}
        supportLink={(courseVersionData as any)?.supportLink}
        user={user}
        modules={modules}
        moduleProgressMap={moduleProgressMap}
        moduleProgressLoading={moduleProgressLoading}
        expandedModules={expandedModules}
        expandedSections={expandedSections}
        selectedModuleId={selectedModuleId}
        selectedSectionId={selectedSectionId}
        selectedItemId={selectedItemId}
        sectionItems={sectionItems}
        activeSectionInfo={activeSectionInfo}
        itemsLoading={itemsLoading}
        itemLoading={itemLoading}
        shouldRandomize={shouldRandomize}
        onToggleModule={toggleModule}
        onToggleSection={toggleSection}
        onSelectItem={(m, s, i) => { handleSelectItem(m, s, i); setDrawerOpen(false); }}
        isItemLocked={isItemLocked}
        emotion={
          currentItem
            ? {
                itemId: currentItem._id,
                onEmotionSelect: handleEmotionSubmit,
                selectedEmotion: selectedEmotion[currentItem._id] || null,
              }
            : null
        }
      />

      {/* AI companion placeholder surfaces (chat / talk / discussion) */}
      <AiActionSheet active={aiSheet} onClose={() => setAiSheet(null)} />

      {/* Report (flag) — real, existing feature */}
      <FlagModal
        open={isFlagModalOpen}
        onOpenChange={setIsFlagModalOpen}
        onSubmit={handleFlagSubmit}
        isSubmitting={isPending}
      />

      {/* Time-slot picker (lazy) */}
      {showTimeslotPicker && (
        <Suspense fallback={null}>
          <LazyStudentTimeslotModal
            isOpen={showTimeslotPicker}
            onClose={() => { setShowTimeslotPicker(false); setTimeSlotBlock(null); }}
            courseId={COURSE_ID}
            courseVersionId={VERSION_ID}
            currentUserId={""}
            hasAssignedTimeslot={false}
          />
        </Suspense>
      )}

      {/* Cursor left the page for 5s+ → pause + blur; auto-resumes on return */}
      <AwayOverlay onAwayChange={setAwayPaused} />

      {/* Speaking / background-noise indicator — top center, non-blocking */}
      <NoiseIndicator
        active={!showProctorDialog && !allProctorsDisabled && (anomalies || []).includes("voiceDetection")}
      />

      {/* Buttonless anomaly alert — covers the video until it clears (incl. no/multiple person) */}
      <ProctorAlertOverlay active={alertVisible} anomalies={anomalies} />

    </>
  );
};