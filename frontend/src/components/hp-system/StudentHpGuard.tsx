import { type ReactNode, useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useStudentHpEnabled } from "@/hooks/hooks";

/**
 * The HP System is opt-in per course, so a learner only reaches these pages
 * while a course they are enrolled in has it switched on. Hiding the nav entry
 * is not enough on its own — a typed URL or a stale tab has to land somewhere
 * sensible too.
 */
export function StudentHpGuard({ children }: { children: ReactNode }) {
  const { courseVersionId } = useParams({ strict: false });
  const { hpEnabled, isLoading } = useStudentHpEnabled(courseVersionId);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !hpEnabled) {
      navigate({ to: "/student", replace: true });
    }
  }, [isLoading, hpEnabled, navigate]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-[50vh]">
        Loading...
      </div>
    );
  }

  if (!hpEnabled) return null;

  return <>{children}</>;
}
