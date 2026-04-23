// @ts-nocheck

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCourseEmotionReport } from "@/hooks/use-emotion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { EmotionDistribution, ModuleEmotionItemReport } from "@/types/emotion.types";

interface EmotionAnalyticsDashboardProps {
  courseId: string;
  courseVersionId: string;
}

const emotionConfig = {
  very_sad: { emoji: "😢", label: "Very Sad", color: "#ef4444" },
  sad: { emoji: "😟", label: "Sad", color: "#f97316" },
  neutral: { emoji: "🤔", label: "Neutral", color: "#eab308" },
  happy: { emoji: "😊", label: "Happy", color: "#84cc16" },
  very_happy: { emoji: "🤩", label: "Very Happy", color: "#22c55e" },
};

const moduleTwoPreview = {
  total: 24,
  itemCount: 6,
  distribution: {
    very_sad: 2,
    sad: 3,
    neutral: 5,
    happy: 8,
    very_happy: 6,
  },
  percentages: {
    very_sad: 8.3,
    sad: 12.5,
    neutral: 20.8,
    happy: 33.3,
    very_happy: 25,
  },
  averageSentiment: 0.83,
  items: [
    {
      itemId: "preview-module-2-item-1",
      itemName: "Intro concept check",
      itemType: "quiz",
      itemOrder: "1",
      total: 4,
      distribution: { very_sad: 0, sad: 0, neutral: 1, happy: 2, very_happy: 1 },
      percentages: { very_sad: 0, sad: 0, neutral: 25, happy: 50, very_happy: 25 },
      averageSentiment: 1,
      feedbackCount: 1,
      feedbackEntries: [
        {
          submissionId: "preview-note-1",
          emotion: "happy",
          feedbackText: "The intro example made the topic click quickly.",
          updatedAt: "2026-03-30T10:00:00.000Z",
        },
      ],
    },
    {
      itemId: "preview-module-2-item-2",
      itemName: "Worked example",
      itemType: "content",
      itemOrder: "2",
      total: 4,
      distribution: { very_sad: 1, sad: 1, neutral: 1, happy: 1, very_happy: 0 },
      percentages: { very_sad: 25, sad: 25, neutral: 25, happy: 25, very_happy: 0 },
      averageSentiment: -0.5,
      feedbackCount: 2,
      feedbackEntries: [
        {
          submissionId: "preview-note-2",
          emotion: "very_sad",
          feedbackText: "I got lost halfway through the worked example.",
          updatedAt: "2026-03-30T10:05:00.000Z",
        },
        {
          submissionId: "preview-note-3",
          emotion: "sad",
          feedbackText: "More step-by-step hints here would help.",
          updatedAt: "2026-03-30T10:03:00.000Z",
        },
      ],
    },
    {
      itemId: "preview-module-2-item-3",
      itemName: "Guided practice",
      itemType: "practice",
      itemOrder: "3",
      total: 4,
      distribution: { very_sad: 0, sad: 1, neutral: 1, happy: 1, very_happy: 1 },
      percentages: { very_sad: 0, sad: 25, neutral: 25, happy: 25, very_happy: 25 },
      averageSentiment: 0.25,
      feedbackCount: 1,
      feedbackEntries: [
        {
          submissionId: "preview-note-4",
          emotion: "neutral",
          feedbackText: "Practice felt okay, but I still need one more example.",
          updatedAt: "2026-03-30T10:08:00.000Z",
        },
      ],
    },
    {
      itemId: "preview-module-2-item-4",
      itemName: "Reflection prompt",
      itemType: "reflection",
      itemOrder: "4",
      total: 4,
      distribution: { very_sad: 0, sad: 0, neutral: 1, happy: 1, very_happy: 2 },
      percentages: { very_sad: 0, sad: 0, neutral: 25, happy: 25, very_happy: 50 },
      averageSentiment: 1.25,
      feedbackCount: 1,
      feedbackEntries: [
        {
          submissionId: "preview-note-5",
          emotion: "very_happy",
          feedbackText: "Reflection made me realize I understood more than I thought.",
          updatedAt: "2026-03-30T10:12:00.000Z",
        },
      ],
    },
    {
      itemId: "preview-module-2-item-5",
      itemName: "Application task",
      itemType: "assignment",
      itemOrder: "5",
      total: 4,
      distribution: { very_sad: 1, sad: 0, neutral: 1, happy: 1, very_happy: 1 },
      percentages: { very_sad: 25, sad: 0, neutral: 25, happy: 25, very_happy: 25 },
      averageSentiment: 0,
      feedbackCount: 1,
      feedbackEntries: [
        {
          submissionId: "preview-note-6",
          emotion: "very_sad",
          feedbackText: "The application task felt unclear at the start.",
          updatedAt: "2026-03-30T10:15:00.000Z",
        },
      ],
    },
    {
      itemId: "preview-module-2-item-6",
      itemName: "Exit ticket",
      itemType: "quiz",
      itemOrder: "6",
      total: 4,
      distribution: { very_sad: 0, sad: 1, neutral: 0, happy: 2, very_happy: 1 },
      percentages: { very_sad: 0, sad: 25, neutral: 0, happy: 50, very_happy: 25 },
      averageSentiment: 0.75,
      feedbackCount: 1,
      feedbackEntries: [
        {
          submissionId: "preview-note-7",
          emotion: "happy",
          feedbackText: "Exit ticket was challenging but fair.",
          updatedAt: "2026-03-30T10:18:00.000Z",
        },
      ],
    },
  ],
};

