import React, { useState, useEffect, useRef } from "react";
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
  SidebarInset, SidebarProvider, SidebarTrigger, SidebarFooter
} from "@/components/ui/sidebar";
import { Reorder } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  BookOpen, ChevronRight, FileText, VideoIcon, ListChecks, Plus, Pencil, Wand2, Sparkles
} from "lucide-react";

import { Link, useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Home, GraduationCap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useCourseVersionById, useCreateModule, useUpdateModule, useDeleteModule, useCreateSection, useUpdateSection, useDeleteSection, useCreateItem, useUpdateItem, useDeleteItem, useItemsBySectionId, useItemById, useQuizDetails, useQuizAnalytics, useQuizPerformance, useQuizResults, useMoveModule, useMoveSection, useMoveItem, useUpdateCourseItem } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import VideoModal from "./components/Video-modal";
import EnhancedQuizEditor from "./components/enhanced-quiz-editor";
import QuizWizardModal from "./components/quiz-wizard";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import Loader from "@/components/Loader";
import { Label } from "@/components/ui/label";


// ✅ Icons per item type
const getItemIcon = (type: string) => {
  switch (type) {
    case "BLOG": return <FileText className="h-3 w-3" />;
    case "VIDEO": return <VideoIcon className="h-3 w-3" />;
    case "QUIZ": return <ListChecks className="h-3 w-3" />;
    default: return null;
  }
};

interface LabelOptions {
  itemId: string;
  itemType: "VIDEO" | "QUIZ" | "BLOG";
  sectionItems: Record<string, any[]>;
  sectionId: string;
}


