import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  // Removed unused courseVersionId state

  const createCourseMutation = useCreateCourse();
  const createCourseVersionMutation = useCreateCourseVersion();
  const inviteUsersMutation = useInviteUsers();

  const teacherEmail = useAuthStore.getState().user?.email || "";

  const handleCreateCourse = async () => {
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
    <div>
      <h1 className="text-2xl font-bold mb-4">Create New Course</h1>
      <Card className="p-6 mb-6">
        <Input
          className="mb-4"
          placeholder="Course Title"
          value={name}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          className="mb-4"
          placeholder="Course Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button onClick={handleCreateCourse} disabled={createCourseMutation.isPending}>
          {createCourseMutation.isPending ? "Creating..." : "Create Course"}
        </Button>
        {success && (
          <div className="text-green-600 mt-2">Course created successfully! Now create the first version for your course.</div>
        )}
        {error && (
          <div className="text-red-500 mt-2">{error}</div>
        )}
      </Card>

      {showVersionForm && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create First Version</h2>
          <Input
            className="mb-4"
            placeholder="Version Label (e.g. v1.0, Fall 2025)"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
          />
          <Textarea
            className="mb-4"
            placeholder="Version Description"
            value={versionDescription}
            onChange={(e) => setVersionDescription(e.target.value)}
          />
          <Button onClick={handleCreateVersion} disabled={createCourseVersionMutation.isPending || !versionLabel}>
            {createCourseVersionMutation.isPending ? "Creating Version..." : "Create Version"}
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
      )}
    </div>
  );
}
