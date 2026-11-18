import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuizPerformanceCardProps {
  score: number | null;
  total: number;
}

export const QuizPerformanceCard: React.FC<QuizPerformanceCardProps> = ({ score, total }) => {
  const percentage = score !== null ? Math.round((score / total) * 100) : null;

  // Helper to get a descriptive performance status badge
  const getPerformanceLabel = (pct: number | null) => {
    if (pct === null) return null;
    if (pct >= 85) return { label: "Excellent", style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" };
    if (pct >= 70) return { label: "Good", style: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" };
    if (pct >= 50) return { label: "Average", style: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" };
    return { label: "Needs Improvement", style: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" };
  };

  const badge = getPerformanceLabel(percentage);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Quiz Performance</CardTitle>
        {badge && (
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge.style}`}>
            {badge.label}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {score !== null ? `${score} / ${total}` : "N/A"}
        </div>
        <p className="text-xs text-muted-foreground">
          {percentage !== null ? `${percentage}% overall score` : "No quiz taken yet"}
        </p>
      </CardContent>
    </Card>
  );
};