"use client";

import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCourseStore } from "@/store/course-store";
import { EmotionAnalyticsDashboard } from "./components/EmotionAnalyticsDashboard";

export default function CourseEmotionAnalyticsPage() {
  const navigate = useNavigate();
  const currentCourse = useCourseStore((state) => state.currentCourse);
  const courseId = currentCourse?.courseId || "";
  const versionId = currentCourse?.versionId || "";

  useEffect(() => {
    if (!courseId || !versionId) {
      navigate({ to: "/teacher/courses/enrollments" });
    }
  }, [courseId, versionId, navigate]);

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        className="flex items-center gap-2"
        onClick={() => navigate({ to: "/teacher/courses/enrollments" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Enrollments
      </Button>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Learner Emotion Analytics</CardTitle>
          <p className="text-sm text-muted-foreground">
            Course, module comparison, and module-level drilldown insights.
          </p>
        </CardHeader>
        <CardContent>
          <EmotionAnalyticsDashboard courseId={courseId} courseVersionId={versionId} />
        </CardContent>
      </Card>
    </div>
  );
}
