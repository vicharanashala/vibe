import React, { useState, useEffect } from "react";
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
  SidebarInset, SidebarProvider, SidebarTrigger, SidebarFooter
} from "@/components/ui/sidebar";
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

import { useCourseVersionById, useCreateModule, useUpdateModule, useDeleteModule, useCreateSection, useUpdateSection, useDeleteSection, useCreateItem, useUpdateItem, useDeleteItem, useItemsBySectionId, useItemById, useQuizSubmissions, useQuizDetails, useQuizAnalytics, useQuizPerformance, useQuizResults } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import VideoModal from "./components/Video-modal";
import EnhancedQuizEditor from "./components/enhanced-quiz-editor";
import QuizWizardModal from "./components/quiz-wizard";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
// ✅ Icons per item type
const getItemIcon = (type: string) => {
  switch (type) {
    case "BLOG": return <FileText className="h-3 w-3" />;
    case "VIDEO": return <VideoIcon className="h-3 w-3" />;
    case "QUIZ": return <ListChecks className="h-3 w-3" />;
    default: return null;
  }
};

export default function TeacherCoursePage() {
  const user = useAuthStore().user;
  const { currentCourse, setCurrentCourse } = useCourseStore();
  // Use correct keys for course/version IDs
  const courseId = currentCourse?.courseId;
  const versionId = currentCourse?.versionId;

  // Fetch course version data (modules, sections, items)
  const { data: versionData, refetch: refetchVersion } = useCourseVersionById(versionId || "");
  // Some APIs return modules directly, some wrap in 'version'. Try both.
  // @ts-ignore
  const modules = (versionData as any)?.modules || (versionData as any)?.version?.modules || [];

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
    data: selectedItemData
  } = useItemById(
    shouldFetchItem ? courseId : '',
    shouldFetchItem ? versionId : '',
    shouldFetchItem ? selectedEntity?.data?._id : ''
  );

  const selectedQuizId = selectedEntity?.type === 'item' && selectedEntity?.data?.type === 'QUIZ' ? selectedEntity.data._id : null;

  const { data: quizDetails } = useQuizDetails(selectedQuizId);
  const { data: quizAnalytics } = useQuizAnalytics(selectedQuizId);
  const { data: quizSubmissions } = useQuizSubmissions(selectedQuizId);
  const { data: quizPerformance } = useQuizPerformance(selectedQuizId);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const toggleSection = (moduleId: string, sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
    setActiveSectionInfo({ moduleId, sectionId });
  };


  // CRUD hooks

  const createModule = useCreateModule();
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();


  // Refetch version data after successful mutations
  useEffect(() => {
    if (createModule.isSuccess || createSection.isSuccess || createItem.isSuccess || updateModule.isSuccess || updateSection.isSuccess || updateItem.isSuccess || deleteModule.isSuccess || deleteSection.isSuccess || deleteItem.isSuccess) {
      refetchVersion();
      // Also refetch items for active section
      if (activeSectionInfo) {
        setActiveSectionInfo({ ...activeSectionInfo }); // triggers refetch
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createModule.isSuccess, createSection.isSuccess, createItem.isSuccess, updateModule.isSuccess, updateSection.isSuccess, updateItem.isSuccess, deleteModule.isSuccess, deleteSection.isSuccess, deleteItem.isSuccess]);

  // Show toast notification when module is created successfully
  useEffect(() => {
    if (createModule.isSuccess) {
      toast.success("Module created successfully!", {
        description: "Your new module has been added to the course.",
      });
    }
  }, [createModule.isSuccess]);

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


  // Add Module
  const handleAddModule = () => {
    if (!versionId) return;
    createModule.mutate({
      params: { path: { versionId } },
      body: { name: "Untitled Module", description: "Module description" }
    });
  };

  // Add Section
  const handleAddSection = (moduleId: string) => {
    if (!versionId) return;
    createSection.mutate({
      params: { path: { versionId, moduleId } },
      body: { name: "New Section", description: "Section description" }
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
      createItem.mutate({
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
      });

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
    if (type !== "VIDEO") {
      createItem.mutate({
        params: { path: { versionId, moduleId, sectionId } },
        body: { type: typeMap[type], name: `New ${typeMap[type]}`, description: "Sample content" }
      });
    }
  };

  const navigate = useNavigate();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        <Sidebar variant="inset" className="border-r border-border/40 bg-sidebar/50">
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

          <SidebarContent className="bg-card/50 pl-2">
            <ScrollArea className="flex-1">
              <SidebarMenu className="space-y-2 text-sm pr-1 pt-2">
                {/* TODO: Replace 'any' with correct Module type */}
                {modules.map((module: any) => (
                  <SidebarMenuItem key={module.moduleId}>
                    <SidebarMenuButton
                      className="group relative overflow-hidden rounded-lg p-3 transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-slate-800 dark:hover:to-slate-700 shadow-sm border border-transparent hover:border-blue-200 hover:shadow-md"
                      onClick={() => {
                        toggleModule(module.moduleId);
                        setSelectedEntity({ type: "module", data: module });
                      }}
                    >
                      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expandedModules[module.moduleId] ? "rotate-90" : ""}`} />
                      <span className="ml-2 truncate">{module.name}</span>
                    </SidebarMenuButton>

                    {expandedModules[module.moduleId] && (
                      <SidebarMenuSub className="ml-2">
                        {module.sections?.map((section: any) => (
                          <SidebarMenuSubItem key={section.sectionId}>
                            <SidebarMenuSubButton
                              className="group rounded-lg p-3 transition-all duration-200 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-slate-800 dark:hover:to-slate-700 shadow-sm border border-transparent hover:border-green-200"
                              onClick={() => {
                                toggleSection(module.moduleId, section.sectionId);
                                setSelectedEntity({
                                  type: "section",
                                  data: section,
                                  parentIds: { moduleId: module.moduleId },
                                });
                              }}
                            >
                              <ChevronRight className={`h-3 w-3 transition-transform ${expandedSections[section.sectionId] ? "rotate-90" : ""}`} />
                              <span className="ml-2 truncate">{section.name}</span>
                            </SidebarMenuSubButton>

                            {expandedSections[section.sectionId] && (
                              <SidebarMenuSub className="ml-4 space-y-1 pt-1">
                                {(sectionItems[section.sectionId] || []).map((item: any) => (
                                  <SidebarMenuSubItem key={item._id}>
                                    <SidebarMenuSubButton
                                      className="justify-start"
                                      onClick={() =>
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
                                    >
                                      {getItemIcon(item.type)}
                                      <span className="ml-1 text-xs text-muted-foreground">
                                        {item.type === "VIDEO" && `Video ${(sectionItems[section.sectionId] || []).filter(i => i.type === "VIDEO").findIndex(i => i._id === item._id) + 1}`}
                                        {item.type === "QUIZ" && `Quiz ${(sectionItems[section.sectionId] || []).filter(i => i.type === "QUIZ").findIndex(i => i._id === item._id) + 1}`}
                                        {item.type === "BLOG" && `Article ${(sectionItems[section.sectionId] || []).filter(i => i.type === "BLOG").findIndex(i => i._id === item._id) + 1}`}
                                      </span>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                                <div className="ml-2 mt-2 flex flex-row items-center">
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
                            )}
                          </SidebarMenuSubItem>
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
                  <Link to="/teacher/courses/list" className="flex items-center gap-3">
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
            <h2 className="text-lg font-semibold mb-4">Course Editor</h2>

            {selectedEntity ? (
              <div className="bg-white dark:bg-background rounded-2xl shadow-lg border border-slate-200 dark:border-gray-700 overflow-hidden">
                <div className="p-8">
                  {/* Header with breadcrumb */}
                  <div className="mb-6 pb-4 border-b border-slate-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-gray-100">
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
                  <div className="space-y-4">
                    {(selectedEntity.type !== "item") && (
                      <Input
                        value={
                          selectedEntity.type === "item"
                            ? selectedItemData?.item?.name ?? ""
                            : selectedEntity.data?.name ?? ""
                        }
                        onChange={e =>
                          setSelectedEntity({
                            ...selectedEntity,
                            data: { ...selectedEntity.data, name: e.target.value }
                          })
                        }
                      />
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
                      <textarea
                        value={
                          selectedEntity.type === "item"
                            ? selectedItemData?.item?.description ?? ""
                            : selectedEntity.data?.description ?? ""
                        }
                        onChange={e =>
                          setSelectedEntity({
                            ...selectedEntity,
                            data: { ...selectedEntity.data, description: e.target.value }
                          })
                        }
                        placeholder="Description"
                        rows={5}
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                    )}

                    {(selectedEntity.type === "module" || selectedEntity.type === "section") && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (selectedEntity.type === "module" && versionId) {
                            updateModule.mutate({
                              params: { path: { versionId, moduleId: selectedEntity.data.moduleId } },
                              body: {
                                name: selectedEntity.data.name,
                                description: selectedEntity.data.description || ""
                              }
                            });
                          }
                          if (selectedEntity.type === "section" && versionId && selectedEntity.parentIds?.moduleId) {
                            updateSection.mutate({
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
                            });
                          }
                          if (selectedEntity.type === "item" && versionId && selectedEntity.parentIds?.moduleId && selectedEntity.parentIds?.sectionId) {
                            updateItem.mutate({
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
                              deleteModule.mutate({
                                params: { path: { versionId, moduleId: selectedEntity.data.moduleId } }
                              });
                              setSelectedEntity(null);
                              setExpandedModules(prev => ({ ...prev, [selectedEntity.data.moduleId]: false }));
                            }
                          }
                          if (type === "section" && versionId && parentIds?.moduleId) {
                            if (window.confirm("Are you sure you want to delete this section and all its items?")) {
                              deleteSection.mutate({
                                params: { path: { versionId, moduleId: parentIds.moduleId, sectionId: selectedEntity.data.sectionId } }
                              });
                              setSelectedEntity(null);
                              setExpandedSections(prev => ({ ...prev, [selectedEntity.data.sectionId]: false }));
                            }
                          }
                        }}
                      >
                        Delete {selectedEntity.type}
                      </Button>
                    )}

                    {selectedEntity.type === "item" && selectedEntity.data.type === "VIDEO" && (
                      <VideoModal
                        action={isEditingItem ? "edit" : "view"}
                        item={selectedItemData?.item}
                        onClose={() => setIsEditingItem(false)}
                        onSave={video => {
                          if (
                            selectedEntity.parentIds?.moduleId &&
                            selectedEntity.parentIds?.sectionId &&
                            selectedEntity.data?._id &&
                            versionId
                          ) {
                            updateItem.mutate({
                              params: {
                                path: {
                                  versionId,
                                  moduleId: selectedEntity.parentIds.moduleId,
                                  sectionId: selectedEntity.parentIds.sectionId,
                                  itemId: selectedEntity.data._id,
                                }
                              },
                              body: { ...video, type: "VIDEO" },
                            });
                            setIsEditingItem(false);
                          }
                        }}
                        onDelete={() => {
                          if (
                            selectedEntity.parentIds?.sectionId &&
                            selectedEntity.data?._id
                          ) {
                            if (window.confirm("Are you sure you want to delete this item?")) {
                              deleteItem.mutate({
                                params: { path: { itemsGroupId: selectedEntity.parentIds?.itemsGroupId || "", itemId: selectedEntity.data._id } }
                              });
                              setSelectedEntity(null);
                              setIsEditingItem(false);
                            }
                          }
                        }}
                        onEdit={() => setIsEditingItem(true)}
                      />
                    )}

                    {selectedEntity.type === "item" && selectedEntity.data.type === "QUIZ" && courseId && versionId && (
                      <EnhancedQuizEditor
                        quizId={selectedQuizId}
                        moduleId={selectedEntity.parentIds?.moduleId || ""}
                        sectionId={selectedEntity.parentIds?.sectionId || ""}
                        courseId={courseId}
                        courseVersionId={versionId}
                        details={quizDetails}
                        analytics={quizAnalytics}
                        submissions={quizSubmissions}
                        performance={quizPerformance}
                        onDelete={() => {
                          deleteItem.mutate({
                            params: { path: { itemsGroupId: selectedEntity.parentIds?.itemsGroupId || "", itemId: selectedQuizId } }
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
                <h3 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 mb-3 tracking-tight animate-fade-in">
                  Welcome to <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">ViBe</span>
                </h3>
                
                {/* Subtitle */}
                <p className="text-xl text-slate-600 dark:text-slate-300 mb-2 animate-fade-in">
                  Ready to Edit Your Course
                </p>
                
                {/* Animated AI tagline */}
                <p className="mb-6 max-w-xl mx-auto text-lg font-medium bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-x">
                  Let AI help you build your course faster and smarter!
                </p>
                
                {/* Animated message */}
                <div className="h-12 mb-8 flex items-center justify-center">
                  <p
                    className={`max-w-md text-center font-medium leading-relaxed transition-all duration-500 ease-in-out text-primary animate-fade-in ${isVisible ? 'opacity-100' : 'opacity-0'}`}
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
                  className="bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-lg flex items-center gap-3 animate-bounce-slow group"
                >
                  <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
                  Add new module
                </Button>
                
                {/* ViBe Features */}
                <div className="mt-8 flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span>AI-Powered Content</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-accent rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                    <span>Smart Course Builder</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
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
          >
            <VideoModal
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