export default function TeacherCoursePage() {
  const user = useAuthStore().user;
  const { currentCourse, setCurrentCourse } = useCourseStore();
  // Use correct keys for course/version IDs
  const courseId = currentCourse?.courseId;
  const versionId = currentCourse?.versionId;

  // Fetch course version data (modules, sections, items)
  const { data: versionData, refetch: refetchVersion, isLoading } = useCourseVersionById(versionId || "");
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
  const [selectedItem, setSelectedItem] = useState({ id:"", name:"" });

  const [errors, setErrors] = useState({
    title: "",
    description: "",
  });



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
  
  // Track which section to fetch items for
  const [activeSectionInfo, setActiveSectionInfo] = useState<{ moduleId: string; sectionId: string } | null>(null);

  // Fetch items for the active section
  const shouldFetchItems = Boolean(activeSectionInfo?.moduleId && activeSectionInfo?.sectionId && versionId);
  const {
    data: currentSectionItems,
    isLoading: itemsLoading,
    refetch: refetchItems
  } = useItemsBySectionId(
    shouldFetchItems ? versionId || "" : '',
    shouldFetchItems ? activeSectionInfo?.moduleId ?? '' : '',
    shouldFetchItems ? activeSectionInfo?.sectionId ?? '' : ''
  );

  // Fetch item details for selected item
  const shouldFetchItem = selectedEntity?.type === 'item' && !!courseId && !!versionId && !!selectedEntity?.data?._id;
  const {
    data: selectedItemData,refetch: refetchItem
  } = useItemById(
    shouldFetchItem ? courseId : '',
    shouldFetchItem ? versionId : '',
    shouldFetchItem ? selectedEntity?.data?._id : ''
  );

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
const { mutateAsync: createModuleAsync, isSuccess: isCreateModuleSuccess, isError: isCreateModuleError, error: createModuleError } = useCreateModule();
const { mutateAsync: updateModuleAsync, isSuccess: isUpdateModuleSuccess, isError: isUpdateModuleError, error: updateModuleError } = useUpdateModule();
const { mutateAsync: deleteModuleAsync, isSuccess: isDeleteModuleSuccess, isError: isDeleteModuleError, error: deleteModuleError } = useDeleteModule();
const { mutateAsync: moveModuleAsync } = useMoveModule();

// --- SECTIONS ---
const { mutateAsync: createSectionAsync, isSuccess: isCreateSectionSuccess, isError: isCreateSectionError, error: createSectionError } = useCreateSection();
const { mutateAsync: updateSectionAsync, isSuccess: isUpdateSectionSuccess, isError: isUpdateSectionError, error: updateSectionError } = useUpdateSection();
const { mutateAsync: deleteSectionAsync, isSuccess: isDeleteSectionSuccess, isError: isDeleteSectionError, error: deleteSectionError } = useDeleteSection();
const { mutateAsync: moveSectionAsync } = useMoveSection();

// --- ITEMS ---
const { mutateAsync: createItemAsync, isSuccess: isCreateItemSuccess, isError: isCreateItemError, error: createItemError } = useCreateItem();
const { mutateAsync: updateItemAsync, isSuccess: isUpdateItemSuccess, isError: isUpdateItemError, error: updateItemError } = useUpdateItem();
const { mutateAsync: updateVideoAsync } = useUpdateCourseItem();
const { mutateAsync: deleteItemAsync, isSuccess: isDeleteItemSuccess, isError: isDeleteItemError, error: deleteItemError } = useDeleteItem();
const { mutateAsync: moveItemAsync, isPending, isError: isMoveItemError, error: moveItemError } = useMoveItem();



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
    refetchItems();
    refetchItem()

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

// Success toasts
useEffect(() => {
  if (isCreateModuleSuccess) toast.success("Module created successfully!");
  if (isUpdateModuleSuccess) toast.success("Module updated successfully!");
  if (isDeleteModuleSuccess) toast.success("Module deleted successfully!");

  if (isCreateSectionSuccess) toast.success("Section created successfully!");
  if (isUpdateSectionSuccess) toast.success("Section updated successfully!");
  if (isDeleteSectionSuccess) toast.success("Section deleted successfully!");

  if (isCreateItemSuccess) toast.success("Item created successfully!");
  if (isUpdateItemSuccess) toast.success("Item updated successfully!");
  if (isDeleteItemSuccess) toast.success("Item deleted successfully!");
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

// Error toasts
useEffect(() => {
  if (isCreateModuleError) toast.error("Failed to create module", { description: createModuleError?.message });
  if (isUpdateModuleError) toast.error("Failed to update module", { description: updateModuleError?.message });
  if (isDeleteModuleError) toast.error("Failed to delete module", { description: deleteModuleError?.message });

  if (isCreateSectionError) toast.error("Failed to create section", { description: createSectionError?.message });
  if (isUpdateSectionError) toast.error("Failed to update section", { description: updateSectionError?.message });
  if (isDeleteSectionError) toast.error("Failed to delete section", { description: deleteSectionError?.message });

  if (isCreateItemError) toast.error("Failed to create item", { description: createItemError?.message });
  if (isUpdateItemError) toast.error("Failed to update item", { description: updateItemError?.message });
  if (isDeleteItemError) toast.error("Failed to delete item", { description: deleteItemError?.message });

  if (isMoveItemError) toast.error("Failed to move item", { description: moveItemError?.message });
}, [
  isCreateModuleError,
  isUpdateModuleError,
  isDeleteModuleError,
  isCreateSectionError,
  isUpdateSectionError,
  isDeleteSectionError,
  isCreateItemError,
  isUpdateItemError,
  isDeleteItemError,
  isMoveItemError,
]);


  // Reload items when quiz wizard closes
  useEffect(() => {
    if (!quizWizardOpen && quizModuleId && quizSectionId) {
      // Quiz wizard just closed, reload items for the section
      setActiveSectionInfo({ moduleId: quizModuleId, sectionId: quizSectionId });
      refetchVersion();
      refetchItems();
    }
  }, [quizWizardOpen, quizModuleId, quizSectionId, refetchVersion]);

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
      default:
        return "Unknown";
    }
  };

  function formatSecondsToHHMMSS(seconds: string | number): string {
    const sec = Math.floor(Number(seconds));
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;

    const pad = (val: number) => val.toString().padStart(2, '0');

    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }


  // Add Module
  const handleAddModule = () => {
    if (!versionId) return;
    createModuleAsync({
      params: { path: { versionId } },
      body: { name: "Untitled Module", description: "Module description" }
    }).then((res) => {
         refetchVersion();
    refetchItems();refetchItem()
      });
  };

  // Add Section
  const handleAddSection = (moduleId: string) => {
    if (!versionId) return;
    createSectionAsync({
      params: { path: { versionId, moduleId } },
      body: { name: "New Section", description: "Section description" }
    }).then((res) => {
         refetchVersion();
    refetchItems();refetchItem()
      });
  };

  // Add Item (now only for article/quiz, video handled via modal)
  const handleAddItem = (moduleId: string, sectionId: string, type: string, videoData?: any) => {
    if (!versionId) return;
    const typeMap: Record<string, "VIDEO" | "QUIZ" | "BLOG"> = {
      video: "VIDEO",
      quiz: "QUIZ",
      article: "BLOG"
    };
    if (type === "VIDEO" && videoData) {
      createItemAsync({
        params: { path: { versionId, moduleId, sectionId } },
        body: {
          type: "VIDEO",
          name: videoData.name,
          description: videoData.description,
          videoDetails: {
            URL: videoData.details.URL,
            startTime: convertToMinSecMs(videoData.details.startTime),
            endTime: convertToMinSecMs(videoData.details.endTime),
            points: videoData.details.points,
          }
        }
      }).then((res) => {
         refetchVersion();
    refetchItems();refetchItem()
      });;

      // Helper function to convert seconds (or ms) to "minutes:seconds.milliseconds"
      function convertToMinSecMs(time: number) {
        // If time is in ms, convert to seconds
        const totalMs = time > 1000 * 60 * 60 ? time : Math.round(time * 1000);
        const minutes = Math.floor(totalMs / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
      }
      return;
    }
    if (type === "QUIZ") {
      createItem.mutate({
        params: { path: { versionId, moduleId, sectionId } },
        body: {
          type: typeMap[type], name: `New ${typeMap[type]}`, description: "Sample content"
        }
      });
    }
    if (type === "article") {
      createItem.mutate({
        params: { path: { versionId, moduleId, sectionId } },
        body: {
          type: typeMap[type], name: `New ${typeMap[type]}`, description: "Sample content", blogDetails: {
            content: "Sample content",
            points: '2.0',
            estimatedReadTimeInMinutes: 1,
          }
        }
      });
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
    }).then((res) => { refetchItems(); })

  };


  useEffect(() => {
    if (modules.length > 0)
      setInitialModules(modules)
  }, [modules])

  return (
    <SidebarProvider defaultOpen={true}>

      <div className="flex h-screen w-full">

        {/* <ConfirmationModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={()=>{}}
          title="Delete Section"
          description="Are you sure you want to delete this section?"
          confirmText="Delete Section"
          isDestructive={true}
          isLoading={false}
        /> */}
        <Sidebar variant="inset" collapsible="icon" className="border-r border-border/40 bg-sidebar/50">
          <SidebarHeader className="border-b border-border/40">
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
                          className="focus:outline-none"
                          whileDrag={{ scale: 1.02 }}
                          onDragEnd={() => {
                            setInitialModules(pendingOrder.current);
                            handleMoveModule(module.moduleId, versionId);
                          }}
                        >
                          <SidebarMenuButton
                            onClick={() => {
                              toggleModule(module.moduleId);
                              setSelectedEntity({ type: "module", data: module });
                            }}
                          >
                            <ChevronRight
                              className={`h-3.5 w-3.5 transition-transform ${expandedModules[module.moduleId] ? "rotate-90" : ""
                                }`}
                            />
                            <span className="ml-2 truncate">{module.name}</span>
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
                                  className="focus:outline-none"
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
                                      }}
                                    >
                                      <ChevronRight
                                        className={`h-3 w-3 transition-transform ${expandedSections[section.sectionId] ? "rotate-90" : ""
                                          }`}
                                      />
                                      <span className="ml-2 truncate max-w-[100px] block">{section.name} </span>
                                    </SidebarMenuSubButton>

                                    {expandedSections[section.sectionId] && (
                                      <Reorder.Group
                                        axis="y"
                                        values={sectionItems[section.sectionId] || []}
                                        onReorder={(newItemOrder) => {
                                          pendingOrderItems.current[section.sectionId] = newItemOrder;
                                        }}
                                      >
                                        <SidebarMenuSub className="ml-4 space-y-1 pt-1">
                                          {(sectionItems[section.sectionId] || [])
                                            .slice()
                                            .sort((a: any, b: any) => a.order.localeCompare(b.order))
                                            .map((item: any) => (
                                              <Reorder.Item
                                                key={item._id}
                                                value={item}
                                                drag
                                                className="focus:outline-none"
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

                                                      setSelectedItem({id:item._id, name:label});

                                                      setSelectedEntity({
                                                        type: "item",
                                                        data: item,
                                                        parentIds: {
                                                          moduleId: module.moduleId,
                                                          sectionId: section.sectionId,
                                                          itemsGroupId: section.itemsGroupId,
                                                        },
                                                      })
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
                                                </SidebarMenuSubItem>
                                              </Reorder.Item>
                                            ))}
                                          <div className="ml-6 mt-2">

                                            <select

                                              className="text-xs border rounded px-2 py-1 bg-background text-foreground"

                                              defaultValue=""

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

                                                  } else {

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

                                            </select>
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    type="button"
                                                    onClick={() => {
                                                      setCurrentCourse({
                                                        courseId,
                                                        versionId,
                                                        moduleId: module.moduleId,
                                                        sectionId: section.sectionId,
                                                        itemId: null,
                                                        watchItemId: null,
                                                      });
                                                      navigate({ to: '/teacher/ai-section' });
                                                    }}
                                                    className="inline-flex items-center justify-center px-1.5 py-0 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold text-[10px] gap-0.5 shadow transition-all duration-200 hover:scale-105 hover:shadow-lg hover:from-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-purple-400 ml-3"
                                                    style={{ minWidth: 'unset', height: '1.5rem' }}
                                                  >
                                                    <Sparkles className="h-2 w-2" />
                                                    <span>AI</span>
                                                  </Button>
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
                                className="ml-4 mt-2 h-6 text-xs"
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
                    <Button size="sm" className="w-full text-xs" onClick={handleAddModule}>
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

        {/* Course Editor Area */}
        <SidebarInset className="flex-1 bg-background overflow-y-auto">
          <div className="w-full p-6">
            <div className="flex items-center gap-2  mb-4">
              <div className="md:hidden">
                <SidebarTrigger />
              </div>
              <h2 className="text-lg font-semibold">Course Editor</h2>
            </div>

            {selectedEntity ? (
              <div className="bg-white dark:bg-background rounded-2xl shadow-lg border border-slate-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 md:p-6 lg:p-8">
                  {/* Header with breadcrumb */}
                  <div className="mb-6 pb-4 border-b border-slate-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900 dark:text-gray-100">
                        {selectedEntity.data?.name}
                      </h2>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">
                        {selectedEntity.type.charAt(0).toUpperCase() + selectedEntity.type.slice(1)}
                      </Badge>
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
                        <Label className="text-sm font-bold text-foreground">Description *</Label>
                        <textarea
                          value={
                            selectedEntity.type === "item"
                              ? selectedItemData?.item?.description ?? ""
                              : selectedEntity.data?.description ?? ""
                          }
                          onChange={e => {
                            const value = e.target.value;
                            setSelectedEntity({
                              ...selectedEntity,
                              data: { ...selectedEntity.data, description: value }
                            })
                            if (selectedEntity.type === "module") {
                              if (!value.trim()) {
                                setErrors(errors => ({ ...errors, description: "Module description is required." }));
                              } else {
                                setErrors(errors => ({ ...errors, description: "" }));
                              }
                            }
                            if (selectedEntity.type === "section") {
                              if (!value.trim()) {
                                setErrors(errors => ({ ...errors, description: "Section description is required." }));
                              } else {
                                setErrors(errors => ({ ...errors, description: "" }));
                              }
                            }
                          }}
                          placeholder="Description"
                          rows={5}
                          className="w-full rounded border px-3 py-2 text-sm"
                        />
                        {errors.description && (
                          <div className="text-xs text-red-500">{errors.description}</div>
                        )}
                      </>
                    )}

                    {(selectedEntity.type === "module" || selectedEntity.type === "section") && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const moduleName = selectedEntity.data.name?.trim();
                          const moduleDescription = selectedEntity.data.description?.trim() ?? "";
                          const sectionName = selectedEntity.data.name?.trim();
                          const sectionDescription = selectedEntity.data.description?.trim() ?? "";
                          if (selectedEntity.type === "module") {

                            if (!moduleName || !moduleDescription) {
                              setErrors({
                                title: !moduleName ? "Module name is required." : "",
                                description: !moduleDescription ? "Module description is required." : ""
                              });
                              return;
                            }
                            
                          }
                          if (selectedEntity.type === "section") {
                            if (!sectionName || !sectionDescription) {
                              setErrors({
                                title: !sectionName ? "Section name is required." : "",
                                description: !sectionDescription ? "Section description is required." : ""
                              });
                              return;
                            }
            
                          }
                          setErrors({ title: "", description: "" });
                          if (selectedEntity.type === "module" && versionId) {
                           updateModuleAsync({
                              params: { path: { versionId, moduleId: selectedEntity.data.moduleId } },
                              body: {
                                name: selectedEntity.data.name,
                                description: selectedEntity.data.description || ""
                              }
                            }).then((res) => {
         refetchVersion();
    refetchItems();refetchItem()
      });
                          }
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
    refetchItems();refetchItem()
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
    refetchItems();refetchItem()
      });
                          }
                        }}
                        className="mr-2"
                      >
                        Update {selectedEntity.type}
                      </Button>
                    )}
                         
                    {(selectedEntity.type === "module" || selectedEntity.type === "section") && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          const { type, parentIds } = selectedEntity;
                          if (type === "module" && versionId) {
                            if (window.confirm("Are you sure you want to delete this module and all its sections/items?")) {
                              deleteModuleAsync({
                                params: { path: { versionId, moduleId: selectedEntity.data.moduleId } }
                              }).then((res) => {
         refetchVersion();
    refetchItems();refetchItem()
      });
                              setSelectedEntity(null);
                              setExpandedModules(prev => ({ ...prev, [selectedEntity.data.moduleId]: false }));
                            }
                          }
                          if (type === "section" && versionId && parentIds?.moduleId) {
                            if (window.confirm("Are you sure you want to delete this section and all its items?")) {
                              deleteSectionAsync({
                                params: { path: { versionId, moduleId: parentIds.moduleId, sectionId: selectedEntity.data.sectionId } }
                              }).then((res) => {
         refetchVersion();
    refetchItems();refetchItem()
      });
                              setSelectedEntity(null);
                              setExpandedSections(prev => ({ ...prev, [selectedEntity.data.sectionId]: false }));
                            }
                          }
                          setErrors({ title: "", description: "" });
                        }}
                      >
                        Delete {selectedEntity.type}
                      </Button>
                    )}

                    {selectedEntity.type === "item" && selectedEntity.data.type === "VIDEO" && (
                     
                      <VideoModal
                        isLoading={isLoading}
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
                              startTime: formatSecondsToHHMMSS(video.details.startTime),
                              endTime: formatSecondsToHHMMSS(video.details.endTime),
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
    refetchItems();refetchItem()
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
                            if (window.confirm("Are you sure you want to delete this item?")) {
                              deleteItemAsync({
                                params: { path: { itemsGroupId: selectedEntity.parentIds?.itemsGroupId || "", itemId: selectedEntity.data._id } }
                              }).then((res) => {
         refetchVersion();
    refetchItems();refetchItem()
      });
                              setSelectedEntity(null);
                              setIsEditingItem(false);
                            }
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
                          refetchItems();refetchItem()
                          });
                          setSelectedEntity(null);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[80vh] text-center relative">
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
            )}
          </div>
        </SidebarInset>

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
      </div>
    </SidebarProvider>
  );
}