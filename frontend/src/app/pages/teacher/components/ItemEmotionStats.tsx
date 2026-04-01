"use client";

import { useEmotionStats } from "@/hooks/use-emotion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ItemEmotionStatsProps {
  itemId: string;
  itemName: string;
}

const emotionConfig = {
  very_sad: { emoji: "😢", label: "Very Sad", color: "#ef4444" },
  sad: { emoji: "😟", label: "Sad", color: "#f97316" },
  neutral: { emoji: "🤔", label: "Neutral", color: "#eab308" },
  happy: { emoji: "😊", label: "Happy", color: "#84cc16" },
  very_happy: { emoji: "🤩", label: "Very Happy", color: "#22c55e" },
};

export function ItemEmotionStats({ itemId, itemName }: ItemEmotionStatsProps) {
  const { data: stats, isLoading, error } = useEmotionStats(itemId);

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (error || !stats || stats.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        No emotions yet
      </div>
    );
  }

  const total = stats.reduce((sum: number, s: any) => sum + s.count, 0);
  
  // Calculate sentiment score
  const sentimentScore = stats.reduce((score: number, s: any) => {
    const weights = { very_sad: -2, sad: -1, neutral: 0, happy: 1, very_happy: 2 };
    return score + (s.count * (weights[s.emotion as keyof typeof weights] || 0));
  }, 0) / (total || 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">Learner Emotions</div>
        <Badge variant="outline" className="text-xs">
          {total} responses
        </Badge>
      </div>
      
      <div className="flex items-center gap-1 flex-wrap">
        {stats.map((stat: any) => {
          const config = emotionConfig[stat.emotion as keyof typeof emotionConfig];
          return (
            <div
              key={stat.emotion}
              className="flex items-center gap-1 px-2 py-1 rounded-md"
              style={{ backgroundColor: `${config.color}20` }}
              title={`${config.label}: ${stat.count} (${stat.percentage.toFixed(1)}%)`}
            >
              <span className="text-sm">{config.emoji}</span>
              <span className="text-xs font-semibold">{stat.count}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Sentiment:</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{sentimentScore.toFixed(2)}</span>
          <span>
            {sentimentScore > 1 ? "🤩" : sentimentScore > 0.5 ? "😊" : sentimentScore > -0.5 ? "🤔" : sentimentScore > -1.5 ? "😟" : "😢"}
          </span>
        </div>
      </div>
    </div>
  );
}
