"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";
import { Heart } from "lucide-react";

export type EmotionType = "very_sad" | "sad" | "neutral" | "happy" | "very_happy";

interface EmotionSelectorProps {
  itemId: string;
  onEmotionSelect: (emotion: EmotionType, feedbackText?: string) => Promise<void>;
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
  const [pendingEmotion, setPendingEmotion] = useState<EmotionType | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const activeEmotion = pendingEmotion || selectedEmotion;
  const trimmedFeedback = feedbackText.trim();

  const finalizeEmotion = async (emotion: EmotionType, learnerNote?: string) => {
    setIsSubmitting(true);
    try {
      await onEmotionSelect(emotion, learnerNote);
      setSubmitted(true);
      setPendingEmotion(null);
      setFeedbackText("");
    } catch (error) {
      console.error("Error submitting emotion:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmotionClick = (emotion: EmotionType) => {
    if (disabled || isSubmitting) return;

    setPendingEmotion(emotion);
    setSubmitted(false);
    setFeedbackText("");
  };

  const handleSkip = async () => {
    if (!pendingEmotion) return;
    await finalizeEmotion(pendingEmotion);
  };

  const handleSubmitNote = async () => {
    if (!pendingEmotion || !trimmedFeedback) return;
    await finalizeEmotion(pendingEmotion, trimmedFeedback);
  };

  return (
    <div className="rounded-lg border border-primary/10 bg-gradient-to-r from-primary/5 to-accent/5 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-0.5 min-w-max">
          <span className="text-xs font-semibold text-foreground">How are you feeling?</span>
          <span className="text-[10px] text-muted-foreground">About this content</span>
        </div>

        <div className="flex gap-2 lg:ml-auto">
          {(Object.keys(emotionConfig) as EmotionType[]).map((emotion) => {
            const config = emotionConfig[emotion];
            const isSelected = activeEmotion === emotion;

            return (
              <Tooltip key={`${itemId}-${emotion}`}>
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

        {submitted && !pendingEmotion && (
          <div className="text-xs text-green-600 font-medium flex items-center gap-1 lg:ml-2">
            <Heart className="h-3 w-3 fill-current" />
            <span>Thanks for sharing!</span>
          </div>
        )}
      </div>

      {pendingEmotion && (
        <div className="mt-3 rounded-md border bg-background/80 p-3">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-2xl leading-none">{emotionConfig[pendingEmotion].emoji}</span>
            <div>
              <p className="text-sm font-medium">
                {(() => {
                  switch (pendingEmotion) {
                    case "very_sad":
                      return "Tell us why this content is too difficult or frustrating.";
                    case "sad":
                      return "Tell us why you're struggling with this content.";
                    case "neutral":
                      return "Tell us why this content feels just okay.";
                    case "happy":
                      return "Tell us what you enjoyed about this content.";
                    case "very_happy":
                      return "Tell us why this content is amazing!";
                    default:
                      return "Tell us more if you want.";
                  }
                })()}
                <span className="text-xs text-muted-foreground ml-2">(optional)</span>
              </p>
            </div>
          </div>
          <Textarea
            value={feedbackText}
            onChange={(event) => setFeedbackText(event.target.value.slice(0, 300))}
            placeholder={
              pendingEmotion
                ? `${emotionConfig[pendingEmotion].description} because...`
                : "Add a short note about what made you feel this way..."
            }
            className="min-h-20 resize-none text-sm"
            disabled={isSubmitting}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">{feedbackText.length}/300</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleSkip} disabled={isSubmitting}>
                Skip
              </Button>
              <Button type="button" size="sm" onClick={handleSubmitNote} disabled={isSubmitting || !trimmedFeedback}>
                Submit note
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
