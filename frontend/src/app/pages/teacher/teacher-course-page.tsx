import React, { useState, useEffect, useRef, useMemo, ChangeEvent, use } from "react";
import * as Papa from 'papaparse';
import { useAddQuestionBankToQuiz, useAddQuestionToBank, useCreateQuestion, useCreateQuestionBank, userParseCSVtoItems, useUpdateItemOptional } from '@/hooks/hooks';
import { Download, LogOut, Upload, UserRoundCheck } from 'lucide-react';
import { useHideItem } from '@/hooks/hooks';

const MAX_DESCRIPTION_LENGTH = 1000;

import {
  Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
  SidebarInset, SidebarProvider, SidebarFooter, useSidebar,
  SidebarTrigger
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Reorder } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  BookOpen, ChevronRight, FileText, VideoIcon, ListChecks, Plus, Sparkles,
  X, FolderKanban,
  Menu,
  MessageSquare,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";

import {  useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Home, GraduationCap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useCourseVersionById, useCreateModule, useUpdateModule, useDeleteModule, useCreateSection, useUpdateSection, useDeleteSection, useCreateItem, useUpdateItem, useDeleteItem, useItemsBySectionId, useItemById, useQuizDetails, useQuizAnalytics, useQuizPerformance, useQuizResults, useMoveModule, useMoveSection, useMoveItem, useUpdateCourseItem, useCourseById, useHideModule, useHideSection } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import VideoModal from "./components/Video-modal";
import EnhancedQuizEditor from "./components/enhanced-quiz-editor";
import EnhancedBlogEditor from "./components/enhanced-blog-editor";
import QuizWizardModal from "./components/quiz-wizard";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import Loader from "@/components/Loader";
import { Label } from "@/components/ui/label";
import ProjectItem from "./components/ProjectItem";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import FeedbackFormEditor from "./FeedbackFormEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/utils/utils";
import { QuestionUploadDialog } from "@/components/question-upload-dialog";
import ConfirmationModal from "./components/confirmation-modal";
import { useMatches, Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { BreadcrumbItemment } from "@/types/layout.types";
import AiWorkflow from "./AiWorkflow";
import AISectionPage from "./AISectionPage";
type Mode = "default" | "wizard" | "custom";
import { logout } from "@/utils/auth";
import InviteDropdown from "@/components/inviteDropDown";


// ✅ Icons per item type
const getItemIcon = (type: string) => {
  switch (type) {
    case "BLOG": return <FileText className="h-3 w-3" />;
    case "VIDEO": return <VideoIcon className="h-3 w-3" />;
    case "QUIZ": return <ListChecks className="h-3 w-3" />;
    case "PROJECT": return <FolderKanban className="h-3 w-3" />;
    case "FEEDBACK": return <MessageSquare className="h-3 w-3" />
    default: return null;
  }
};

interface LabelOptions {
  itemId: string;
  itemType: "VIDEO" | "QUIZ" | "BLOG" | "PROJECT" | "FEEDBACK";
  sectionItems: Record<string, any[]>;
  sectionId: string;
}

interface ModuleData {
  name: string;
  description: string;
}

// Interface for CSV row
type CSVRow = {
  'yotube url'?: string;
  'Segment'?: string;
  'Question Timestamp [mm:ss]'?: string;
  'S.No.'?: string;
  'Question'?: string;
  'Hint'?: string;
  'Option A'?: string;
  'Expln-A'?: string;
  'Option B'?: string;
  'Expln-B'?: string;
  'Option C'?: string;
  'Expln-C'?: string;
  'Option D'?: string;
  'Expln-D'?: string;
  'Correct Answer'?: string;
  [key: string]: string | undefined;
};

function TeacherCourseContent() {
  const [mode, setMode] = useState<Mode>("default");
  const matches = useMatches();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
    const [showInvites, setShowInvites] = useState(false);
    const [confirmLogout,setConfirmLogout] = useState(false);
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const invitesRef = useRef<HTMLDivElement | null>(null);
  
    const handleLogout = () => {
      logout();
      navigate({ to: "/auth" });
    };
  const createQuestion = useCreateQuestion();
  const user = useAuthStore().user;
  const { currentCourse, setCurrentCourse } = useCourseStore();
  // Use correct keys for course/version IDs
  const courseId = currentCourse?.courseId;
  const versionId = currentCourse?.versionId;
  useEffect(() => {
    const items: BreadcrumbItem[] = [];
    items.push({
      label: "Dashboard",
      path: "/teacher",
      isCurrentPage: matches.length === 1,
    });
    items.push({
      label: "Teacher",
      path: "/teacher",
      isCurrentPage: matches.length === 1,
    });
    if (matches.length > 1) {
      for (let i = 1; i < matches.length; i++) {
        const match = matches[i];
        const path = match.pathname;
        const segments = path.split("/").filter(Boolean);
        let label = segments[segments.length - 1] || "";
        label = label.replace(/-/g, " ");
        label = label.charAt(0).toUpperCase() + label.slice(1);

        items.push({
          label,
          path,
          isCurrentPage: i === matches.length - 1,
        });
      }
    }

    setBreadcrumbs(items);
  }, [matches]);
  const { setOpen, setOpenMobile } = useSidebar();

  const checkScreenSize = () => {
    return window.innerWidth <= 425;
  };

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 768) {
        setOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [setOpen]);

  // Fetch course version data (modules, sections, items)
  const { data: versionData, refetch: refetchVersion, isLoading } = useCourseVersionById(versionId || "");

  // fetch course data
  const { data: courseData } = useCourseById(courseId || "")

  // Some APIs return modules directly, some wrap in 'version'. Try both.
  // @ts-ignore
  const modules = (versionData as any)?.modules || (versionData as any)?.version?.modules || [];

  const [initialModules, setInitialModules] = useState<typeof modules[]>(modules);
  // Animated text for empty state
  const aiMessages = [
    "ViBe allows you to add sections in your course module using AI",
    "Generate engaging content with AI-powered tools",
    "Create quizzes and assessments with intelligent assistance",
    "Transform your teaching with AI-enhanced course creation"
  ];
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayedMessage, setDisplayedMessage] = useState(aiMessages[0]);
  const [isVisible, setIsVisible] = useState(true);
  const [selectedItem, setSelectedItem] = useState({ id: "", name: "" });

  // State for project modal
  const [showAddProjectModal, setShowAddProjectModal] = useState<{
    moduleId: string;
    sectionId: string;
  } | null>(null);

  const [errors, setErrors] = useState({
    title: "",
    description: "",
  });

  const [isEditingModule, setIsEditingModule] = useState(false);
  const [isEditingSection, setIsEditingSection] = useState(false);
  const [originalModuleData, setOriginalModuleData] = useState<ModuleData | null>(null);
  const [originalSectionData, setOriginalSectionData] = useState<{ name: string; description: string } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);


  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [hidingModuleId, setHidingModuleId] = useState<string | null>(null);
  const [hidingSectionId, setHidingSectionId] = useState<string | null>(null);
  const [hidingItemId, setHidingItemId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false); // fade out
      setTimeout(() => {
        const nextIndex = (currentTextIndex + 1) % aiMessages.length;
        setCurrentTextIndex(nextIndex);
        setDisplayedMessage(aiMessages[nextIndex]);
        setIsVisible(true); // fade in
      }, 400); // fade out duration
    }, 4000); // Change text every 4 seconds

    return () => clearInterval(interval);
  }, [currentTextIndex, aiMessages]);

  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [selectedEntity, setSelectedEntity] = useState<{
    type: "module" | "section" | "item";
    data: any;
    parentIds?: { moduleId: string; sectionId?: string; itemsGroupId?: string };
  } | null>(null);
  const [isEditingItem, setIsEditingItem] = useState(false);

  // Add this state for the add video modal
  const [showAddVideoModal, setShowAddVideoModal] = useState<{
    moduleId: string;
    sectionId: string;
  } | null>(null);

  // Add this state for the quiz wizard modal
  const [quizWizardOpen, setQuizWizardOpen] = useState(false);
  const [quizModuleId, setQuizModuleId] = useState<string>("");
  const [quizSectionId, setQuizSectionId] = useState<string>("");

  // Store items for each section
  const [sectionItems, setSectionItems] = useState<Record<string, any[]>>({});

  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

  // Check if a project already exists in any section
  const hasExistingProject = useMemo(() => {
    return Object.values(sectionItems).some(items =>
      items.some(item => item.type === 'PROJECT')
    );
  }, [sectionItems]);

  // Controlled state for ProjectItem edit mode
  const [projectEditName, setProjectEditName] = useState<string>('');
  const [projectEditDescription, setProjectEditDescription] = useState<string>('');

  // Track which section to fetch items for
  const [activeSectionInfo, setActiveSectionInfo] = useState<{ moduleId: string; sectionId: string } | null>(null);

  // Fetch items for the active section
  const shouldFetchItems = !!(activeSectionInfo?.moduleId && activeSectionInfo?.sectionId && versionId);
  const safeVersionId = versionId && versionId.trim() ? versionId : "SKIP";
  const safeModuleId = activeSectionInfo?.moduleId && activeSectionInfo.moduleId.trim() ? activeSectionInfo.moduleId : "SKIP";
  const safeSectionId = activeSectionInfo?.sectionId && activeSectionInfo.sectionId.trim() ? activeSectionInfo.sectionId : "SKIP";

  const {
    data: currentSectionItems,
    isLoading: itemsLoading,
    refetch: refetchItems
  } = useItemsBySectionId(
    safeVersionId,
    safeModuleId,
    safeSectionId
  );

  // Fetch item details for selected item
  const shouldFetchItem = selectedEntity?.type === 'item' && !!courseId && !!versionId && !!selectedEntity?.data?._id;
  const {
    data: selectedItemData,
    isLoading: isItemLoading,
    refetch: refetchItem
  } = useItemById(
    shouldFetchItem ? courseId : '',
    shouldFetchItem ? versionId : '',
    shouldFetchItem ? selectedEntity?.data?._id : ''
  );
  // Sync controlled state with selectedItemData for PROJECT edit
  useEffect(() => {
    if (selectedEntity?.type === 'item' && selectedEntity.data.type === 'PROJECT') {
      setProjectEditName(selectedItemData?.item?.name || '');
      setProjectEditDescription(selectedItemData?.item?.description || '');
    }
  }, [selectedEntity, selectedItemData]);

  const selectedQuizId = selectedEntity?.type === 'item' && selectedEntity?.data?.type === 'QUIZ' ? selectedEntity.data._id : null;

  const { data: quizDetails } = useQuizDetails(selectedQuizId);
  const { data: quizAnalytics } = useQuizAnalytics(selectedQuizId);
  // const { data: quizSubmissions } = useQuizSubmissions(selectedQuizId, selectedGradeStatus, sort, currentPage, limit);
  const { data: quizPerformance } = useQuizPerformance(selectedQuizId);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const toggleSection = (moduleId: string, sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
    setActiveSectionInfo({ moduleId, sectionId });
  };

  // CRUD hooks

  // --- MODULES ---
  const { mutateAsync: createModuleAsync, isSuccess: isCreateModuleSuccess, isError: isCreateModuleError, error: createModuleError, } = useCreateModule();
  const { mutateAsync: updateModuleAsync, isSuccess: isUpdateModuleSuccess, isError: isUpdateModuleError, error: updateModuleError } = useUpdateModule();
  const { mutateAsync: deleteModuleAsync, isSuccess: isDeleteModuleSuccess, isError: isDeleteModuleError, error: deleteModuleError } = useDeleteModule();
  const { mutateAsync: moveModuleAsync } = useMoveModule();
  const { mutateAsync: hideModuleAsync } = useHideModule();

  // --- SECTIONS ---
  const { mutateAsync: createSectionAsync, isSuccess: isCreateSectionSuccess, isError: isCreateSectionError, error: createSectionError } = useCreateSection();
  const { mutateAsync: updateSectionAsync, isSuccess: isUpdateSectionSuccess, isError: isUpdateSectionError, error: updateSectionError } = useUpdateSection();
  const { mutateAsync: deleteSectionAsync, isSuccess: isDeleteSectionSuccess, isError: isDeleteSectionError, error: deleteSectionError } = useDeleteSection();
  const { mutateAsync: moveSectionAsync } = useMoveSection();
  const { mutateAsync: hideSectionAsync } = useHideSection();

  // --- ITEMS ---
  const { mutateAsync: createItemAsync, isSuccess: isCreateItemSuccess, isError: isCreateItemError, error: createItemError } = useCreateItem();
  const { mutateAsync: updateItemAsync, isSuccess: isUpdateItemSuccess, isError: isUpdateItemError, error: updateItemError } = useUpdateItem();
  const { mutateAsync: updateCourseItemAsync } = useUpdateCourseItem();
  const { mutateAsync: updateVideoAsync } = useUpdateCourseItem();
  const { mutateAsync: deleteItemAsync, isSuccess: isDeleteItemSuccess, isError: isDeleteItemError, error: deleteItemError } = useDeleteItem();
  const { mutateAsync: moveItemAsync, isPending, isError: isMoveItemError, error: moveItemError } = useMoveItem();
  const { mutateAsync: updateItemVisibilityAsync } = useHideItem();

  const [isProcessingCSV, setIsProcessingCSV] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const userCSVtoItem = userParseCSVtoItems();


  const updateItemOptional = useUpdateItemOptional();

  // Refetch after any success
  useEffect(() => {
    if (
      isCreateModuleSuccess ||
      isUpdateModuleSuccess ||
      isDeleteModuleSuccess ||
      isCreateSectionSuccess ||
      isUpdateSectionSuccess ||
      isDeleteSectionSuccess ||
      isCreateItemSuccess ||
      isUpdateItemSuccess ||
      isDeleteItemSuccess
    ) {
      refetchVersion();
      if (shouldFetchItems) {
        refetchItems();
      }

      if (activeSectionInfo) {
        setActiveSectionInfo({ ...activeSectionInfo }); // triggers refetch
      }
    }
  }, [
    isCreateModuleSuccess,
    isUpdateModuleSuccess,
    isDeleteModuleSuccess,
    isCreateSectionSuccess,
    isUpdateSectionSuccess,
    isDeleteSectionSuccess,
    isCreateItemSuccess,
    isUpdateItemSuccess,
    isDeleteItemSuccess,
  ]);

  useStatusToasts({
    successFlags: {
      isCreateModuleSuccess: {
        flag: isCreateModuleSuccess,
        message: "Module created successfully!",
      },
      isUpdateModuleSuccess: {
        flag: isUpdateModuleSuccess,
        message: "Module updated successfully!",
      },
      isDeleteModuleSuccess: {
        flag: isDeleteModuleSuccess,
        message: "Module deleted successfully!",
      },
      isCreateSectionSuccess: {
        flag: isCreateSectionSuccess,
        message: "Section created successfully!",
      },
      isUpdateSectionSuccess: {
        flag: isUpdateSectionSuccess,
        message: "Section updated successfully!",
      },
      isDeleteSectionSuccess: {
        flag: isDeleteSectionSuccess,
        message: "Section deleted successfully!",
      },
      isCreateItemSuccess: {
        flag: isCreateItemSuccess,
        message: "Item created successfully!",
      },
      isUpdateItemSuccess: {
        flag: isUpdateItemSuccess,
        message: "Item updated successfully!",
      },
      isDeleteItemSuccess: {
        flag: isDeleteItemSuccess,
        message: "Item deleted successfully!",
      },
    },
    errorFlags: {
      // isCreateModuleError: {
      //   flag: isCreateModuleError,
      //   message: createModuleError?.response?.data?.message || createModuleError?.message,
      //   fallback: "Failed to create module",
      // },
      isUpdateModuleError: {
        flag: isUpdateModuleError,
        message: updateModuleError?.message,
        fallback: "Failed to update module",
      },
      isDeleteModuleError: {
        flag: isDeleteModuleError,
        message: deleteModuleError?.message,
        fallback: "Failed to delete module",
      },
      isCreateSectionError: {
        flag: isCreateSectionError,
        message: createSectionError?.toString(),
        fallback: "Failed to create section",
      },
      isUpdateSectionError: {
        flag: isUpdateSectionError,
        message: updateSectionError?.message,
        fallback: "Failed to update section",
      },
      isDeleteSectionError: {
        flag: isDeleteSectionError,
        message: deleteSectionError?.message,
        fallback: "Failed to delete section",
      },
      isCreateItemError: {
        flag: isCreateItemError,
        message: createItemError?.message,
        fallback: "Failed to create item",
      },
      isUpdateItemError: {
        flag: isUpdateItemError,
        message: updateItemError?.message,
        fallback: "Failed to update item",
      },
      isDeleteItemError: {
        flag: isDeleteItemError,
        message: deleteItemError?.message,
        fallback: "Failed to delete item",
      },
      isMoveItemError: {
        flag: isMoveItemError,
        message: moveItemError?.message,
        fallback: "Failed to move item",
      },
    },
  });


  // Reload items when quiz wizard closes
  useEffect(() => {
    if (!quizWizardOpen && quizModuleId && quizSectionId) {
      // Quiz wizard just closed, reload items for the section
      setActiveSectionInfo({ moduleId: quizModuleId, sectionId: quizSectionId });
      refetchVersion();
      if (shouldFetchItems) {
        refetchItems();
      }
    }
  }, [quizWizardOpen, quizModuleId, quizSectionId, refetchVersion, shouldFetchItems]);

  // Update sectionItems state when items are fetched
  useEffect(() => {
    if (
      shouldFetchItems &&
      activeSectionInfo?.sectionId &&
      currentSectionItems &&
      !itemsLoading
    ) {

      const itemsArray = (currentSectionItems as any)?.items || (Array.isArray(currentSectionItems) ? currentSectionItems : []);
      setSectionItems(prev => ({
        ...prev,
        [activeSectionInfo.sectionId]: itemsArray
      }));
    }
  }, [currentSectionItems, itemsLoading, activeSectionInfo, shouldFetchItems]);

  const getItemLabel = ({ itemId, itemType, sectionItems, sectionId }: LabelOptions): string => {
    const index = (sectionItems[sectionId] || [])
      .filter(i => i.type === itemType)
      .findIndex(i => i._id === itemId) + 1;

    switch (itemType) {
      case "VIDEO":
        return `Video ${index}`;
      case "QUIZ":
        return `Quiz ${index}`;
      case "BLOG":
        return `Article ${index}`;
      case "PROJECT":
        return `Project ${index}`;
      case 'FEEDBACK':
        return `Feedback ${index}`
      default:
        return "Unknown";
    }
  };

  // Add Module
  // const handleAddModule = () => {
  //   if (!versionId) return;
  //   createModuleAsync({
  //     params: { path: { versionId } },
  //     body: { name: "Untitled Module", description: "Module description" }
  //   }).then((res) => {
  //     refetchVersion();
  //     if (shouldFetchItems) {
  //       refetchItems();
  //     }
  //     setIsEditingModule(true);
  //     setOriginalModuleData({ name: "Untitled Module", description: "Module description" });
  //   });
  // };

  const handleAddModule = async () => {
    if (!versionId) return;

    try {
      await createModuleAsync({
        params: { path: { versionId } },
        body: {
          name: "Untitled Module",
          description: "Module description",
        },
      });

      } catch (error: any) {
        // Enhanced error message extraction for backend validation errors
        let message = "Failed to create module";
        
        if (error?.response?.data?.message) {
          message = error.response.data.message;
        } else if (error?.response?.data?.error) {
          message = error.response.data.error;
        } else if (error?.message) {
          message = error.message;
        } else if (typeof error === 'string') {
          message = error;
        }

        toast.error(message);
      }

      setIsEditingModule(true);
      setOriginalModuleData({
        name: "Untitled Module",
        description: "Module description",
      });

    
  };



  // Process CSV file and create items
  const processCSV = async (file: File, moduleId: string, sectionId: string, youtubeUrl: string) => {
    setIsProcessingCSV(true);
    try {
      setShowCSVUpload(false);
      const text = await file.text();
      const result = Papa.parse<CSVRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim()
      });

      // Validate CSV structure
      if (!result.data.length) {
        toast.error('CSV file is empty');
        return;
      }

      // Validate YouTube URL format
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
      if (!youtubeRegex.test(youtubeUrl)) {
        toast.error('Please provide a valid YouTube URL (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)');
        return;
      }

      // Validate required columns
      const requiredColumns = ['Segment', 'Question', 'Correct Answer'];
      const firstRow = result.data[0];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));

      if (missingColumns.length > 0) {
        toast.error(`Missing required columns: ${missingColumns.join(', ')}`);
        return;
      }


      const response = await userCSVtoItem.mutateAsync({
        params: { path: { courseId: courseId!, versionId: versionId!, moduleId, sectionId } },
        body: { youtubeurl: youtubeUrl, data: result.data }
      }).then((res) => {
        if (res.success) {
          toast.success('Successfully created items from CSV');
        }
        refetchVersion()
        refetchItems()
        setIsProcessingCSV(false);
      });
    } catch (error) {
      console.error('Error processing CSV:', error);
      toast.error(`Failed to process CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingCSV(false);
    }
  };



  // Handle file input change
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>, moduleId: string, sectionId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      processCSV(file, moduleId, sectionId, youtubeUrl);
    }
    // Reset the input
    e.target.value = '';
  };

  // Add Section
  const handleAddSection = (moduleId: string) => {
    if (!versionId) return;
    createSectionAsync({
      params: { path: { versionId, moduleId } },
      body: { name: "New Section", description: "Section description" }
    }).then((res) => {
      refetchVersion();
      if (shouldFetchItems) {
        refetchItems();
      }
    });
  };

  const handleHideModule = async (moduleId: string, hide: boolean) => {
    if (!versionId) return;
    setHidingModuleId(moduleId);
    try {
      await hideModuleAsync({
        params: { path: { versionId, moduleId } },
        body: { hide: hide }
      });
      refetchVersion();
    } finally {
      setHidingModuleId(null);
    }
  }

  const handleHideSection = async (moduleId: string, sectionId: string, hide: boolean) => {
    if (!versionId) return;
    setHidingSectionId(sectionId);
    try {
      await hideSectionAsync({
        params: { path: { versionId, moduleId, sectionId } },
        body: { hide: hide }
      });
      refetchVersion();
    } finally {
      setHidingSectionId(null);
    }
  }

  const handleHideItem = async (itemId: string, hide: boolean) => {
    if (!versionId) return;
    setHidingItemId(itemId);
    try {
      await updateItemVisibilityAsync({
        params: { path: { versionId, itemId } },
        body: { hide: hide }
      });

      refetchVersion();
      refetchItems();
    } catch (error) {
      console.error("❌ Error in handleHideItem:", error);
    } finally {
      setHidingItemId(null);
    }
  }

  // Add Item (handles all item types including video, quiz, article, and project)
  const handleAddItem = (moduleId: string, sectionId: string, type: string, videoData?: any) => {
    if (!versionId) return;

    type ItemType = "VIDEO" | "QUIZ" | "BLOG" | "PROJECT" | "FEEDBACK";
    const typeMap: Record<string, ItemType> = {
      video: "VIDEO",
      quiz: "QUIZ",
      article: "BLOG",
      project: "PROJECT",
      feedback: "FEEDBACK"
    };

    // Handle video items
    if (type === "VIDEO" && videoData) {
      createItemAsync({
        params: { path: { versionId, moduleId, sectionId } },
        body: {
          type: "VIDEO",
          name: videoData.name,
          description: videoData.description,
          videoDetails: {
            URL: videoData.details.URL,
            startTime: videoData.details.startTime,
            endTime: videoData.details.endTime,
            points: videoData.details.points,
          }
        }
      }).then((res) => {
        refetchVersion();
        if (shouldFetchItems) {
          refetchItems();
        }
        toast.success("Video created successfully");
      }).catch((error) => {
        console.error("Error creating video:", error);
        toast.error(`Failed to create video: ${error.message || 'Unknown error'}`);
      });

      return;
    }
    if (type === "QUIZ") {
      createItemAsync({
        params: {
          path: { versionId, moduleId, sectionId },
        },
        body: {
          type: typeMap[type],
          name: `New ${typeMap[type]}`,
          description: "Sample content",
        },
      }).then((res) => {
        refetchVersion();
        if (shouldFetchItems) {
          refetchItems();
        }
        toast.success("Quiz created successfully");
      }).catch((error) => {
        console.error("Error creating quiz:", error);
        toast.error(`Failed to create quiz: ${error.message || 'Unknown error'}`);
      });
    }
    if (type === "article") {
      createItemAsync({
        params: {
          path: { versionId, moduleId, sectionId },
        },
        body: {
          type: typeMap[type],
          name: `New ${typeMap[type]}`,
          description: "Sample content",
          blogDetails: {
            content: "Sample content",
            points: "2.0",
            estimatedReadTimeInMinutes: 1,
          },
        },
      }).then((res) => {
        refetchVersion();
        if (shouldFetchItems) {
          refetchItems();
        }
        toast.success("Article created successfully");
      }).catch((error) => {
        console.error("Error creating article:", error);
        toast.error(`Failed to create article: ${error.message || 'Unknown error'}`);
      });
    }
    if (type === "project") {
      createItem.mutate({
        params: { path: { versionId, moduleId, sectionId } },
        body: {
          type: typeMap[type], name: `New ${typeMap[type]}`,
          description: "Project description"
        }
      })
        .then(() => {
          refetchVersion();
          if (shouldFetchItems) {
            refetchItems();
          }
          toast.success("Project created successfully");
        })
        .catch((error) => {
          console.error("Error creating project:", error);
          toast.error(`Failed to create project: ${error.message || 'Unknown error'}`);
        });
    }
    if (type === "feedback") {
      createItemAsync({
        params: {
          path: {
            versionId: versionId!,
            moduleId: module.moduleId,
            sectionId: section.sectionId,
          },
        },
        body: {
          type: typeMap[type],
          name: "Feedback Form",
          description: "Submit your feedback about the previous video/quiz",
          feedbackFormDetails: {
            jsonSchema: {
              type: 'object',
              properties: {
                Name: {
                  type: 'string',
                  title: 'Name',
                  minLength: 1,
                },
                Email: {
                  type: 'string',
                  format: 'email',
                  title: 'Email',
                },
                Feedback: {
                  type: 'string',
                  title: 'Feedback',
                  minLength: 10
                },
              },
              required: ['Name', 'Email', 'Feedback'],
            },
            uiSchema: {
              Name: {
                'ui:placeholder': 'Enter your Name',
              },
              Email: {
                'ui:placeholder': 'Enter your Email',
              },
              Feedback: {
                'ui:placeholder': 'Enter your feedback here...',
              },
            }
          },
        }
      })
        .then((created) => {
          const newItem = created?.createdItem || created?.item || created?.data || created;
          const itemsGroupId = created?.itemsGroup?._id || section.itemsGroupId;

          if (newItem && newItem._id) {
            // Auto-select the newly created feedback form
            setSelectedItem({ id: newItem._id, name: "Feedback Form 1" });
            setSelectedEntity({
              type: "item",
              data: newItem,
              parentIds: {
                moduleId: module.moduleId,
                sectionId: section.sectionId,
                itemsGroupId,
              },
            });
          } else {
            refetchVersion();
            if (shouldFetchItems) {
              refetchItems();
            }
          }
        })
        .catch((err) => {
          toast.error("Failed to create feedback form");
          console.error(err);
        });
    }
    if (type === "csv_upload") {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = (e) => handleFileUpload(e as unknown as ChangeEvent<HTMLInputElement>, moduleId, sectionId);
      input.click();
    }
  };

  const navigate = useNavigate();

  // Interim state of modules
  const pendingOrder = useRef<typeof module[]>(modules);

  // Interim state of items
  const pendingOrderItems = useRef<typeof sectionItems>(sectionItems);

  // Move module
  const handleMoveModule = (moduleId: string, versionId?: string) => {

    const newList = pendingOrder.current;
    const newIndex = newList.findIndex((mod: any) => mod.moduleId === moduleId);

    const before = newList[newIndex + 1] || null;
    const after = newList[newIndex - 1] || null;


    if (versionId && moduleId) {
      moveModuleAsync({
        params: {
          path: {
            versionId,
            moduleId,
          },
        },
        body: {
          ...(before
            ? { beforeModuleId: before?.moduleId || "" }
            : { afterModuleId: after?.moduleId || "" }),


        },
      }).then((res) => {
        refetchVersion();
      })
    }
  }

  // Move section
  const handleMoveSection = (
    moduleId: string,
    sectionId: string,
    versionId: string
  ) => {
    const order = pendingOrder.current[moduleId];

    if (!order) return;

    const movedIndex = order.findIndex((s) => s.sectionId === sectionId);
    if (movedIndex === -1) return;

    const after = order[movedIndex - 1] || null;
    const before = order[movedIndex + 1] || null;

    moveSectionAsync({
      params: {
        path: {
          versionId,
          moduleId,
          sectionId,
        },
      },
      body: {
        ...(before
          ? { beforeSectionId: before.sectionId }
          : after
            ? { afterSectionId: after.sectionId }
            : {}),
      },
    }).then((res) => {
      refetchVersion();
    })
  };

  // Move item
  const handleMoveItem = async (
    moduleId: string,
    sectionId: string,
    itemId: string,
    versionId: string
  ) => {
    const order = pendingOrderItems.current[sectionId];
    if (!order) return;

    const movedIndex = order.findIndex((i) => i._id === itemId);
    if (movedIndex === -1) return;

    const after = order[movedIndex - 1] || null;
    const before = order[movedIndex + 1] || null;

    moveItemAsync({
      params: {
        path: {
          versionId,
          moduleId,
          sectionId,
          itemId,
        },
      },
      body: {
        ...(before
          ? { beforeItemId: before._id }
          : after
            ? { afterItemId: after._id }
            : {}),
      },
    }).then((res) => {
      if (shouldFetchItems) {
        refetchItems();
      }
    })

  };

  const handleConfirmDelete = async () => {
  if (!selectedEntity || !versionId) return;

  const { type, data, parentIds } = selectedEntity;

  try {
    if (type === "module") {
      await deleteModuleAsync({
        params: {
          path: {
            versionId,
            moduleId: data.moduleId,
          },
        },
      });

      setExpandedModules(prev => ({
        ...prev,
        [data.moduleId]: false,
      }));
      setIsEditingModule(false);
    }

    if (type === "section" && parentIds?.moduleId) {
      if (activeSectionInfo?.sectionId === data.sectionId) {
        setActiveSectionInfo(null);
      }

      await deleteSectionAsync({
        params: {
          path: {
            versionId,
            moduleId: parentIds.moduleId,
            sectionId: data.sectionId,
          },
        },
      });

      setExpandedSections(prev => ({
        ...prev,
        [data.sectionId]: false,
      }));
      setIsEditingSection(false);
    }

    refetchVersion();
    if (shouldFetchItems) refetchItems();
  } finally {
    setIsDeleteModalOpen(false);
    setSelectedEntity(null);
    setErrors({ title: "", description: "" });
  }
};



  useEffect(() => {
    if (modules.length > 0)
      setInitialModules(modules)
  }, [modules])

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">  
      {/* Show loading overlay when processing CSV */}
      {isProcessingCSV && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-xl flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-lg font-medium">Processing CSV file...</p>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
          </div>
        </div>
      )}
      {/* CSV Upload Modal */}
      {/* <Dialog open={showCSVUpload} onOpenChange={setShowCSVUpload}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Questions</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="youtube-url">YouTube Video URL</Label>
              <Input
                id="youtube-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The video that these questions are based on
              </p>
            </div>

            <div className="space-y-2">
              <Label>Questions CSV File</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    if (file.type === "text/csv" || file.name.endsWith('.csv')) {
                      setSelectedCSVFile(file);
                    } else {
                      toast.error("Please upload a valid CSV file");
                    }
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => document.getElementById('csv-upload')?.click()}
              >
                <div className="space-y-2">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CSV file with questions (max 10MB)
                  </p>
                  {selectedCSVFile && (
                    <p className="text-sm font-medium text-foreground mt-2">
                      Selected: {selectedCSVFile.name}
                    </p>
                  )}
                </div>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedCSVFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">CSV Format:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>First row should be the header with column names</li>
                <li>Required columns: Segment, Question, Option A, Option B, Option C, Option D, Correct Answer</li>
                <li>Segment: Numeric value to group questions</li>
                <li>Correct Answer: Should be A, B, C, or D</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCSVUpload(false);
                setYoutubeUrl('');
                setSelectedCSVFile(null);
              }}
              disabled={isProcessingCSV}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!youtubeUrl) {
                  toast.error("Please enter a YouTube URL");
                  return;
                }

                if (!selectedCSVFile) {
                  toast.error("Please select a CSV file");
                  return;
                }

                try {
                  setIsProcessingCSV(true);
                  await processCSV(selectedCSVFile, activeSectionInfo.moduleId, activeSectionInfo.sectionId, youtubeUrl);
                  toast.success("CSV uploaded and processed successfully!");
                  setShowCSVUpload(false);
                  setYoutubeUrl('');
                  setSelectedCSVFile(null);
                  refetchVersion();
                  if (shouldFetchItems) {
                    refetchItems();
                  }
                } catch (error) {
                  console.error("Error processing CSV:", error);
                  toast.error(error instanceof Error ? error.message : "Failed to process CSV");
                } finally {
                  setIsProcessingCSV(false);
                }
              }}
              disabled={!youtubeUrl || !selectedCSVFile || isProcessingCSV}
            >
              {isProcessingCSV ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog> */}
      <QuestionUploadDialog
        open={showCSVUpload}
        onOpenChange={setShowCSVUpload}
        onUploadComplete={async (youtubeUrl: string, csvFile: File) => {
          try {
            await processCSV(
              csvFile,
              activeSectionInfo?.moduleId,
              activeSectionInfo?.sectionId,
              youtubeUrl
            );
          } catch (error: any) {
            console.error("CSV Processing Error:", error);

            const message =
              error?.response?.data?.error ||
              error?.message ||
              "Failed to process uploaded data. Please try again.";
            toast.error(message);
          }
        }}
      />
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      <ResizablePanel
        defaultSize={20}
        minSize={20}
        maxSize={50}
        className={`${isMobileSidebarOpen ? 'fixed inset-y-0 left-0 z-50 w-[280px]' : 'hidden md:block'}`}
      >
        <div className="h-full overflow-hidden border-r border-border/40 bg-sidebar/50">
          <Sidebar variant="sidebar" collapsible="none" className="h-screen w-full">
            <SidebarHeader>
              <div className="flex items-center gap-3 px-3 py-2">
                <BookOpen className="text-primary" />
                <div>
                  <h1 className="text-base font-bold">Vibe (Teacher)</h1>
                  <p className="text-xs text-muted-foreground">Course Editor</p>
                </div>
              </div>
              <Separator className="opacity-50" />
            </SidebarHeader>

            <SidebarContent
              className="bg-card/50 pl-2"

            >
              <ScrollArea className="flex-1">
                <Reorder.Group
                  axis="y"
                  onReorder={(newOrder) => {
                    pendingOrder.current = newOrder;
                  }}
                  values={initialModules}
                >
                  <SidebarMenu className="space-y-2 text-sm pr-1 pt-2">
                    {initialModules
                      .slice()
                      .sort((a: any, b: any) => a.order.localeCompare(b.order))
                      .map((module: any) => (
                        <SidebarMenuItem key={module.moduleId}>
                          <Reorder.Item
                            key={module.moduleId}
                            value={module}
                            drag
                            className={module.isHidden ? "focus:outline-none opacity-60" : "focus:outline-none"}
                            whileDrag={{ scale: 1.02 }}
                            onDragEnd={() => {
                              setInitialModules(pendingOrder.current);
                              handleMoveModule(module.moduleId, versionId);
                            }}
                          >
                            <Button className="absolute top-0 right-0" size="icon" variant="ghost" onClick={(e) => handleHideModule(module.moduleId, !module.isHidden)} disabled={hidingModuleId === module.moduleId}>
                              {hidingModuleId === module.moduleId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : !module.isHidden ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                              <span className="sr-only">Hide Module</span>
                            </Button>
                            <SidebarMenuButton
                              onClick={() => {
                                toggleModule(module.moduleId);
                                setSelectedEntity({ type: "module", data: module });
                                setIsEditingModule(false);
                                setOriginalModuleData({
                                  name: module.name,
                                  description: module.description || ""
                                });
                              }}
                            >
                              <ChevronRight
                                className={`h-3.5 w-3.5 transition-transform ${expandedModules[module.moduleId] ? "rotate-90" : ""
                                  }`}
                              />
                              <span className="ml-2 max-w-[35ch] truncate" title={module.name}>{module.name}</span>
                            </SidebarMenuButton>
                          </Reorder.Item>

                          {expandedModules[module.moduleId] && (
                            <Reorder.Group
                              axis="y"
                              values={module.sections}
                              onReorder={(newSectionOrder) => {
                                pendingOrder.current[module.moduleId] = newSectionOrder;
                              }}
                            >
                              <SidebarMenuSub className="ml-2">
                                {module.sections?.map((section: any) => (
                                  <Reorder.Item
                                    key={section.sectionId}
                                    value={section}
                                    drag
                                    className={section.isHidden || module.isHidden ? "focus:outline-none opacity-60" : "focus:outline-none"}
                                    whileDrag={{ scale: 1.02 }}
                                    onDragEnd={() => {
                                      setInitialModules((prev) =>
                                        prev.map((mod) =>
                                          mod.moduleId === module.moduleId
                                            ? { ...mod, sections: pendingOrder.current[module.moduleId] }
                                            : mod
                                        )
                                      );
                                      handleMoveSection(module.moduleId, section.sectionId, versionId);
                                    }}
                                  >
                                    <SidebarMenuSubItem>
                                      <SidebarMenuSubButton
                                        onClick={() => {
                                          toggleSection(module.moduleId, section.sectionId);
                                          setSelectedEntity({
                                            type: "section",
                                            data: section,
                                            parentIds: { moduleId: module.moduleId },
                                          });
                                          setIsEditingSection(false);
                                          setOriginalSectionData({
                                            name: section.name,
                                            description: section.description || ""
                                          });
                                        }}
                                      >
                                        <ChevronRight
                                          className={`h-3 w-3 transition-transform ${expandedSections[section.sectionId] ? "rotate-90" : ""
                                            }`}
                                        />
                                        <span className="ml-2 truncate  max-w-[25ch] truncate block" title={section.name}
                                        >{section.name} </span>
                                      </SidebarMenuSubButton>
                                      <Button className="absolute top-0 right-0" size="icon" variant="ghost" onClick={(e) => handleHideSection(module.moduleId, section.sectionId, !section.isHidden)} disabled={module.isHidden || hidingSectionId === section.sectionId}>
                                        {hidingSectionId === section.sectionId ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : !section.isHidden ? (
                                          <Eye className="h-4 w-4" />
                                        ) : (
                                          <EyeOff className="h-4 w-4" />
                                        )}
                                        <span className="sr-only">Hide Section</span>
                                      </Button>

                                      {expandedSections[section.sectionId] && (
                                        <Reorder.Group
                                          axis="y"
                                          values={sectionItems[section.sectionId] || []}
                                          onReorder={(newItemOrder) => {
                                            pendingOrderItems.current[section.sectionId] = newItemOrder;
                                          }}
                                        >
                                          <SidebarMenuSub className="ml-4 space-y-1 pt-1">
                                            {itemsLoading && activeSectionInfo?.sectionId === section.sectionId ? (
                                              <div className="flex items-center justify-center py-4">
                                                <Loader />
                                              </div>
                                            ) : (sectionItems[section.sectionId] || [])
                                              .slice()
                                              .sort((a: any, b: any) => a.order.localeCompare(b.order))
                                              .map((item: any) => (
                                                <Reorder.Item
                                                  key={item._id}
                                                  value={item}
                                                  drag
                                                  className={section.isHidden || module.isHidden || item.isHidden ? "focus:outline-none opacity-60" : "focus:outline-none"}
                                                  whileDrag={{ scale: 1.02 }}
                                                  onDragEnd={() => {

                                                    setSectionItems((prev) => {
                                                      const items = pendingOrderItems.current[section.sectionId] || prev[section.sectionId];

                                                      // Sort by LexoRank-compatible `order` string
                                                      const sortedItems = [...items].sort((a, b) => a.order.localeCompare(b.order));

                                                      return {
                                                        ...prev,
                                                        [section.sectionId]: sortedItems
                                                      };
                                                    });

                                                    handleMoveItem(module.moduleId, section.sectionId, item._id, versionId);
                                                  }}
                                                >
                                                  <SidebarMenuSubItem key={item._id}>
                                                    <SidebarMenuSubButton
                                                      className={`justify-start ${selectedItem.name === getItemLabel({
                                                        itemId: item._id,
                                                        itemType: item.type,
                                                        sectionItems,
                                                        sectionId: section.sectionId
                                                      }) && selectedItem.id == item._id
                                                        ? "bg-zinc-600 text-gray-200"
                                                        : "bg-transparent transition-none"
                                                        }`}
                                                      onClick={() => {
                                                        const label = getItemLabel({
                                                          itemId: item._id,
                                                          itemType: item.type,
                                                          sectionItems,
                                                          sectionId: section.sectionId
                                                        });

                                                        setSelectedItem({ id: item._id, name: label });

                                                        // Patch: For PROJECT, ensure name/description are always present at root
                                                        let patchedItem = item;
                                                        if (item.type === 'PROJECT') {
                                                          const details = item.details || {};
                                                          const name = (details.name && details.name.trim()) ? details.name : (item.name || '');
                                                          const description = (details.description && details.description.trim()) ? details.description : (item.description || '');
                                                          patchedItem = {
                                                            ...item,
                                                            name,
                                                            description
                                                          };
                                                        }
                                                        setSelectedEntity({
                                                          type: "item",
                                                          data: patchedItem,
                                                          parentIds: {
                                                            moduleId: module.moduleId,
                                                            sectionId: section.sectionId,
                                                            itemsGroupId: section.itemsGroupId,
                                                          },
                                                        });

                                                        if (checkScreenSize() && (item.type === 'VIDEO' || item.type === 'QUIZ' || item.type === 'BLOG')) {
                                                          setOpenMobile(false);
                                                          setOpen(false);
                                                        }
                                                      }
                                                      }
                                                    >
                                                      {getItemIcon(item.type)}
                                                      <span className={`ml-1 text-xs ${selectedItem.name === getItemLabel({
                                                        itemId: item._id,
                                                        itemType: item.type,
                                                        sectionItems,
                                                        sectionId: section.sectionId
                                                      }) && selectedItem.id == item._id
                                                        ? "text-gray-200"
                                                        : "text-muted-foreground"
                                                        }`}>
                                                        {getItemLabel({
                                                          itemId: item._id,
                                                          itemType: item.type,
                                                          sectionItems,
                                                          sectionId: section.sectionId
                                                        })}
                                                      </span>
                                                    </SidebarMenuSubButton>
                                                    <Button className="absolute  top-0 right-0" size="icon" variant="ghost" onClick={(e) => handleHideItem(item._id, !item.isHidden)} disabled={section.isHidden || module.isHidden || hidingItemId === item._id}>
                                                      {hidingItemId === item._id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                      ) : !item.isHidden ? (
                                                        <Eye className={`h-4 w-4 ${selectedItem.id == item._id
                                                        ? "text-gray-200"
                                                        : "text-muted-foreground"}` } />
                                                      ) : (
                                                        <EyeOff className={`h-4 w-4 ${selectedItem.id == item._id
                                                        ? "text-gray-200"
                                                        : "text-muted-foreground"}` } />
                                                      )}
                                                      <span className="sr-only">Hide Item</span>
                                                    </Button>
                                                  </SidebarMenuSubItem>
                                                </Reorder.Item>
                                              ))}
                                            <div className="ml-6 mt-2">

                                              <select

                                                className="text-xs border rounded px-2 py-1 bg-background text-foreground"

                                                defaultValue=""

                                                disabled={module.isHidden || section.isHidden}

                                                onChange={(e) => {

                                                  const type = e.target.value;

                                                  if (type) {

                                                    if (type === "VIDEO") {

                                                      setShowAddVideoModal({

                                                        moduleId: module.moduleId,

                                                        sectionId: section.sectionId,

                                                      });

                                                    } else if (type === "quiz") {

                                                      setQuizModuleId(module.moduleId);

                                                      setQuizSectionId(section.sectionId);

                                                      // Update course store with current context

                                                      if (currentCourse) {

                                                        setCurrentCourse({

                                                          ...currentCourse,

                                                          moduleId: module.moduleId,

                                                          sectionId: section.sectionId

                                                        });

                                                      }

                                                      setQuizWizardOpen(true);


                                                    }
                                                    else if (type === "project") {

                                                      createItemAsync({
                                                        params: {
                                                          path: {
                                                            versionId: versionId!,
                                                            moduleId: module.moduleId,
                                                            sectionId: section.sectionId,
                                                          },
                                                        },
                                                        body: {
                                                          type: "PROJECT",
                                                          name: `Project name`,
                                                          description: `Project description`
                                                        },
                                                      })
                                                        .then((created) => {
                                                          const newItem = created?.createdItem || created?.item || created?.data || created;
                                                          const itemsGroupId = created?.itemsGroup?._id || section.itemsGroupId;

                                                          if (newItem && newItem._id) {
                                                            setSelectedItem({ id: newItem._id, name: newItem.name });
                                                            setSelectedEntity({
                                                              type: "item",
                                                              data: newItem,
                                                              parentIds: {
                                                                moduleId: module.moduleId,
                                                                sectionId: section.sectionId,
                                                                itemsGroupId,
                                                              },
                                                            });
                                                          } else {
                                                            refetchVersion();
                                                            if (shouldFetchItems) {
                                                              refetchItems();
                                                            }
                                                          }
                                                        });
                                                    }
                                                    else if (type === "feedback") {
                                                      createItemAsync({
                                                        params: {
                                                          path: {
                                                            versionId: versionId!,
                                                            moduleId: module.moduleId,
                                                            sectionId: section.sectionId,
                                                          },
                                                        },
                                                        body: {
                                                          type: "FEEDBACK",
                                                          name: "Feedback Form",
                                                          description: "Submit your feedback about the previous video/quiz",
                                                          feedbackFormDetails: {
                                                            jsonSchema: {
                                                              type: 'object',
                                                              properties: {
                                                                Name: {
                                                                  type: 'string',
                                                                  title: 'Name',
                                                                  minLength: 1,
                                                                },
                                                                Email: {
                                                                  type: 'string',
                                                                  format: 'email',
                                                                  title: 'Email',
                                                                },
                                                                Feedback: {
                                                                  type: 'string',
                                                                  title: 'Feedback',
                                                                  minLength: 10
                                                                },
                                                              },
                                                              required: ['Name', 'Email', 'Feedback'],
                                                            },
                                                            uiSchema: {
                                                              Name: {
                                                                'ui:placeholder': 'Enter your Name',
                                                              },
                                                              Email: {
                                                                'ui:placeholder': 'Enter your Email',
                                                              },
                                                              Feedback: {
                                                                'ui:placeholder': 'Enter your feedback here...',
                                                                'ui:widget': 'textarea',
                                                              },
                                                            }
                                                          },
                                                        }
                                                      })
                                                        .then((created) => {
                                                          const newItem = created?.createdItem || created?.item || created?.data || created;
                                                          const itemsGroupId = created?.itemsGroup?._id || section.itemsGroupId;

                                                          if (newItem && newItem._id) {
                                                            // Auto-select the newly created feedback form
                                                            setSelectedItem({ id: newItem._id, name: "Feedback Form 1" });
                                                            setSelectedEntity({
                                                              type: "item",
                                                              data: newItem,
                                                              parentIds: {
                                                                moduleId: module.moduleId,
                                                                sectionId: section.sectionId,
                                                                itemsGroupId,
                                                              },
                                                            });
                                                          } else {
                                                            refetchVersion();
                                                            if (shouldFetchItems) {
                                                              refetchItems();
                                                            }
                                                          }
                                                        })
                                                        .catch((err) => {
                                                          toast.error("Failed to create feedback form");
                                                          console.error(err);
                                                        });
                                                    }
                                                    else if (type === "csv_upload") {
                                                      setActiveSectionInfo({ moduleId: module.moduleId, sectionId: section.sectionId });
                                                      setShowCSVUpload(true);
                                                    }
                                                    else {
                                                      setActiveSectionInfo({ moduleId: module.moduleId, sectionId: section.sectionId });
                                                      handleAddItem(module.moduleId, section.sectionId, type);

                                                    }

                                                    e.target.value = "";

                                                  }

                                                }}

                                              >

                                                <option value="" disabled>Add Item</option>

                                                <option value="article">Article</option>

                                                <option value="VIDEO">Video</option>

                                                <option value="quiz">Quiz</option>

                                                <option value="feedback">Feedback Form</option>

                                                <option
                                                  value="project"
                                                  disabled={hasExistingProject}
                                                  className={hasExistingProject ? 'text-gray-400' : ''}
                                                >
                                                  {hasExistingProject ? 'Project (Limit 1 per course)' : 'Project'}
                                                </option>
                                                <option value="csv_upload">Upload CSV</option>

                                              </select>
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <DropdownMenu>
                                                      <DropdownMenuTrigger asChild>
                                                        <Button
                                                          type="button"
                                                          className="inline-flex items-center justify-center px-1.5 py-0 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold text-[10px] gap-0.5 shadow transition-all duration-200 hover:scale-105 hover:shadow-lg hover:from-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-purple-400 ml-3"
                                                          style={{ minWidth: 'unset', height: '1.5rem' }}
                                                        >
                                                          <Sparkles className="h-2 w-2" />
                                                          <span>AI</span>
                                                        </Button>
                                                      </DropdownMenuTrigger>
                                                      <DropdownMenuContent align="start" className="w-40">
                                                        <DropdownMenuItem
                                                          className="text-xs cursor-pointer"
                                                          onClick={() => {
                                                            setCurrentCourse({
                                                              courseId,
                                                              versionId,
                                                              moduleId: module.moduleId,
                                                              sectionId: section.sectionId,
                                                              itemId: null,
                                                              watchItemId: null,
                                                            });
                                                            setMode('custom')
                                                            // navigate({ to: '/teacher/ai-section' });
                                                          }}
                                                        >
                                                          Custom mode
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                          className="text-xs cursor-pointer"
                                                          onClick={() => {
                                                            setCurrentCourse({
                                                              courseId,
                                                              versionId,
                                                              moduleId: module.moduleId,
                                                              sectionId: section.sectionId,
                                                              itemId: null,
                                                              watchItemId: null,
                                                            });
                                                            setMode('wizard')
                                                            // navigate({ to: '/teacher/ai-workflow' });
                                                          }}
                                                        >
                                                          Wizard mode
                                                        </DropdownMenuItem>
                                                      </DropdownMenuContent>
                                                    </DropdownMenu>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" align="center">
                                                    Generate Section with AI
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            </div>

                                          </SidebarMenuSub>
                                        </Reorder.Group>
                                      )}
                                    </SidebarMenuSubItem>
                                  </Reorder.Item>
                                ))}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="ml-4 mt-2 w-[220px] h-6 text-xs"
                                  onClick={() => handleAddSection(module.moduleId)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Section
                                </Button>
                              </SidebarMenuSub>
                            </Reorder.Group>
                          )}
                        </SidebarMenuItem>
                      ))}

                    <div className="px-2 pt-3">
                      <Button size="sm" className="w-[250px]  text-xs" onClick={handleAddModule}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add Module
                      </Button>
                    </div>
                  </SidebarMenu>
                </Reorder.Group>


              </ScrollArea>
            </SidebarContent>
            <SidebarFooter className="border-t border-border/40 bg-gradient-to-t from-sidebar/80 to-sidebar/60">
              <SidebarMenu className="space-y-1 pl-2 py-3">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="h-9 px-3 w-full rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/5 hover:shadow-sm"
                  >
                    <Link to="/teacher" className="flex items-center gap-3">
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
                    <Link to="/teacher" className="flex items-center gap-3">
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
                    <Link to="/teacher/profile" className="flex items-center gap-3">
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
        </div>
      </ResizablePanel>




      {/* Side bar till herer  */}





      <ResizableHandle className="hidden md:flex" />
      
      <ResizablePanel defaultSize={80} className="min-w-0">
        {/* Course Editor Area */}
        <SidebarInset className="max-w-full overflow-hidden flex flex-col">
              <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear sticky top-0 z-50 bg-background">
                            <div className="flex w-full items-center justify-between px-4">
                              <div className="flex items-center gap-2">
                                <SidebarTrigger className="-ml-1" />
                                <Separator orientation="vertical" className="mx-2 h-4" />
                  
                                <Breadcrumb className="hidden md:flex">
                                  <BreadcrumbList>
                                 
                                    {breadcrumbs.map((item, index) => (
                                      <React.Fragment key={index}>
                                      
                                        {index > 0 && breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                                        <BreadcrumbItem>
                                          {item.isCurrentPage ? (
                                            <BreadcrumbPage className="lg:flex md:hidden">{item.label}</BreadcrumbPage>
                                          ) : (
                                            <BreadcrumbLink href={item.path} asChild>
                                              <Link to={item.path}>{item.label}</Link>
                                            </BreadcrumbLink>
                                          )}
                                        </BreadcrumbItem>
                                      </React.Fragment>
                                    ))}
                                  </BreadcrumbList>
                                </Breadcrumb>
                              </div>
                  
                              <div className="flex items-center gap-3">
                  
                                <div className="relative"  ref={invitesRef}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowInvites((prev) => !prev)}
                                   className="relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                                  >
                                    <UserRoundCheck className="h-4 w-4" />
                                    <span className="hidden sm:block ml-2">Invites</span>
                                  </Button>
                  
                                  {showInvites && <InviteDropdown setPendingInvites={setPendingInvites} pendingInvites={pendingInvites} />}
                                </div>
                  
                                <ConfirmationModal isOpen={confirmLogout} 
                                    onClose={()=>setConfirmLogout(false)} 
                                    onConfirm={handleLogout} 
                                    title={`Confirm Logout`}
                                    description="Are you sure you want to log out? You will need to sign in again to access your dashboard."
                                  />
                  
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={()=>setConfirmLogout(true)}
                                   className="relative  h-10 px-4 text-sm font-medium transition-all duration-300  hover:text-red-600 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 hover:shadow-red-500/10 dark:hover:text-red-400  dark:hover:bg-gradient-to-r dark:over:from-red-500/10 dark:hover:to-red-400/5"
                                >
                                  <LogOut className="h-4 w-4" />
                                  <span className="hidden sm:block ml-2">Logout</span>
                                </Button>
                  
                                <ThemeToggle />
                  
                                <Link to="/teacher/profile" className="group relative">
                                  <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-primary/10 via-transparent to-secondary/10 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110 blur-sm" />
                                  <Avatar className="relative h-9 w-9 cursor-pointer border-2 border-transparent transition-all duration-300 group-hover:border-primary/20 group-hover:shadow-xl group-hover:shadow-primary/20 group-hover:scale-105">
                                    <AvatarImage
                                      src={user?.avatar || "/placeholder.svg"}
                                      alt={user?.name}
                                      className="transition-all duration-300"
                                    />
                                    <AvatarFallback className="bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 text-primary font-bold text-sm transition-all duration-300 group-hover:from-primary/25 group-hover:to-primary/10">
                                      {user?.name?.charAt(0).toUpperCase() || "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                </Link>
                              </div>
                            </div>
                          </header>
          <div className="w-full p-4 sm:p-6">
            {mode === "default" &&  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                  className="md:hidden shrink-0"
                >
                  <Menu className="h-7 w-7" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>

                <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border min-w-0 flex-1 sm:flex-none sm:min-w-[200px]">
                  <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Course</p>
                    <h2 className="text-sm font-medium leading-tight truncate">
                      {isLoading ? (
                        <span className="inline-block h-4 w-32 bg-muted rounded animate-pulse"></span>
                      ) : (
                        courseData?.name || 'Untitled Course'
                      )}
                    </h2>
                  </div>
                </div>
              </div>

              {versionData && (
                <div className="flex items-center">
                  <Badge
                    variant="outline"
                    className="bg-primary/10 border-primary/20 text-primary px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap"
                  >
                    Version: {(versionData as any)?.version || (versionData as any)?.name || 'Unknown'}
                  </Badge>
                </div>
              )}
            </div>}
           
            {mode === "wizard" ? (
              <AiWorkflow/>
            ) : mode === "custom" ? (
              <AISectionPage/>
            ) : (
                selectedEntity ? (
              <div className="bg-white dark:bg-background rounded-2xl shadow-lg border border-slate-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 md:p-6 lg:p-8">
                  {/* Header with breadcrumb */}
                  <div className="mb-6 pb-4 border-b border-slate-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900 dark:text-gray-100">
                        {selectedEntity.data?.name}
                      </h2>
                      <div className="flex items-center gap-2">
                        {selectedEntity.type === "item" && (
                          // <div className="items-center gap-2 bg-muted/40 px-2 py-1 rounded-md border text-sm">
                          //   <div className="flex items-center justify-center gap-1.5">
                          //     <Switch
                          //       id={`optional-${selectedItemData?.item?._id}`}
                          //       checked={selectedItemData?.item?.isOptional || false}
                          //       disabled={updateItemOptional.isPending && togglingItemId === selectedItemData?.item?._id}
                          //       onCheckedChange={async (checked) => {
                          //         if (versionId && selectedItemData?.item?._id) {
                          //           setTogglingItemId(selectedItemData.item._id);
                          //           try {
                          //             await updateItemOptional.mutateAsync({
                          //               params: {
                          //                 path: {
                          //                   versionId: versionId,
                          //                   itemId: selectedEntity?.data?._id
                          //                 }
                          //               },
                          //               body: { isOptional: checked }
                          //             });
                          //             refetchItem();
                          //           } catch (error) {
                          //             toast.error('Failed to update item optional status');
                          //           } finally {
                          //             setTogglingItemId(null);
                          //           }
                          //         }
                          //       }}
                          //       className={cn(
                          //         "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
                          //         "h-4 w-8",
                          //         "relative",
                          //         "cursor-pointer",
                          //         updateItemOptional.isPending && togglingItemId === selectedItemData?.item?._id
                          //           ? "opacity-70"
                          //           : "opacity-100"
                          //       )}
                          //     >
                          //       {(updateItemOptional.isPending || togglingItemId === selectedItemData?.item?._id) && (
                          //         <Loader2 className="h-2 w-2 animate-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-foreground" />
                          //       )}
                          //     </Switch>
                          //     <Label
                          //       htmlFor={`optional-${selectedEntity?.data?._id}`}
                          //       className="text-lg text-white cursor-pointer"
                          //       title="Students can skip this item if enabled"
                          //     >
                          //       Optional
                          //     </Label>
                          //   </div>
                          //   <div>
                          //     <p className="text-[10px] text-muted-foreground/80">Students can skip this item if enabled</p>
                          //   </div>
                          // </div>
                          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-card">
                            <Switch
                              id={`optional-${selectedItemData?.item?._id}`}
                              checked={selectedItemData?.item?.isOptional || false}
                              disabled={updateItemOptional.isPending && togglingItemId === selectedItemData?.item?._id}
                              onCheckedChange={async (checked) => {
                                if (versionId && selectedItemData?.item?._id) {
                                  setTogglingItemId(selectedItemData.item._id);
                                  try {
                                    await updateItemOptional.mutateAsync({
                                      params: {
                                        path: {
                                          versionId: versionId,
                                          itemId: selectedEntity?.data?._id
                                        }
                                      },
                                      body: { isOptional: checked }
                                    });
                                    refetchItem();
                                  } catch (error) {
                                    toast.error('Failed to update item optional status');
                                  } finally {
                                    setTogglingItemId(null);
                                  }
                                }
                              }}
                              className={cn(
                                "data-[state=checked]:bg-primary",
                                updateItemOptional.isPending && togglingItemId === selectedItemData?.item?._id
                                  ? "opacity-50"
                                  : ""
                              )}
                            >
                              {(updateItemOptional.isPending || togglingItemId === selectedItemData?.item?._id) && (
                                <Loader2 className="h-3 w-3 animate-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                              )}
                            </Switch>
                            <div className="flex flex-col gap-0.5">
                              <Label
                                htmlFor={`optional-${selectedEntity?.data?._id}`}
                                className="text-sm font-medium cursor-pointer leading-none"
                              >
                                Optional
                              </Label>
                              <p className="text-xs text-muted-foreground">Students can skip this item</p>
                            </div>
                          </div>
                        )}
                        {/* <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">
                          {selectedEntity.type.charAt(0).toUpperCase() + selectedEntity.type.slice(1)}
                        </Badge> */}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      <span>Course › Module › {selectedEntity.type}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-3">
                    {(selectedEntity.type !== "item") && (
                      <>
                        <Label className="text-sm font-bold text-foreground">Title *</Label>
                        <Input
                          value={
                            selectedEntity.type === "item"
                              ? selectedItemData?.item?.name ?? ""
                              : selectedEntity.data?.name ?? ""
                          }
                          disabled={
                            (selectedEntity.type === "module" && !isEditingModule) ||
                            (selectedEntity.type === "section" && !isEditingSection)
                          }
                          onChange={e => {
                            const value = e.target.value;
                            setSelectedEntity({
                              ...selectedEntity,
                              data: { ...selectedEntity.data, name: value }
                            })
                            if (selectedEntity.type === "module") {
                              if (!value.trim()) {
                                setErrors(errors => ({ ...errors, title: "Module name is required." }));
                              } else {
                                setErrors(errors => ({ ...errors, title: "" }));
                              }
                            }
                            if (selectedEntity.type === "section") {
                              if (!value.trim()) {
                                setErrors(errors => ({ ...errors, title: "Section name is required." }));
                              } else {
                                setErrors(errors => ({ ...errors, title: "" }));
                              }
                            }
                          }
                          }
                        />
                        {errors.title && (
                          <div className="text-xs text-red-500">{errors.title}</div>
                        )}
                      </>
                    )}

                    {(selectedEntity.type === "module" || selectedEntity.type === "section") && (
                      <div className="flex gap-6 text-xs text-muted-foreground">
                        <div>
                          <span className="font-semibold">Created:</span>{" "}
                          {selectedEntity.data?.createdAt
                            ? new Date(selectedEntity.data.createdAt).toLocaleString()
                            : "N/A"}
                        </div>
                        <div>
                          <span className="font-semibold">Updated:</span>{" "}
                          {selectedEntity.data?.updatedAt
                            ? new Date(selectedEntity.data.updatedAt).toLocaleString()
                            : "N/A"}
                        </div>
                      </div>
                    )}

                    {(selectedEntity.type !== "item") && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm font-bold text-foreground">Description *</Label>
                          <div className="relative">
                            <textarea
                              value={
                                selectedEntity.type === "item"
                                  ? selectedItemData?.item?.description ?? ""
                                  : selectedEntity.data?.description ?? ""
                              }
                              disabled={
                                (selectedEntity.type === "module" && !isEditingModule) ||
                                (selectedEntity.type === "section" && !isEditingSection)
                              }
                              onChange={e => {
                                const value = e.target.value;

                                // Only update if within limit or deleting characters
                                if (value.length <= MAX_DESCRIPTION_LENGTH) {
                                  setSelectedEntity({
                                    ...selectedEntity,
                                    data: { ...selectedEntity.data, description: value }
                                  });
                                }

                                // Validation
                                if (selectedEntity.type === "module") {
                                  if (!value.trim()) {
                                    setErrors(errors => ({ ...errors, description: "Module description is required." }));
                                  } else if (value.length >= MAX_DESCRIPTION_LENGTH) {
                                    setErrors(errors => ({ ...errors, description: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.` }));
                                  } else {
                                    setErrors(errors => ({ ...errors, description: "" }));
                                  }
                                }
                                if (selectedEntity.type === "section") {
                                  if (!value.trim()) {
                                    setErrors(errors => ({ ...errors, description: "Section description is required." }));
                                  } else if (value.length >= MAX_DESCRIPTION_LENGTH) {
                                    setErrors(errors => ({ ...errors, description: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.` }));
                                  } else {
                                    setErrors(errors => ({ ...errors, description: "" }));
                                  }
                                }
                              }}
                              placeholder={`Description (max ${MAX_DESCRIPTION_LENGTH} characters)`}
                              rows={5}
                              maxLength={MAX_DESCRIPTION_LENGTH}
                              className={`w-full rounded border px-3 py-2 pr-16 text-sm ${(selectedEntity.type === "module" && !isEditingModule) ||
                                (selectedEntity.type === "section" && !isEditingSection)
                                ? 'bg-muted/50 border-transparent'
                                : ''
                                }`}
                            />
                            <div className={`absolute bottom-2 right-2 text-xs ${(selectedEntity.data?.description?.length || 0) >= (MAX_DESCRIPTION_LENGTH * 0.9)
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                              }`}>
                              {selectedEntity.data?.description?.length || 0}/{MAX_DESCRIPTION_LENGTH}
                            </div>
                          </div>
                          {errors.description && (
                            <div className="text-xs text-red-500">{errors.description}</div>
                          )}
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      {(selectedEntity.type === "module" || selectedEntity.type === "section") && (
                        <Button
                          onClick={() => {
                            const moduleName = selectedEntity.data.name?.trim();
                            const moduleDescription = selectedEntity.data.description?.trim() ?? "";
                            const sectionName = selectedEntity.data.name?.trim();
                            const sectionDescription = selectedEntity.data.description?.trim() ?? "";
                            if (selectedEntity.type === "module") {
                              if (!isEditingModule) {
                                setIsEditingModule(true);
                                setOriginalModuleData({
                                  name: selectedEntity.data.name,
                                  description: selectedEntity.data.description || ""
                                });
                                return;
                              }

                              const moduleName = selectedEntity.data.name?.trim();
                              const moduleDescription = selectedEntity.data.description?.trim() ?? "";
                              if (!moduleName || !moduleDescription) {
                                setErrors({
                                  title: !moduleName ? "Module name is required." : "",
                                  description: !moduleDescription
                                    ? "Module description is required."
                                    : moduleDescription.length >= MAX_DESCRIPTION_LENGTH
                                      ? `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`
                                      : ""
                                });
                                return;
                              }

                              setErrors({ title: "", description: "" });
                              if (versionId) {
                                updateModuleAsync({
                                  params: { path: { versionId, moduleId: selectedEntity.data.moduleId } },
                                  body: {
                                    name: selectedEntity.data.name,
                                    description: selectedEntity.data.description || ""
                                  }
                                }).then((res) => {
                                  refetchVersion();
                                  if (shouldFetchItems) {
                                    refetchItems();
                                  }
                                  setIsEditingModule(false);
                                });
                              }
                              return;
                            }

                            if (selectedEntity.type === "section") {
                              if (!isEditingSection) {
                                setIsEditingSection(true);
                                setOriginalSectionData({
                                  name: selectedEntity.data.name,
                                  description: selectedEntity.data.description || ""
                                });
                                return;
                              }
                              const sectionName = selectedEntity.data.name?.trim();
                              const sectionDescription = selectedEntity.data.description?.trim() ?? "";

                              if (!sectionName || !sectionDescription) {
                                setErrors({
                                  title: !sectionName ? "Section name is required." : "",
                                  description: !sectionDescription
                                    ? "Section description is required."
                                    : sectionDescription.length >= MAX_DESCRIPTION_LENGTH
                                      ? `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`
                                      : ""
                                });
                                return;
                              }
                            }
                            setErrors({ title: "", description: "" });
                            if (selectedEntity.type === "section" && versionId && selectedEntity.parentIds?.moduleId) {
                              updateSectionAsync({
                                params: {
                                  path: {
                                    versionId,
                                    moduleId: selectedEntity.parentIds.moduleId,
                                    sectionId: selectedEntity.data.sectionId
                                  }
                                },
                                body: {
                                  name: selectedEntity.data.name,
                                  description: selectedEntity.data.description || ""
                                }
                              }).then((res) => {
                                refetchVersion();
                                if (shouldFetchItems) {
                                  refetchItems();
                                }
                                setIsEditingSection(false);
                              });
                            }
                            if (selectedEntity.type === "item" && versionId && selectedEntity.parentIds?.moduleId && selectedEntity.parentIds?.sectionId) {
                              updateItemAsync({
                                params: {
                                  path: {
                                    versionId,
                                    moduleId: selectedEntity.parentIds.moduleId,
                                    sectionId: selectedEntity.parentIds.sectionId,
                                    itemId: selectedEntity.data._id
                                  }
                                },
                                body: {
                                  name: selectedEntity.data.name,
                                  description: selectedEntity.data.description || ""
                                }
                              }).then((res) => {
                                refetchVersion();
                                refetchItems(); refetchItem()
                              });
                            }
                          }}
                          className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300"
                        >
                          {selectedEntity.type === "module"
                            ? (isEditingModule ? 'Save Changes' : `Update ${selectedEntity.type}`)
                            : (isEditingSection ? 'Save Changes' : `Update ${selectedEntity.type}`)}
                        </Button>
                      )}

                      {((selectedEntity.type === "module" && isEditingModule) || (selectedEntity.type === "section" && isEditingSection)) && (
                        <Button
                          variant="outline"
                          className="border-border bg-background"
                          onClick={() => {
                            if (selectedEntity.type === 'module' && originalModuleData) {
                              setSelectedEntity({
                                ...selectedEntity,
                                data: {
                                  ...selectedEntity.data,
                                  name: originalModuleData.name,
                                  description: originalModuleData.description
                                }
                              });
                              setIsEditingModule(false);
                            } else if (selectedEntity.type === 'section' && originalSectionData) {
                              setSelectedEntity({
                                ...selectedEntity,
                                data: {
                                  ...selectedEntity.data,
                                  name: originalSectionData.name,
                                  description: originalSectionData.description
                                }
                              });
                              setIsEditingSection(false);
                            }
                            setErrors({ title: "", description: "" });
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      
                      {(selectedEntity?.type === "module" || selectedEntity?.type === "section") && (
                            <Button
                              variant="outline"
                              className="border-border bg-background"
                              onClick={() => setIsDeleteModalOpen(true)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Delete {selectedEntity.type}
                            </Button>
                          )}
                    </div>
                    <div className="relative group">

                      <ConfirmationModal
                        isOpen={isDeleteModalOpen}
                        onClose={() => setIsDeleteModalOpen(false)}
                        onConfirm={handleConfirmDelete}
                        title={
                          selectedEntity?.type === "module"
                            ? "Delete Module"
                            : "Delete Section"
                        }
                        description={
                          selectedEntity?.type === "module"
                            ? "This will delete this module and all its sections/items. Are you sure?"
                            : "This will delete this section and all its items. Are you sure?"
                        }
                        confirmText="Delete"
                        cancelText="Cancel"
                        isDestructive
                        // isLoading={isDeleting}
                        loadingText="Deleting..."
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                     </div>

                    

                    {selectedEntity.type === "item" && selectedEntity.data.type === "VIDEO" && (

                      <VideoModal
                        isLoading={isItemLoading}
                        selectedItemName={selectedItem.name}
                        action={isEditingItem ? "edit" : "view"}
                        item={selectedItemData?.item}
                        onClose={() => setIsEditingItem(false)}
                        onSave={video => {
                          const formattedVideo = {
                            ...video,
                            type: "VIDEO",
                            details: {
                              ...video.details,
                              startTime: video.details.startTime,
                              endTime: video.details.endTime,
                            }
                          };
                          if (
                            selectedEntity.parentIds?.moduleId &&
                            selectedEntity.parentIds?.sectionId &&
                            selectedEntity.data?._id &&
                            versionId
                          ) {
                            updateVideoAsync({
                              params: {
                                path: {
                                  versionId,
                                  itemId: selectedEntity.data._id,
                                }
                              },
                              body: formattedVideo,
                            }).then((res) => {
                              refetchVersion();
                              if (shouldFetchItems) {
                                refetchItems();
                              }
                              refetchItem();
                            });
                            toast.success("Video details saved successfully");
                            setIsEditingItem(false);
                          }
                        }}
                        onDelete={() => {
                          if (
                            selectedEntity.parentIds?.sectionId &&
                            selectedEntity.data?._id
                          ) {
                            
                              deleteItemAsync({
                                params: { path: { itemsGroupId: selectedEntity.parentIds?.itemsGroupId || "", itemId: selectedEntity.data._id } }
                              }).then((res) => {
                                refetchVersion();
                                if (shouldFetchItems) {
                                  refetchItems();
                                }
                                refetchItem();
                              });
                              setSelectedEntity(null);
                              setIsEditingItem(false);
                            
                          }
                        }}
                        onEdit={() => setIsEditingItem(true)}
                      />
                    )}
                    {/* <CreateArticle/> */}
                    {selectedEntity.type === "item" && selectedEntity.data.type === "QUIZ" && courseId && versionId && (
                      <EnhancedQuizEditor
                        isLoading={isLoading}
                        selectedItemName={selectedItem.name}
                        quizId={selectedQuizId}
                        moduleId={selectedEntity.parentIds?.moduleId || ""}
                        sectionId={selectedEntity.parentIds?.sectionId || ""}
                        courseId={courseId}
                        courseVersionId={versionId}
                        details={quizDetails}
                        analytics={quizAnalytics}
                        // submissions={quizSubmissions}
                        performance={quizPerformance}
                        onDelete={() => {
                          deleteItemAsync({
                            params: { path: { itemsGroupId: selectedEntity.parentIds?.itemsGroupId || "", itemId: selectedQuizId } }
                          }).then((res) => {
                            refetchVersion();
                            refetchItems();
                          });
                          setSelectedEntity(null);
                        }}
                      />
                    )}
                    {selectedEntity.type === "item" && selectedEntity.data.type === "PROJECT" && courseId && versionId && (
                      <ProjectItem
                        mode="edit"
                        name={projectEditName}
                        description={projectEditDescription}
                        onNameChange={setProjectEditName}
                        onDescriptionChange={setProjectEditDescription}
                        onSave={async () => {
                          const projectId = selectedEntity.data._id;
                          const name = projectEditName;
                          const description = projectEditDescription;
                          if (projectId && versionId) {
                            try {
                              await updateCourseItemAsync({
                                params: { path: { versionId, itemId: projectId } },
                                body: { name, description, details: { name, description }, type: 'PROJECT' }
                              });
                              refetchVersion();
                              refetchItems(); ``
                              refetchItem();
                              toast.success("Project updated successfully");
                            } catch (err) {
                              toast.error('Failed to update project: ' + (err?.message || 'Unknown error'));
                            }
                          }
                        }}
                        onDelete={async () => {
                          const projectId = selectedEntity.data._id;
                          if (selectedEntity.parentIds?.itemsGroupId && projectId) {
                            
                              await deleteItemAsync({
                                params: { path: { itemsGroupId: selectedEntity.parentIds.itemsGroupId, itemId: projectId } },
                              });
                              refetchVersion();
                              refetchItems();
                              refetchItem();
                              setSelectedEntity(null);
                              toast.success("Project deleted successfully");
                            
                          }
                        }}
                        onClose={() => {
                          refetchItem();
                        }}
                      />
                    )}
                    {selectedEntity.type === "item" && selectedEntity.data.type === "BLOG" && courseId && versionId && (
                      <EnhancedBlogEditor
                        isLoading={isLoading}
                        selectedItemName={selectedItem.name}
                        blogId={selectedEntity.data._id}
                        moduleId={selectedEntity.parentIds?.moduleId || ""}
                        sectionId={selectedEntity.parentIds?.sectionId || ""}
                        courseId={courseId}
                        courseVersionId={versionId}
                        details={selectedItemData}
                        onRefetch={() => {
                          refetchVersion();
                          refetchItems();
                          refetchItem();
                        }}
                        onDelete={() => {
                          deleteItemAsync({
                            params: { path: { itemsGroupId: selectedEntity.parentIds?.itemsGroupId || "", itemId: selectedEntity.data._id } }
                          }).then((res) => {
                            refetchVersion();
                            refetchItems();
                          });
                          setSelectedEntity(null);
                        }}
                      />
                    )}

                    {/* {selectedEntity.type === "item" && selectedEntity.data.type === "FEEDBACK" && (
                    
  <FeedbackFormEditor  />
)} */}


                    {selectedEntity.type === "item" && selectedEntity.data.type === "FEEDBACK" && (
                      <FeedbackFormEditor
                        isLoading={isLoading}
                        selectedItemName={selectedItem.name}
                        feedbackId={selectedEntity.data._id}
                        moduleId={selectedEntity.parentIds?.moduleId || ""}
                        sectionId={selectedEntity.parentIds?.sectionId || ""}
                        courseId={courseId!}
                        courseVersionId={versionId!}
                        details={selectedItemData}
                        onRefetch={() => {
                          refetchVersion();
                          refetchItems();
                          refetchItem();
                        }}
                        onDelete={() => {
                          deleteItemAsync({
                            params: { path: { itemsGroupId: selectedEntity.parentIds?.itemsGroupId || "", itemId: selectedEntity.data._id } }
                          }).then(() => {
                            refetchVersion();
                            refetchItems();
                          });
                          setSelectedEntity(null);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Render the content according to the wizard mode or custome mode
          <div className="flex flex-col items-center justify-center h-[80vh]  text-center relative">
                {/* Animated Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
                  <div className="w-60 h-60 rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 blur-3xl opacity-70 animate-pulse"></div>
                </div>

                {/* Animated Icon */}
                <div className="relative z-10 mb-8">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-lg animate-float">
                    <BookOpen className="h-16 w-16 text-primary dark:text-primary drop-shadow-lg" />
                  </div>
                </div>

                {/* ViBe Branded Heading */}
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-slate-100 mb-3 tracking-tight animate-fade-in">
                  Welcome to <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">ViBe</span>
                </h3>

                {/* Subtitle */}
                <p className="text-base md:text-lg lg:text-xl text-slate-600 dark:text-slate-300 mb-2 animate-fade-in">
                  Ready to Edit Your Course
                </p>

                {/* Animated AI tagline */}
                <p className="mb-2 max-w-xl mx-auto text-sm md:text-base lg:text-lg font-medium bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-x">
                  Let AI help you build your course faster and smarter!
                </p>

                {/* Animated message */}
                <div className="h-12 mb-3 flex items-center justify-center">
                  <p
                    className={`max-w-md text-sm md:text-base lg:text-lg text-center font-medium leading-relaxed transition-all duration-500 ease-in-out text-primary animate-fade-in ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                      textShadow: '0 2px 8px hsl(var(--primary) / 0.3)',
                    }}
                  >
                    {displayedMessage}
                  </p>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={handleAddModule}
                  className="bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-sm md:text-base lg:text-lg flex items-center gap-3 animate-bounce-slow group"
                >
                  <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
                  Add new module
                </Button>

                {/* ViBe Features */}
                <div className="mt-8 md:flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2 mb-2 md:mb-0">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span>AI-Powered Content</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2 md:mb-0">
                    <div className="w-2 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                    <span>Smart Course Builder</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                    <span>Interactive Learning</span>
                  </div>
                </div>
              </div>
           ))}
                            
      
          </div>
        </SidebarInset>
      </ResizablePanel>

      {/* Add Video Modal */}
      {showAddVideoModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.25)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)", // <-- add blur effect
            WebkitBackdropFilter: "blur(6px)", // for Safari support
          }}
          className="overflow-y-scroll"
        >
          <VideoModal
            isLoading={isLoading}
            selectedItemName={selectedItem.name}
            action="add"
            onClose={() => setShowAddVideoModal(null)}
            onSave={video => {
              handleAddItem(
                showAddVideoModal.moduleId,
                showAddVideoModal.sectionId,
                "VIDEO",
                video
              );
              setShowAddVideoModal(null);
            }}
          />
        </div>
      )}


      {/* Add Quiz Modal */}
      <QuizWizardModal
        quizWizardOpen={quizWizardOpen}
        setQuizWizardOpen={setQuizWizardOpen}
      />

    </ResizablePanelGroup>
  );
}

