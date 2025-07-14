import React, { useState } from "react";
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

import { useCourseStore } from "@/store/course-store";

// import Article from "@/components/article";
// import Video from "@/components/video";
// import Quiz from "@/components/quiz";

// ✅ Icons per item type
const getItemIcon = (type: string) => {
  switch (type) {
    case "article": return <FileText className="h-3 w-3" />;
    case "video": return <VideoIcon className="h-3 w-3" />;
    case "quiz": return <ListChecks className="h-3 w-3" />;
    default: return null;
  }
};

const generateId = () => Math.random().toString(36).substring(2, 10);

export default function TeacherCoursePage() {
  const { currentCourse } = useCourseStore();
  const [modules, setModules] = useState(currentCourse?.modules || []); // Wrong way, won't work.
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [selectedEntity, setSelectedEntity] = useState<{
    type: "module" | "section" | "item";
    data: any;
    parentIds?: { moduleId: string; sectionId?: string };
  } | null>(null);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleAddModule = () => {
    const newModule = {
      moduleId: generateId(),
      name: "Untitled Module",
      sections: [],
    };
    setModules((prev) => [...prev, newModule]);
    setExpandedModules((prev) => ({ ...prev, [newModule.moduleId]: true }));
    setSelectedEntity({ type: "module", data: newModule });
  };

  const handleAddSection = (moduleId: string) => {
    const newSection = {
      sectionId: generateId(),
      name: "New Section",
      items: [],
    };
    setModules((prev) =>
      prev.map((mod) =>
        mod.moduleId === moduleId
          ? { ...mod, sections: [...mod.sections, newSection] }
          : mod
      )
    );
    setSelectedEntity({ type: "section", data: newSection, parentIds: { moduleId } });
  };

  const handleAddItem = (moduleId: string, sectionId: string, type: string) => {
    const newItem = {
      _id: generateId(),
      type,
      name: `New ${type}`,
      content: "<p>Sample article content</p>",
    };

    setModules((prev) =>
      prev.map((mod) =>
        mod.moduleId === moduleId
          ? {
              ...mod,
              sections: mod.sections.map((sec) =>
                sec.sectionId === sectionId
                  ? { ...sec, items: [...sec.items, newItem] }
                  : sec
              ),
            }
          : mod
      )
    );

    setSelectedEntity({
      type: "item",
      data: newItem,
      parentIds: { moduleId, sectionId },
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
                {modules.map((module) => (
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
                        {module.sections.map((section) => (
                          <SidebarMenuSubItem key={section.sectionId}>
                            <SidebarMenuSubButton
                              onClick={() => {
                                toggleSection(section.sectionId);
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
                                {section.items.map((item) => (
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
                    setModules((prev) =>
                      prev.map((mod) => {
                        if (type === "module" && mod.moduleId === selectedEntity.data.moduleId) {
                          const updated = { ...mod, name: newName };
                          setSelectedEntity({ type, data: updated });
                          return updated;
                        }
                        if (type === "section" && mod.moduleId === parentIds?.moduleId) {
                          const updatedSections = mod.sections.map((sec) =>
                            sec.sectionId === selectedEntity.data.sectionId
                              ? { ...sec, name: newName }
                              : sec
                          );
                          return { ...mod, sections: updatedSections };
                        }
                        if (type === "item" && mod.moduleId === parentIds?.moduleId) {
                          const updatedSections = mod.sections.map((sec) => {
                            if (sec.sectionId === parentIds?.sectionId) {
                              const updatedItems = sec.items.map((it) =>
                                it._id === selectedEntity.data._id
                                  ? (() => {
                                      const updated = { ...it, name: newName };
                                      setSelectedEntity({ type, data: updated, parentIds });
                                      return updated;
                                    })()
                                  : it
                              );
                              return { ...sec, items: updatedItems };
                            }
                            return sec;
                          });
                          return { ...mod, sections: updatedSections };
                        }
                        return mod;
                      })
                    );
                  }}
                />

                <Button
                  variant="destructive"
                  onClick={() => {
                    const { type, parentIds } = selectedEntity;
                    setModules((prev) =>
                      prev
                        .map((mod) => {
                          if (type === "module" && mod.moduleId === selectedEntity.data.moduleId) return null;
                          if (type === "section" && mod.moduleId === parentIds?.moduleId) {
                            return {
                              ...mod,
                              sections: mod.sections.filter(
                                (sec) => sec.sectionId !== selectedEntity.data.sectionId
                              ),
                            };
                          }
                          if (type === "item" && mod.moduleId === parentIds?.moduleId) {
                            const updatedSections = mod.sections.map((sec) =>
                              sec.sectionId === parentIds.sectionId
                                ? {
                                    ...sec,
                                    items: sec.items.filter(
                                      (it) => it._id !== selectedEntity.data._id
                                    ),
                                  }
                                : sec
                            );
                            return { ...mod, sections: updatedSections };
                          }
                          return mod;
                        })
                        .filter(Boolean)
                    );
                    setSelectedEntity(null);
                  }}
                >
                  Delete {selectedEntity.type}
                </Button>

                <div className="mt-4 p-4 border rounded-md bg-muted/30">
                  <p className="text-sm font-medium mb-2 text-muted-foreground">Preview</p>
                  <div className="text-sm text-muted-foreground">
                    Preview not available for this type.
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