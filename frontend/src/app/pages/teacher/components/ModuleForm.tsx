import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SectionForm from "./SectionForm";
import { PlusCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ContentItem {
  id: string;
  type: string;
  title: string;
}

interface Section {
  id: string;
  title: string;
  contentItems: ContentItem[];
}

interface Module {
  id: string;
  name: string;
  sections: Section[];
}

interface ModuleFormProps {
  moduleIndex: number;
  moduleData: Module;
  onModuleChange: (updatedModule: Module) => void;
  selected: {
    moduleId: string | null;
    sectionId: string | null;
    contentItemId: string | null;
  };
  contentItemRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

export default function ModuleForm({
  moduleIndex,
  moduleData,
  onModuleChange,
  selected,
  contentItemRefs,
}: ModuleFormProps) {
  const updateModuleName = (name: string) => {
    onModuleChange({ ...moduleData, name });
  };

  const addSection = () => {
    const uniqueSectionId = `section-${Date.now()}-${Math.random()}`;
    const newSection: Section = {
      id: uniqueSectionId,
      title: `New Section ${moduleData.sections.length + 1}`,
      contentItems: [],
    };
    onModuleChange({
      ...moduleData,
      sections: [...moduleData.sections, newSection],
    });
  };

  const updateSection = (updatedSection: Section, sectionIndex: number) => {
    const updatedSections = [...moduleData.sections];
    updatedSections[sectionIndex] = updatedSection;
    onModuleChange({ ...moduleData, sections: updatedSections });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Module {moduleIndex + 1}</h2>
        <Input
          placeholder="Module Name"
          className="w-full"
          value={moduleData.name}
          onChange={(e) => updateModuleName(e.target.value)}
        />

        {moduleData.sections.map((section, index) => (
          <SectionForm
            key={section.id}
            sectionIndex={index}
            sectionData={section}
            onSectionChange={(updatedSection) =>
              updateSection(updatedSection, index)
            }
            selected={selected}
            contentItemRefs={contentItemRefs}
          />
        ))}

        <Button onClick={addSection} variant="ghost">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Section
        </Button>
      </CardContent>
    </Card>
  );
}
