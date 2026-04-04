"use client";

import { useEmotionHistory } from "@/hooks/use-emotion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StudentEmotionJourneyProps {
  courseId: string;
  courseVersionId: string;
  studentName?: string;
}

const emotionScores = {
  very_sad: -2,
  sad: -1,
  neutral: 0,
  happy: 1,
  very_happy: 2,
};

const emotionConfig = {
  very_sad: { emoji: "😢", label: "Very Sad", color: "#ef4444" },
  sad: { emoji: "😟", label: "Sad", color: "#f97316" },
  neutral: { emoji: "🤔", label: "Neutral", color: "#eab308" },
  happy: { emoji: "😊", label: "Happy", color: "#84cc16" },
  very_happy: { emoji: "🤩", label: "Very Happy", color: "#22c55e" },
};

export function StudentEmotionJourney({ courseId, courseVersionId, studentName = "Student" }: StudentEmotionJourneyProps) {
  const { data: history, isLoading, error } = useEmotionHistory(courseId, courseVersionId);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (error || !history || history.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No emotion history yet
        </CardContent>
      </Card>
    );
  }

  // Process data for chart
  const chartData = history
    .slice()
    .reverse()
    .map((emotion: any, index: number) => ({
      index: index + 1,
      timestamp: new Date(emotion.createdAt).toLocaleDateString(),
      emotion: emotion.emotion,
      score: emotionScores[emotion.emotion as keyof typeof emotionScores],
      emoji: emotionConfig[emotion.emotion as keyof typeof emotionConfig].emoji,
    }));

  const movingAverage = chartData.map((_, idx) => {
    const window = chartData.slice(Math.max(0, idx - 2), idx + 1);
    const avg = window.reduce((sum, d) => sum + d.score, 0) / window.length;
    return { ...chartData[idx], movingAvg: avg };
  });

  const firstScore = movingAverage[0]?.movingAvg || 0;
  const lastScore = movingAverage[movingAverage.length - 1]?.movingAvg || 0;
  const isTrendingUp = lastScore > firstScore;

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-2xl">
              {chartData[chartData.length - 1].emoji}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Most Recent</p>
            <p className="text-sm font-semibold">
              {emotionConfig[chartData[chartData.length - 1].emotion as keyof typeof emotionConfig].label}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-2xl flex items-center gap-1">
              {isTrendingUp ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Trend</p>
            <p className="text-sm font-semibold">
              {isTrendingUp ? "Improving ↗" : "Declining ↘"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-2xl">📊</div>
            <p className="text-xs text-muted-foreground mt-1">Total Items</p>
            <p className="text-sm font-semibold">{chartData.length} responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-2xl">⭐</div>
            <p className="text-xs text-muted-foreground mt-1">Avg Sentiment</p>
            <p className="text-sm font-semibold">
              {(chartData.reduce((sum, d) => sum + d.score, 0) / chartData.length).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emotion Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="index"
                name="Item"
                label={{ value: "Course Progress", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                type="number"
                dataKey="score"
                name="Sentiment"
                domain={[-2, 2]}
                label={{ value: "Sentiment Score", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (active && payload && payload[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 rounded-md border border-gray-200 shadow-lg dark:bg-gray-800 dark:border-gray-600">
                        <p className="text-sm font-semibold">{data.timestamp}</p>
                        <p className="text-sm">{data.emoji} {emotionConfig[data.emotion as keyof typeof emotionConfig].label}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="Emotions" data={chartData} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Emotion History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emotion History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {chartData.reverse().map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 hover:bg-accent/50 rounded-md">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold">
                      {emotionConfig[item.emotion as keyof typeof emotionConfig].label}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                  </div>
                </div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Score: {item.score > 0 ? "+" : ""}{item.score}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