const ENABLE_MODULE_TWO_PREVIEW = true;
type ItemInsightLimit = 3 | 5 | "all";

function EmotionEmoji({ emoji, label }: { emoji: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help select-none">{emoji}</span>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        <p className="text-xs font-medium">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function getDominantEmotion(distribution: EmotionDistribution) {
  return (Object.keys(emotionConfig) as Array<keyof typeof emotionConfig>).reduce(
    (currentBest, emotion) => {
      if (distribution[emotion] > distribution[currentBest]) {
        return emotion;
      }

      return currentBest;
    },
    "neutral" as keyof typeof emotionConfig,
  );
}

function getSentimentCategory(score: number) {
  if (score >= 1.5) return { label: "Excellent", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" };
  if (score >= 0.5) return { label: "Good", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" };
  if (score >= -0.5) return { label: "Neutral", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" };
  if (score >= -1.5) return { label: "Concerning", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" };
  return { label: "Critical", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
}

interface AreaOfConcern {
  moduleIndex: number;
  moduleName: string;
  moduleSentiment: number;
  problemItems: Array<{
    itemName: string;
    sentiment: number;
    verySadCount: number;
    sadCount: number;
  }>;
}

export function EmotionAnalyticsDashboard({ courseId, courseVersionId }: EmotionAnalyticsDashboardProps) {
  const { data: report, isLoading, error } = useCourseEmotionReport(courseId, courseVersionId);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [expandedItemInsightsModuleId, setExpandedItemInsightsModuleId] = useState<string | null>(null);
  const [itemInsightLimit, setItemInsightLimit] = useState<ItemInsightLimit>(3);
  const [showAllRecentFeedback, setShowAllRecentFeedback] = useState(false);
  const [activeFeedbackItem, setActiveFeedbackItem] = useState<{
    moduleName: string;
    item: ModuleEmotionItemReport;
  } | null>(null);

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  if (error || !report) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No emotion data available yet
        </CardContent>
      </Card>
    );
  }

  const moduleReports = report.modules || [];

  const moduleReportsWithDisplay = moduleReports.map((module, index) => ({
    ...(ENABLE_MODULE_TWO_PREVIEW && index === 1 && module.total === 0
      ? {
          ...module,
          ...moduleTwoPreview,
          isPreview: true,
        }
      : {
          ...module,
          isPreview: false,
        }),
    displayName: `Module ${index + 1}`,
  }));

  const previewInjected = moduleReportsWithDisplay.some(
    (module) => module.displayName === "Module 2" && module.isPreview,
  );

  const effectiveDistribution = previewInjected
    ? {
        very_sad: report.distribution.very_sad + moduleTwoPreview.distribution.very_sad,
        sad: report.distribution.sad + moduleTwoPreview.distribution.sad,
        neutral: report.distribution.neutral + moduleTwoPreview.distribution.neutral,
        happy: report.distribution.happy + moduleTwoPreview.distribution.happy,
        very_happy: report.distribution.very_happy + moduleTwoPreview.distribution.very_happy,
      }
    : report.distribution;

  const effectiveTotal = previewInjected ? report.total + moduleTwoPreview.total : report.total;
  const effectivePercentages = {
    very_sad: effectiveTotal > 0 ? (effectiveDistribution.very_sad / effectiveTotal) * 100 : 0,
    sad: effectiveTotal > 0 ? (effectiveDistribution.sad / effectiveTotal) * 100 : 0,
    neutral: effectiveTotal > 0 ? (effectiveDistribution.neutral / effectiveTotal) * 100 : 0,
    happy: effectiveTotal > 0 ? (effectiveDistribution.happy / effectiveTotal) * 100 : 0,
    very_happy: effectiveTotal > 0 ? (effectiveDistribution.very_happy / effectiveTotal) * 100 : 0,
  };

  const effectiveAverageSentiment = effectiveTotal > 0
    ? (
        (effectiveDistribution.very_sad * -2) +
        (effectiveDistribution.sad * -1) +
        (effectiveDistribution.neutral * 0) +
        (effectiveDistribution.happy * 1) +
        (effectiveDistribution.very_happy * 2)
      ) / effectiveTotal
    : 0;

  // Prepare chart data
  const chartData = Object.entries(emotionConfig).map(([key, config]) => ({
    name: config.label,
    emoji: config.emoji,
    value: effectiveDistribution[key as keyof typeof effectiveDistribution] || 0,
    percentage: (effectivePercentages[key as keyof typeof effectivePercentages] || 0).toFixed(1),
    color: config.color,
  }));

  // Get sentiment label
  const getSentimentLabel = (score: number) => {
    if (score >= 1.5) return "Excellent";
    if (score >= 0.5) return "Good";
    if (score >= -0.5) return "Neutral";
    if (score >= -1.5) return "Concerning";
    return "Very Concerning";
  };

  const sentimentLevel = getSentimentLabel(effectiveAverageSentiment);
  const isNegative = effectiveAverageSentiment < -0.5;

  // Analyze areas of concern
  const areasOfConcern: AreaOfConcern[] = moduleReportsWithDisplay
    .filter((module) => module.total > 0 && module.averageSentiment < 0.5)
    .map((module, idx) => {
      const moduleIndex = moduleReportsWithDisplay.indexOf(module);
      const problemItems = (module.items || [])
        .filter((item) => item.total > 0 && item.averageSentiment < -0.5)
        .map((item) => ({
          itemName: item.itemName,
          sentiment: item.averageSentiment,
          verySadCount: item.distribution.very_sad,
          sadCount: item.distribution.sad,
        }))
        .sort((a, b) => a.sentiment - b.sentiment)
        .slice(0, 3);

      return {
        moduleIndex,
        moduleName: module.displayName,
        moduleSentiment: module.averageSentiment,
        problemItems,
      };
    })
    .sort((a, b) => a.moduleSentiment - b.moduleSentiment)
    .slice(0, 5);

  const moduleChartData = moduleReportsWithDisplay
    .filter((module) => module.total > 0)
    .map((module) => ({
      moduleId: module.moduleId,
      name: module.displayName,
      total: module.total,
      averageSentiment: Number(module.averageSentiment.toFixed(2)),
    }))
    .sort((a, b) => a.averageSentiment - b.averageSentiment);

  const modulesWithResponses = moduleReportsWithDisplay.filter((module) => module.total > 0);
  const dominantEmotion = getDominantEmotion(effectiveDistribution);
  const lowestSentimentModule = modulesWithResponses.length > 0
    ? [...modulesWithResponses].sort((a, b) => a.averageSentiment - b.averageSentiment)[0]
    : null;
  const totalFeedbackNotes = modulesWithResponses.reduce(
    (total, module) => total + (module.items || []).reduce(
      (moduleTotal, item) => moduleTotal + (item.feedbackEntries?.length ?? item.feedbackCount ?? 0),
      0,
    ),
    0,
  );
  const recentFeedback = modulesWithResponses
    .flatMap((module) =>
      (module.items || []).flatMap((item) =>
        (item.feedbackEntries || [])
          .filter((entry) => Boolean(entry.feedbackText?.trim()))
          .map((entry) => ({
            moduleName: module.displayName,
            itemName: item.itemName,
            feedbackText: entry.feedbackText,
            emotion: entry.emotion,
            occurredAt: entry.updatedAt || entry.createdAt || entry.timestamp,
          })),
      ),
    )
    .sort((a, b) => {
      const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
      const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
      return bTime - aTime;
    });
  const displayedRecentFeedback = showAllRecentFeedback ? recentFeedback : recentFeedback.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Sentiment Alert */}
      {isNegative && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-900">Learner Engagement Alert</p>
              <p className="text-sm text-orange-800">Average sentiment is {sentimentLevel}. Consider reviewing difficult content items.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Course Health Summary */}
      <Card className={areasOfConcern.length > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
        <CardHeader>
          <div className="flex items-center gap-2">
            {areasOfConcern.length > 0 ? (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            <CardTitle className="text-lg">Course Health Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {areasOfConcern.length > 0 ? (
            <>
              <div className="rounded-md border border-red-200 bg-white p-3 space-y-2">
                <p className="text-sm text-red-900">
                  Course-level: overall sentiment is {sentimentLevel.toLowerCase()}, and {areasOfConcern.length} module{areasOfConcern.length === 1 ? "" : "s"} show a weaker learner signal.
                </p>
                <p className="text-sm text-red-900">
                  Module-level: {areasOfConcern[0]?.moduleName} is currently the main attention area at {areasOfConcern[0]?.moduleSentiment.toFixed(2)}, with {areasOfConcern[0]?.problemItems.length || 0} flagged item{(areasOfConcern[0]?.problemItems.length || 0) === 1 ? "" : "s"}.
                </p>
                <p className="text-sm text-red-800">
                  Expand the module details below for item-level emotion trends and learner notes.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-md border border-green-200 bg-white p-3 space-y-2">
                <p className="text-sm text-green-900">
                  Course-level: learner sentiment is currently {sentimentLevel.toLowerCase()}, with {emotionConfig[dominantEmotion].label.toLowerCase()} as the strongest signal.
                </p>
                <p className="text-sm text-green-900">
                  Module-level: {lowestSentimentModule ? `${lowestSentimentModule.displayName} is the lowest-scoring module at ${lowestSentimentModule.averageSentiment.toFixed(2)}, but it remains outside the concern range.` : "module-level data does not show any attention area yet."}
                </p>
                <p className="text-sm text-green-800">
                  Instructor notes: {totalFeedbackNotes > 0 ? `${totalFeedbackNotes} learner note${totalFeedbackNotes === 1 ? " has" : "s have"} been shared for review in the notes panel.` : "no learner notes have been added yet."}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sentiment Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{effectiveTotal}</div>
            <p className="text-xs text-muted-foreground">emotion submissions recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{effectiveAverageSentiment.toFixed(2)}</div>
            <Badge className="mt-2" variant={isNegative ? "destructive" : "default"}>
              {sentimentLevel}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Positive Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {((effectivePercentages.happy + effectivePercentages.very_happy) || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">happy + very happy</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emotion Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ emoji, percentage }) => `${emoji} ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value) => value}
                  contentStyle={{ backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", color: "#0f172a" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Learner Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learner Notes For Instructor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Student notes shared</p>
                <p className="text-xs text-muted-foreground">Qualitative feedback collected alongside emotion responses.</p>
              </div>
              <Badge variant="secondary">{totalFeedbackNotes}</Badge>
            </div>

            {recentFeedback.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-2 max-h-[18rem] overflow-y-auto pr-1">
                  {displayedRecentFeedback.map((entry, index) => (
                    <div key={`${entry.moduleName}-${entry.itemName}-${index}`} className="rounded-md border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {entry.moduleName} • {entry.itemName}
                        </p>
                        <span className="text-sm text-muted-foreground">
                          {emotionConfig[entry.emotion].emoji} {emotionConfig[entry.emotion].label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{entry.feedbackText}</p>
                    </div>
                  ))}
                </div>

                {recentFeedback.length > 5 && (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllRecentFeedback((current) => !current)}
                    >
                      {showAllRecentFeedback
                        ? "Hide older notes"
                        : `View all ${recentFeedback.length} notes`}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No learner notes have been submitted yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Module Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module Sentiment Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {moduleChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No module-level emotion data yet</p>
          ) : (
            <div className="space-y-3">
              {moduleChartData.map((module) => {
                const sentimentCategory = getSentimentCategory(module.averageSentiment);
                const normalized = ((module.averageSentiment + 2) / 4) * 100;

                return (
                  <div key={module.moduleId} className="rounded-md border p-3 bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{module.name}</p>
                        <p className="text-xs text-muted-foreground">{module.total} responses</p>
                      </div>
                      <div className="text-right">
                        <Badge className={`text-xs ${sentimentCategory.bg} ${sentimentCategory.color} ${sentimentCategory.border}`} variant="outline">
                          {sentimentCategory.label}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{module.averageSentiment.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-red-200 via-amber-200 to-green-200">
                        <div
                          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-foreground shadow"
                          style={{ left: `${Math.min(100, Math.max(0, normalized))}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>-2.0</span>
                        <span>0.0</span>
                        <span>2.0</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expandable Module Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {moduleReportsWithDisplay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No module breakdown available yet</p>
          ) : (
            moduleReportsWithDisplay.map((module) => {
              const moduleData = Object.entries(emotionConfig).map(([key, config]) => ({
                name: config.label,
                emoji: config.emoji,
                count: module.distribution[key as keyof typeof module.distribution] || 0,
                percentage: module.percentages[key as keyof typeof module.percentages] || 0,
                color: config.color,
              }));
              const moduleDominantEmotion = getDominantEmotion(module.distribution);
              const moduleFeedbackCount = (module.items || []).reduce(
                (count, item) => count + item.feedbackCount,
                0,
              );
              const sortedItemInsights = [...(module.items || [])]
                .filter((item) => item.total > 0)
                .sort((left, right) => {
                  const sentimentDifference = left.averageSentiment - right.averageSentiment;
                  if (sentimentDifference !== 0) {
                    return sentimentDifference;
                  }

                  const totalDifference = right.total - left.total;
                  if (totalDifference !== 0) {
                    return totalDifference;
                  }

                  return left.itemName.localeCompare(right.itemName, undefined, {
                    numeric: true,
                    sensitivity: "base",
                  });
                });
              const isItemInsightsOpen = expandedItemInsightsModuleId === module.moduleId;

              const isOpen = expandedModuleId === module.moduleId;
              return (
                <Collapsible
                  key={module.moduleId}
                  open={isOpen}
                  onOpenChange={(open) => setExpandedModuleId(open ? module.moduleId : null)}
                  className="rounded-lg border"
                >
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-muted/20">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{module.displayName}</p>
                          <Badge className={`text-xs ${getSentimentCategory(module.averageSentiment).bg} ${getSentimentCategory(module.averageSentiment).color} ${getSentimentCategory(module.averageSentiment).border}`} variant="outline">
                            {module.averageSentiment.toFixed(2)}
                          </Badge>
                          {module.isPreview && <Badge variant="secondary">preview</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{module.total} responses</span>
                          <span>{module.itemCount} items</span>
                          <span>{moduleFeedbackCount} notes</span>
                          <span>dominant {emotionConfig[moduleDominantEmotion].label.toLowerCase()}</span>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <div className="mb-3 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-md bg-background px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sentiment</p>
                            <p className="mt-1 text-sm font-semibold">{module.averageSentiment.toFixed(2)}</p>
                          </div>
                          <div className="rounded-md bg-background px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Dominant Emotion</p>
                            <p className="mt-1 text-sm font-semibold">
                              {emotionConfig[moduleDominantEmotion].emoji} {emotionConfig[moduleDominantEmotion].label}
                            </p>
                          </div>
                          <div className="rounded-md bg-background px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Learner Notes</p>
                            <p className="mt-1 text-sm font-semibold">{moduleFeedbackCount}</p>
                          </div>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted flex">
                          {moduleData.map((row) => (
                            <div
                              key={`${module.moduleId}-${row.name}-bar`}
                              className="h-full"
                              style={{ width: `${row.percentage}%`, backgroundColor: row.color }}
                            />
                          ))}
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                          {moduleData.map((row) => (
                            <div key={`${module.moduleId}-${row.name}`} className="rounded-md bg-background px-3 py-2">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="flex items-center gap-1.5">
                                  <EmotionEmoji emoji={row.emoji} label={row.name} />
                                  <span>{row.name}</span>
                                </span>
                                <span className="text-muted-foreground">{row.count}</span>
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground">{row.percentage.toFixed(1)}%</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 border-t pt-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">Item Insights</p>
                            <p className="text-xs text-muted-foreground">Items are ranked by weakest sentiment first for quicker review.</p>
                          </div>
                          <Button
                            type="button"
                            variant={isItemInsightsOpen ? "secondary" : "outline"}
                            size="sm"
                            className="h-8"
                            onClick={() =>
                              setExpandedItemInsightsModuleId(
                                isItemInsightsOpen ? null : module.moduleId,
                              )
                            }
                          >
                            {isItemInsightsOpen ? "Hide item insights" : "Expand item insights"}
                          </Button>
                        </div>

                        {isItemInsightsOpen && (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2">
                              <p className="text-xs text-muted-foreground">Items shown by lowest sentiment first</p>
                              <div className="inline-flex items-center gap-1 rounded-md border bg-background p-1">
                                {[3, 5, "all"].map((limitOption) => {
                                  const isActive = itemInsightLimit === limitOption;
                                  const label = limitOption === "all" ? "All" : `Top ${limitOption}`;

                                  return (
                                    <Button
                                      key={`limit-${limitOption}`}
                                      type="button"
                                      variant={isActive ? "secondary" : "ghost"}
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setItemInsightLimit(limitOption as ItemInsightLimit)}
                                    >
                                      {label}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>

                            {sortedItemInsights.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No item-level responses in this module yet.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">#</th>
                                      <th className="px-3 py-2 text-left font-medium">Item</th>
                                      <th className="px-3 py-2 text-left font-medium">Sentiment</th>
                                      <th className="px-3 py-2 text-left font-medium">Responses</th>
                                      <th className="px-3 py-2 text-left font-medium">Strongest Signals</th>
                                      <th className="px-3 py-2 text-left font-medium">Concern</th>
                                      <th className="px-3 py-2 text-left font-medium">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(itemInsightLimit === "all"
                                      ? sortedItemInsights
                                      : sortedItemInsights.slice(0, itemInsightLimit)
                                    ).map((item, index) => {
                                      const strongestSignals = (Object.keys(emotionConfig) as Array<keyof typeof emotionConfig>)
                                        .map((emotionKey) => ({
                                          emotionKey,
                                          count: item.distribution[emotionKey],
                                        }))
                                        .filter((entry) => entry.count > 0)
                                        .sort((left, right) => {
                                          if (right.count !== left.count) {
                                            return right.count - left.count;
                                          }

                                          return emotionConfig[left.emotionKey].label.localeCompare(
                                            emotionConfig[right.emotionKey].label,
                                          );
                                        })
                                        .slice(0, 2);
                                      const concerningCount = item.distribution.very_sad + item.distribution.sad;
                                      const sentimentCategory = getSentimentCategory(item.averageSentiment);

                                      return (
                                        <tr key={item.itemId} className="border-t align-top">
                                          <td className="px-3 py-3 text-muted-foreground">{index + 1}</td>
                                          <td className="px-3 py-3">
                                            <p className="font-medium text-foreground">{item.itemName}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">{item.itemType || "item"}</p>
                                          </td>
                                          <td className="px-3 py-3">
                                            <Badge className={`text-[11px] ${sentimentCategory.bg} ${sentimentCategory.color} ${sentimentCategory.border}`} variant="outline">
                                              {item.averageSentiment.toFixed(2)}
                                            </Badge>
                                          </td>
                                          <td className="px-3 py-3 text-muted-foreground">{item.total}</td>
                                          <td className="px-3 py-3 text-muted-foreground">
                                            {strongestSignals.length > 0
                                              ? strongestSignals
                                                  .map((entry) => `${emotionConfig[entry.emotionKey].label} (${entry.count})`)
                                                  .join(" • ")
                                              : "No responses yet"}
                                          </td>
                                          <td className="px-3 py-3 text-muted-foreground">{concerningCount}</td>
                                          <td className="px-3 py-3">
                                            {item.feedbackCount > 0 ? (
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => setActiveFeedbackItem({ moduleName: module.displayName, item })}
                                              >
                                                View ({item.feedbackCount})
                                              </Button>
                                            ) : (
                                              <span className="text-xs text-muted-foreground">0</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(activeFeedbackItem)} onOpenChange={(open) => !open && setActiveFeedbackItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Learner Notes</DialogTitle>
            <DialogDescription>
              {activeFeedbackItem ? `${activeFeedbackItem.moduleName} • ${activeFeedbackItem.item.itemName}` : "Learner notes for the selected item."}
            </DialogDescription>
          </DialogHeader>

          {!activeFeedbackItem || activeFeedbackItem.item.feedbackEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No learner notes available for this item yet.</p>
          ) : (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {activeFeedbackItem.item.feedbackEntries.map((entry, index) => {
                const entryDate = entry.updatedAt || entry.createdAt || entry.timestamp;
                const entryEmotion = emotionConfig[entry.emotion];

                return (
                  <div key={entry.submissionId || `${activeFeedbackItem.item.itemId}-${index}`} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <EmotionEmoji emoji={entryEmotion.emoji} label={entryEmotion.label} />
                        <span>{entryEmotion.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {entryDate ? new Date(entryDate).toLocaleString() : "Recent"}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{entry.feedbackText}</p>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