export default function TeacherCoursePage() {
  const [initialScreenSize, setInitialScreenSize] = useState<boolean | null>(null);

  useEffect(() => {
    const width = window.innerWidth;
    setInitialScreenSize(width >= 768);
  }, []);

  return (
    <SidebarProvider defaultOpen={initialScreenSize ?? true}>
      <TeacherCourseContent />
    </SidebarProvider>
  );
}


type SuccessFlagEntry = {
  flag: boolean;
  message: string;
};

type ErrorFlagEntry = {
  flag: boolean;
  message?: string;
  fallback: string;
};

export function useStatusToasts({
  successFlags,
  errorFlags,
}: {
  successFlags: Record<string, SuccessFlagEntry>;
  errorFlags: Record<string, ErrorFlagEntry>;
}) {
  const prevSuccess = useRef<Record<string, boolean>>({});
  const prevError = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // Success toasts
    Object.entries(successFlags).forEach(([key, { flag, message }]) => {
      const wasPrev = prevSuccess.current[key];
      if (!wasPrev && flag) {
        toast.success(message);
      }
      prevSuccess.current[key] = flag;
    });

    // Error toasts
    Object.entries(errorFlags).forEach(([key, { flag, message, fallback }]) => {
      const wasPrev = prevError.current[key];
      if (!wasPrev && flag) {
        toast.error(fallback, {
          description: message ?? "An unknown error occurred.",
        });
      }
      prevError.current[key] = flag;
    });
  }, [successFlags, errorFlags]);
}

// 4. ADD A SIMPLE FEEDBACK EDITOR COMPONENT (Hello World for now)
