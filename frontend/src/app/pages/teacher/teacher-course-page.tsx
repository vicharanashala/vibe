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
import { ThemeToggle } from "@/components/theme-toggle";
import {
  BookOpen, ChevronRight, FileText, VideoIcon, ListChecks, Plus
} from "lucide-react";

import { useCourseVersionById, useCreateModule, useUpdateModule, useDeleteModule, useCreateSection, useUpdateSection, useDeleteSection, useCreateItem, useUpdateItem, useDeleteItem, useItemsBySectionId, useItemById } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
// ✅ Icons per item type
const getItemIcon = (type: string) => {
  switch (type) {
    case "article": return <FileText className="h-3 w-3" />;
    case "video": return <VideoIcon className="h-3 w-3" />;
    case "quiz": return <ListChecks className="h-3 w-3" />;
    default: return null;
  }
};

export default function TeacherCoursePage() {


  const { currentCourse } = useCourseStore();
  // Use correct keys for course/version IDs
  const courseId = currentCourse?.id || currentCourse?._id;
  const versionId = currentCourse?.currentVersionId || currentCourse?.versionId;

  // Fetch course version data (modules, sections, items)
  const { data: versionData, refetch: refetchVersion } = useCourseVersionById(versionId);
  // Some APIs return modules directly, some wrap in 'version'. Try both.
  // @ts-ignore
  const modules = (versionData as any)?.modules || (versionData as any)?.version?.modules || [];


  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [selectedEntity, setSelectedEntity] = useState<{
    type: "module" | "section" | "item";
    data: any;
    parentIds?: { moduleId: string; sectionId?: string };
  } | null>(null);

  // Store items for each section
  const [sectionItems, setSectionItems] = useState<Record<string, any[]>>({});
  // Track which section to fetch items for
  const [activeSectionInfo, setActiveSectionInfo] = useState<{ moduleId: string; sectionId: string } | null>(null);

  // Fetch items for the active section
  const shouldFetchItems = Boolean(activeSectionInfo?.moduleId && activeSectionInfo?.sectionId && versionId);
  const {
    data: currentSectionItems,
    isLoading: itemsLoading
  } = useItemsBySectionId(
    shouldFetchItems ? versionId : '',
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

  // Add Item
  const handleAddItem = (moduleId: string, sectionId: string, type: string) => {
    if (!versionId) return;
    // Map UI type to API type
    const typeMap: Record<string, "VIDEO" | "QUIZ" | "BLOG"> = {
      video: "VIDEO",
      quiz: "QUIZ",
      article: "BLOG"
    };
    createItem.mutate({
      params: { path: { versionId, moduleId, sectionId } },
      body: { type: typeMap[type], name: `New ${typeMap[type]}`, content: "<p>Sample content</p>" }
    });
  };

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
                                          },
                                        })
                                      }
                                    >
                                      {getItemIcon(item.type)}
                                      <span className="ml-2 truncate">{item.name}</span>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                                <div className="ml-6 mt-2">
                                  <select
                                    className="text-xs border rounded px-2 py-1 bg-background text-foreground"
                                    defaultValue=""
                                    onChange={(e) => {
                                      const type = e.target.value;
                                      if (type) {
                                        handleAddItem(module.moduleId, section.sectionId, type);
                                        e.target.value = "";
                                      }
                                    }}
                                  >
                                    <option value="" disabled>Add Item</option>
                                    <option value="article">Article</option>
                                    <option value="video">Video</option>
                                    <option value="quiz">Quiz</option>
                                  </select>
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
          <SidebarFooter className="border-t px-3 py-2">
            <ThemeToggle />
          </SidebarFooter>
        </Sidebar>

        {/* Course Editor Area */}
        <SidebarInset className="flex-1 bg-background overflow-y-auto">
          <div className="w-full max-w-3xl p-6">
            <h2 className="text-lg font-semibold mb-4">Course Editor</h2>

            {selectedEntity ? (
              <div className="space-y-4">
                <Input
                  value={selectedEntity.data?.name || ""}
                  onChange={(e) => {
                    const newName = e.target.value;
                    const { type, parentIds } = selectedEntity;
                    if (type === "module" && versionId) {
                      updateModule.mutate({
                        params: { path: { versionId, moduleId: selectedEntity.data.moduleId } },
                        body: { name: newName }
                      });
                      setSelectedEntity({ ...selectedEntity, data: { ...selectedEntity.data, name: newName } });
                    }
                    if (type === "section" && versionId && parentIds?.moduleId) {
                      updateSection.mutate({
                        params: { path: { versionId, moduleId: parentIds.moduleId, sectionId: selectedEntity.data.sectionId } },
                        body: { name: newName }
                      });
                      setSelectedEntity({ ...selectedEntity, data: { ...selectedEntity.data, name: newName } });
                    }
                    if (type === "item" && versionId && parentIds?.moduleId && parentIds?.sectionId) {
                      updateItem.mutate({
                        params: { path: { versionId, moduleId: parentIds.moduleId, sectionId: parentIds.sectionId, itemId: selectedEntity.data._id } },
                        body: { name: newName }
                      });
                      setSelectedEntity({ ...selectedEntity, data: { ...selectedEntity.data, name: newName } });
                    }
                  }}
                />

                {/* Update Button for Module/Section */}
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
                          params: { path: { versionId, moduleId: selectedEntity.parentIds.moduleId, sectionId: selectedEntity.data.sectionId } },
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
                        setExpandedModules((prev) => ({ ...prev, [selectedEntity.data.moduleId]: false }));
                      }
                    }
                    if (type === "section" && versionId && parentIds?.moduleId) {
                      if (window.confirm("Are you sure you want to delete this section and all its items?")) {
                        deleteSection.mutate({
                          params: { path: { versionId, moduleId: parentIds.moduleId, sectionId: selectedEntity.data.sectionId } }
                        });
                        setSelectedEntity(null);
                        setExpandedSections((prev) => ({ ...prev, [selectedEntity.data.sectionId]: false }));
                      }
                    }
                    if (type === "item" && parentIds?.sectionId && selectedEntity.data._id) {
                      if (window.confirm("Are you sure you want to delete this item?")) {
                        deleteItem.mutate({
                          params: { path: { itemsGroupId: parentIds.sectionId, itemId: selectedEntity.data._id } }
                        });
                        setSelectedEntity(null);
                      }
                    }
                  }}
                >
                  Delete {selectedEntity.type}
                </Button>

                <div className="mt-4 p-4 border rounded-md bg-muted/30">
                  <p className="text-sm font-medium mb-2 text-muted-foreground">Preview</p>
                  <div className="text-sm text-muted-foreground">
                    {selectedEntity.type === 'item' && selectedItemData ? (
                      <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(selectedItemData, null, 2)}</pre>
                    ) : (
                      <>Preview not available for this type.</>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Select a module, section, or item to begin editing.</p>
            )}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}