import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const CourseBackButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      className="mb-4 flex items-center gap-2"
      onClick={() => navigate({ to: "/teacher" })}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
};

export default CourseBackButton;