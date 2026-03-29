"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCourseEmotionReport } from "@/hooks/use-emotion";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp } from "lucide-react";

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

export function EmotionAnalyticsDashboard({ courseId, courseVersionId }: EmotionAnalyticsDashboardProps) {
  const { data: report, isLoading, error } = useCourseEmotionReport(courseId, courseVersionId);

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

  const { distribution, percentages, averageSentiment, total } = report;

  // Prepare chart data
  const chartData = Object.entries(emotionConfig).map(([key, config]) => ({
    name: config.label,
    emoji: config.emoji,
    value: distribution[key as keyof typeof distribution] || 0,
    percentage: (percentages[key as keyof typeof percentages] || 0).toFixed(1),
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

  const sentimentLevel = getSentimentLabel(averageSentiment);
  const isNegative = averageSentiment < -0.5;

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

      {/* Sentiment Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">emotion submissions recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{averageSentiment.toFixed(2)}</div>
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
              {((percentages.happy + percentages.very_happy) || 0).toFixed(1)}%
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
                <Tooltip
                  formatter={(value) => value}
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emotion Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="emoji" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Emotion Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.value} responses</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <p className="text-sm font-semibold mt-1">{item.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
