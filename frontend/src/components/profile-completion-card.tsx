"use client"

import React from "react"
import { CheckCircle2, Circle, Zap, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import type { User } from "@/types/auth.types"

interface ProfileCompletionCardProps {
  user: User | null
  onFieldClick?: (field: string) => void
  currentEditField?: string | null
}

const PROFILE_FIELDS = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "avatar", label: "Avatar" },
  { key: "gender", label: "Gender" },
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
] as const

export default function ProfileCompletionCard({
  user,
  onFieldClick,
  currentEditField,
}: ProfileCompletionCardProps) {
  const completionData = React.useMemo(() => {
    if (!user) {
      return {
        percentage: 0,
        completedFields: [],
        missingFields: PROFILE_FIELDS.map((f) => f.key),
      }
    }

    const completedFields: string[] = []
    const missingFields: string[] = []

    for (const field of PROFILE_FIELDS) {
      const value = user[field.key as keyof User]
      if (value && String(value).trim() !== "") {
        completedFields.push(field.key)
      } else {
        missingFields.push(field.key)
      }
    }

    const percentage = Math.round((completedFields.length / PROFILE_FIELDS.length) * 100)

    return { percentage, completedFields, missingFields }
  }, [user])

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-emerald-500"
    if (percentage >= 50) return "bg-amber-500"
    return "bg-red-500"
  }

  const getStrengthLevel = (percentage: number) => {
    if (percentage >= 91) return { level: "Excellent", color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" }
    if (percentage >= 61) return { level: "Complete", color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30" }
    if (percentage >= 31) return { level: "Growing", color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30" }
    return { level: "Beginner", color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" }
  }

  const getNextSuggestion = (missingFields: string[]) => {
    if (missingFields.length === 0) return null
    const suggestions: Record<string, string> = {
      firstName: "Add your first name to personalize your profile",
      lastName: "Add your last name to complete your identity",
      email: "Verify your email address",
      avatar: "Upload a profile picture",
      gender: "Select your gender to help others connect with you",
      country: "Add your country to find local opportunities",
      state: "Add your state to discover nearby events",
      city: "Add your city to connect with your community",
    }
    const nextField = missingFields[0]
    return { field: nextField, message: suggestions[nextField] || `Add your ${nextField}` }
  }

  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Profile Completion</CardTitle>
        <CardDescription>
          {completionData.percentage === 100
            ? "Your profile is complete!"
            : `Complete your profile to help others connect with you`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Progress</span>
            <span className="text-sm font-bold">{completionData.percentage}%</span>
          </div>
          <Progress
            value={completionData.percentage}
            className={`h-2 ${getProgressColor(completionData.percentage)}`}
          />
        </div>

        {/* Profile Strength */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${getStrengthLevel(completionData.percentage).textColor}`} />
              <span className="text-sm font-medium">Profile Strength</span>
            </div>
            <Badge
              variant="secondary"
              className={`${getStrengthLevel(completionData.percentage).bgColor} ${getStrengthLevel(completionData.percentage).textColor} font-semibold`}
            >
              {getStrengthLevel(completionData.percentage).level}
            </Badge>
          </div>

          {/* Strength Indicator Bar */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-500 ${getStrengthLevel(completionData.percentage).color}`}
              style={{ width: `${completionData.percentage}%` }}
            />
            {/* Level markers */}
            <div className="absolute inset-0 flex">
              <div className="w-[30%] border-r border-white/50" />
              <div className="w-[31%] border-r border-white/50" />
              <div className="w-[30%] border-r border-white/50" />
              <div className="w-[9%]" />
            </div>
          </div>

          {/* Level Labels */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className={completionData.percentage <= 30 ? "font-medium text-foreground" : ""}>Beginner</span>
            <span className={completionData.percentage > 30 && completionData.percentage <= 60 ? "font-medium text-foreground" : ""}>Growing</span>
            <span className={completionData.percentage > 60 && completionData.percentage <= 90 ? "font-medium text-foreground" : ""}>Complete</span>
            <span className={completionData.percentage > 90 ? "font-medium text-foreground" : ""}>Excellent</span>
          </div>

          {/* Next Step Suggestion */}
          {(() => {
            const suggestion = getNextSuggestion(completionData.missingFields)
            if (!suggestion) return null
            return (
              <div className="flex items-center gap-2 rounded-md bg-primary/5 p-2.5 text-sm">
                <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">Next step:</span>{" "}
                  {suggestion.message}
                </span>
                <button
                  onClick={() => onFieldClick?.(suggestion.field)}
                  className="ml-auto text-xs font-medium text-primary hover:underline shrink-0"
                >
                  Add now
                </button>
              </div>
            )
          })()}
        </div>

        {/* Completed Fields */}
        {completionData.completedFields.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Completed
            </p>
            <div className="flex flex-wrap gap-2">
              {completionData.completedFields.map((fieldKey) => {
                const field = PROFILE_FIELDS.find((f) => f.key === fieldKey)
                return (
                  <button
                    key={fieldKey}
                    onClick={() => onFieldClick?.(fieldKey)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      currentEditField === fieldKey
                        ? "bg-primary/20 text-primary"
                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {field?.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Missing Fields */}
        {completionData.missingFields.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Missing
            </p>
            <div className="flex flex-wrap gap-2">
              {completionData.missingFields.map((fieldKey) => {
                const field = PROFILE_FIELDS.find((f) => f.key === fieldKey)
                return (
                  <button
                    key={fieldKey}
                    onClick={() => onFieldClick?.(fieldKey)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      currentEditField === fieldKey
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <Circle className="h-3 w-3" />
                    {field?.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
