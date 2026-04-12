import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const CourseBackButton = () => {
  return (
    <Button
      variant="ghost"
      className="mb-4 flex items-center gap-2"
      onClick={() => window.history.back()}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
};

export default CourseBackButton;