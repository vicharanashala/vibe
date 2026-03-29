"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils/utils";
import { Heart } from "lucide-react";

export type EmotionType = "very_sad" | "sad" | "neutral" | "happy" | "very_happy";

interface EmotionSelectorProps {
  itemId: string;
  onEmotionSelect: (emotion: EmotionType) => Promise<void>;
  disabled?: boolean;
  selectedEmotion?: EmotionType | null;
}

const emotionConfig = {
  very_sad: {
    emoji: "😢",
    label: "Very Sad",
    description: "This content is too difficult or frustrating",
    color: "text-red-500 hover:text-red-600",
  },
  sad: {
    emoji: "😟",
    label: "Sad",
    description: "I'm struggling with this",
    color: "text-orange-500 hover:text-orange-600",
  },
  neutral: {
    emoji: "🤔",
    label: "Neutral",
    description: "It's okay, nothing special",
    color: "text-yellow-500 hover:text-yellow-600",
  },
  happy: {
    emoji: "😊",
    label: "Happy",
    description: "I'm enjoying this",
    color: "text-lime-500 hover:text-lime-600",
  },
  very_happy: {
    emoji: "🤩",
    label: "Very Happy",
    description: "This is amazing!",
    color: "text-green-500 hover:text-green-600",
  },
};

export function EmotionSelector({
  itemId,
  onEmotionSelect,
  disabled = false,
  selectedEmotion = null,
}: EmotionSelectorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(selectedEmotion !== null);

  const handleEmotionClick = async (emotion: EmotionType) => {
    if (disabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onEmotionSelect(emotion);
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting emotion:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
      {/* Label */}
      <div className="flex flex-col gap-0.5 min-w-max">
        <span className="text-xs font-semibold text-foreground">How are you feeling?</span>
        <span className="text-[10px] text-muted-foreground">About this content</span>
      </div>

      {/* Emotion Buttons */}
      <div className="flex gap-2 ml-auto">
        {(Object.keys(emotionConfig) as EmotionType[]).map((emotion) => {
          const config = emotionConfig[emotion];
          const isSelected = selectedEmotion === emotion;

          return (
            <Tooltip key={emotion}>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-11 w-11 p-0 rounded-full transition-all duration-200 ease-out",
                    "hover:scale-125 hover:bg-accent/25 hover:shadow-md",
                    isSelected && "scale-115 bg-accent/30 ring-2 ring-accent/50 shadow-sm",
                    disabled || isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  )}
                  onClick={() => handleEmotionClick(emotion)}
                  disabled={disabled || isSubmitting}
                  title={config.label}
                >
                  <span className="text-2xl leading-none">{config.emoji}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center" className="text-xs">
                <div className="space-y-1">
                  <p className="font-semibold">{config.label}</p>
                  <p className="text-muted-foreground">{config.description}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Feedback indicator */}
      {submitted && (
        <div className="ml-2 text-xs text-green-600 font-medium flex items-center gap-1">
          <Heart className="h-3 w-3 fill-current" />
          <span>Thanks for sharing!</span>
        </div>
      )}
    </div>
  );
}
