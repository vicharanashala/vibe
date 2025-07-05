"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

import ModuleForm from "./components/ModuleForm";
import { SidebarNavigation } from "./components/SidebarNavigation";

import {
  useCreateCourse,
  useCreateCourseVersion,
  useCreateModule,
  useCreateSection,
  useEnrollUser
} from "@/hooks/hooks";

import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function AddCoursePage() {
  const [courseName, setCourseName] = useState("");
  const [courseDescription, setCourseDescription] = useState("");

  const [versionName, setVersionName] = useState("");
  const [versionChangelog, setVersionChangelog] = useState("");

  const [firebaseUID, setFirebaseUID] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modules, setModules] = useState([
    {
      id: `module-${Date.now()}`,
      name: "",
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

  // ✅ Firebase Auth like before — No change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUID(user.uid);
        setFirebaseUser(user);
      } else {
        window.location.href = "/login";
      }
    });
    return () => unsubscribe();
  }, []);

  const { mutateAsync: createCourse } = useCreateCourse();
  const { mutateAsync: createVersion } = useCreateCourseVersion();
  const { mutateAsync: createModule } = useCreateModule();
  const { mutateAsync: createSection } = useCreateSection();
  const { mutateAsync: enrollUser } = useEnrollUser();

  const addModule = () => {
    const newId = `module-${Date.now() + Math.random()}`;
    setModules((prev) => [
      ...prev,
      { id: newId, name: "", sections: [] },
    ]);
  };

  const updateModule = (index: number, updatedModule: any) => {
    setModules((prev) =>
      prev.map((mod, i) => (i === index ? updatedModule : mod))
    );
  };

  const handleSubmit = async () => {
    try {
      if (!firebaseUID || !user?.data?._id) {
        alert("You must be logged in as a teacher to create a course.");
        return;
      }
      if (
        !courseName.trim() ||
        !courseDescription.trim() ||
        !versionName.trim() ||
        !versionChangelog.trim()
      ) {
        alert("Please fill all required fields.");
        return;
      }

      setIsSubmitting(true);

      // Step 1: Create course
      const courseRes = await createCourse({
        body: {
          name: courseName,
          description: courseDescription,
        },
      });
      const courseId = courseRes.data._id;

      // Step 2: Create version
      const versionRes = await createVersion({
        params: { path: { id: courseId } },
        body: {
          name: versionName,
          changelog: versionChangelog,
        },
      });
      const versionId = versionRes.data._id;

      // Step 3: Create modules and sections
      for (const mod of modules) {
        const moduleRes = await createModule({
          params: { path: { versionId } },
          body: { name: mod.name },
        });
        const moduleId = moduleRes.data._id;

        for (const sec of mod.sections) {
          await createSection({
            params: { path: { versionId, moduleId } },
            body: { name: sec.name },
          });
        }
      }

      // Step 4: Enroll teacher
      await enrollUser({
        params: {
          path: {
            userId: user.data._id,
            courseId,
            courseVersionId: versionId,
          },
        },
      });

      alert("✅ Course created and teacher enrolled!");
      window.location.href = "/dashboard/courses";
    } catch (error) {
      console.error("❌ Error during course creation:", error);
      alert("Failed to create course. Check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedModule = selected.moduleId
    ? modules.find((m) => m.id === selected.moduleId)
    : null;
  const selectedSection = selectedModule?.sections.find(
    (s) => s.id === selected.sectionId
  );
  const selectedContentItem = selectedSection?.contentItems?.find(
    (c) => c.id === selected.contentItemId
  );

  return (
    <div className="flex h-screen">
      <SidebarNavigation
        modules={modules}
        selected={selected}
        onSelect={setSelected}
      />
      <div className="flex-1 p-8 space-y-6 overflow-y-auto">
        <h1 className="text-2xl font-bold">Add New Course</h1>

        {/* Course Info */}
        {!selected.moduleId && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <Input
                placeholder="Course Name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
              />
              <Textarea
                placeholder="Course Description"
                value={courseDescription}
                onChange={(e) => setCourseDescription(e.target.value)}
              />
              <Input
                placeholder="Version Name (e.g., v1.0)"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
              />
              <Textarea
                placeholder="Version Changelog (e.g., Initial Release)"
                value={versionChangelog}
                onChange={(e) => setVersionChangelog(e.target.value)}
              />
            </CardContent>
          </Card>
        )}

        {/* Modules */}
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
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Module
          </Button>
        </div>

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Course"}
        </Button>
      </div>
    </div>
  );
}
