import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, BookOpen, Plus } from "lucide-react";
import { useCreateCourse, useCreateCourseVersion, useInviteUsers } from "@/hooks/hooks";
import { useAuthStore } from "@/store/auth-store";


export default function CreateCourse() {
  const [name, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [versionDescription, setVersionDescription] = useState("");
  const [versionSuccess, setVersionSuccess] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [createErrors, setCreateErrors] = useState({ name: "", description: "" });
  // Removed unused courseVersionId state

  const createCourseMutation = useCreateCourse();
  const createCourseVersionMutation = useCreateCourseVersion();
  const inviteUsersMutation = useInviteUsers();

  const teacherEmail = useAuthStore.getState().user?.email || "";

  const handleCreateCourse = async () => {
    if (!name.trim() || !description.trim()) {
      setCreateErrors({
        name: !name.trim() ? "Course title is required" : "",
        description: !description.trim() ? "Course description is required" : "",
      });
      return;
    }
    setCreateErrors({ name: "", description: "" });
    setSuccess(false);
    setError(null);
    setShowVersionForm(false);
    setCourseId(null);
    // removed setCourseVersionId(null); (no longer used)
    setVersionSuccess(false);
    setVersionError(null);

    try {
      const res = await createCourseMutation.mutateAsync({
        body: {
          name,
          description
        }
      });
      // Assume response contains id
      const id = res?._id;
      if (id) {
        setCourseId(id);
        setShowVersionForm(true);
        setSuccess(true);
        setTitle("");
        setDescription("");
      } else {
        setError("Course created but no ID returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    }
  };

  const handleCreateVersion = async () => {
    if (!courseId) return;
    setVersionSuccess(false);
    setVersionError(null);
    try {
      const res = await createCourseVersionMutation.mutateAsync({
        params: { path: { id: courseId } },
        body: {
          version: versionLabel,
          description: versionDescription
        }
      });
      const versionId = res?._id;
      if (versionId) {
        setVersionSuccess(true);
        // Automatically send invite to teacher
        await inviteUsersMutation.mutateAsync({
          params: { path: { courseId, courseVersionId: versionId } },
          body: {
            inviteData: [
              {
                email: teacherEmail,
                role: "INSTRUCTOR"
              }
            ]
          }
        });
      } else {
        setVersionError("Version created but no ID returned");
      }
    } catch (err) {
      setVersionError(err instanceof Error ? err.message : "Failed to create course version");
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl blur-3xl"></div>
          <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg blur-sm"></div>
                <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
                  <BookOpen className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Create New Course</h1>
            </div>
            <p className="text-muted-foreground">Build amazing learning experiences for your students</p>
          </div>
        </div>

        {/* Course Creation Form */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm"></div>
          <Card className="relative bg-card/95 backdrop-blur-sm border border-border/50 p-6">
            <div>
              <Input
                className="mb-2 bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300"
                placeholder="Course Title"
                value={name}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (!e.target.value) {
                    setCreateErrors((prev) => ({ ...prev, name: "Course title is required" }));
                  } else {
                    setCreateErrors((prev) => ({ ...prev, name: "" }));
                  }
                }}
              />
              {createErrors?.name && (
                <div className="text-red-500">{createErrors?.name}</div>
              )}
            </div>
            <div>
              <Textarea
                className="mb-2 bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300"
                placeholder="Course Description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  if (!e.target.value) {
                    setCreateErrors((prev) => ({ ...prev, description: "Course description is required" }))
                  } else {
                    setCreateErrors((prev) => ({ ...prev, description: "" }))
                  }
                }}
              />
              {createErrors?.description && (
                <div className="text-red-500">{createErrors?.description}</div>
              )}
            </div>
        <Button 
          onClick={handleCreateCourse} 
          disabled={createCourseMutation.isPending}
          className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-[length:100%_auto] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 px-8 group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-white/30 rounded-full blur-sm animate-ping opacity-75"></div>
              {createCourseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
              )}
            </div>
            <span className="font-semibold">
              {createCourseMutation.isPending ? "Creating..." : "Create Course"}
            </span>
          </div>
        </Button>
        {success && (
          <div className="text-green-600 mt-2">Course created successfully! Now create the first version for your course.</div>
        )}
        {error && (
          <div className="text-red-500 mt-2">{error}</div>
        )}
          </Card>
        </div>

        {/* Version Creation Form */}
        {showVersionForm && (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-primary/5 rounded-xl blur-sm"></div>
            <Card className="relative bg-card/95 backdrop-blur-sm border border-border/50 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-accent to-primary rounded-lg blur-sm"></div>
                  <div className="relative bg-gradient-to-r from-accent to-primary p-2 rounded-lg">
                    <Plus className="h-5 w-5 text-primary-foreground" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground">Create First Version</h2>
              </div>
              <Input
                className="mb-4 bg-background border-border focus:border-primary focus:ring-primary/20"
                placeholder="Version Label (e.g. v1.0, Fall 2025)"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
              />
              <Textarea
                className="mb-4 bg-background border-border focus:border-primary focus:ring-primary/20"
                placeholder="Version Description"
                value={versionDescription}
                onChange={(e) => setVersionDescription(e.target.value)}
              />
              <Button 
                onClick={handleCreateVersion} 
                disabled={createCourseVersionMutation.isPending || !versionLabel}
                className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-[length:100%_auto] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 px-8 group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <div className="relative flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/30 rounded-full blur-sm animate-ping opacity-75"></div>
                    {createCourseVersionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                    )}
                  </div>
                  <span className="font-semibold">
                    {createCourseVersionMutation.isPending ? "Creating Version..." : "Create Version"}
                  </span>
                </div>
              </Button>
              {versionSuccess && (
                <div className="text-green-600 mt-2">Version created and invite sent to your email!</div>
              )}
              {versionError && (
                <div className="text-red-500 mt-2">{versionError}</div>
              )}
              {inviteUsersMutation.isPending && (
                <div className="text-blue-600 mt-2">Sending invite...</div>
              )}
              {inviteUsersMutation.isError && (
                <div className="text-red-500 mt-2">{inviteUsersMutation.error}</div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
