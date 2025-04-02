import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function CreateCourse() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleCreateCourse = () => {
    console.log("Creating course with:", { title, description });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Create New Course</h1>
      <Card className="p-6">
        <Input
          className="mb-4"
          placeholder="Course Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          className="mb-4"
          placeholder="Course Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button onClick={handleCreateCourse}>Create Course</Button>
      </Card>
    </div>
  );
}
