import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCourse } from "@/hooks/hooks";

export default function CreateCourse() {
  const [name, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCourseMutation = useCreateCourse();

  const handleCreateCourse = async () => {
    setSuccess(false);
    setError(null);

    try {
      await createCourseMutation.mutateAsync({
        body: {
          name,
          description
        }
      });

      setSuccess(true);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Create New Course</h1>
      <Card className="p-6">
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
          <div className="text-green-600 mt-2">Course created successfully!</div>
        )}
        {error && (
          <div className="text-red-500 mt-2">{error}</div>
        )}
      </Card>
    </div>
  );
}
