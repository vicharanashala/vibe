import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import ModuleForm from "./components/ModuleForm";
import {SidebarNavigation} from "@/app/pages/teacher/components/SidebarNavigation";


export default function AddCoursePage() {
  const [modules, setModules] = useState([
    {
      id: "module-0",
      name: "Module 1",
      sections: [],
    },
  ]);

  const [selected, setSelected] = useState({
    moduleId: null,
    sectionId: null,
    contentItemId: null,
  });

  const contentItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (selected.contentItemId) {
      const el = contentItemRefs.current.get(selected.contentItemId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [selected.contentItemId]);

  const addModule = () => {
    const newId = `module-${modules.length}`;
    setModules((prev) => [
      ...prev,
      { id: newId, name: `Module ${prev.length + 1}`, sections: [] },
    ]);
  };

  const updateModule = (index: number, updatedModule: any) => {
    setModules((prev) =>
      prev.map((mod, i) => (i === index ? updatedModule : mod))
    );
  };

  const selectedModule = selected.moduleId
    ? modules.find((m) => m.id === selected.moduleId)
    : null;

  const selectedSection = selectedModule?.sections.find(
    (s) => s.id === selected.sectionId
  );

  const selectedContentItem = selectedSection?.contentItems.find(
    (c) => c.id === selected.contentItemId
  );

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <SidebarNavigation
        modules={modules}
        selected={selected}
        onSelect={setSelected}
      />

      {/* Main Content */}
      <div className="flex-1 p-8 space-y-6 overflow-y-auto">
        <h1 className="text-2xl font-bold">Add New Course</h1>

        {/* Course Info - default screen */}
        {!selected.moduleId && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <Input placeholder="Course Name" className="w-full" />
              <Textarea placeholder="Course Description" className="w-full" />
            </CardContent>
          </Card>
        )}

        {/* All Modules */}
        <div className="space-y-4">
          {modules.map((module, index) => (
            <ModuleForm
              key={module.id}
              moduleIndex={index}
              moduleData={module}
              onModuleChange={(updated) => updateModule(index, updated)}
              selected={selected}
              contentItemRefs={contentItemRefs}
            />
          ))}

          <Button onClick={addModule} variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Module
          </Button>
        </div>
      </div>
    </div>
  );
}
