import { useMemo } from "react"
import { CheckCircle2, Circle, Pencil } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { User } from "@/types/auth.types"

interface ProfileCompletionCardProps {
  user: User | null
  onFieldClick?: (field: string) => void
  currentEditField?: string | null
}

interface ProfileField {
  label: string
  key: string
  isCompleted: boolean
}

function getProgressTextColor(pct: number): string {
  if (pct <= 30) return "text-red-600 dark:text-red-400"
  if (pct <= 70) return "text-yellow-600 dark:text-yellow-400"
  return "text-green-600 dark:text-green-400"
}

function getAchievementMessage(pct: number): string {
  if (pct === 100) return "🎉 Your profile is fully complete."
  if (pct >= 71) return "Almost there! Just a few more details."
  if (pct >= 31) return "Great progress! Just a few more details."
  return "Complete your profile to personalize your learning experience."
}

export default function ProfileCompletionCard({
  user,
  onFieldClick,
  currentEditField,
}: ProfileCompletionCardProps) {
  const { percentage, completedFields, missingFields } = useMemo(() => {
    const fields: ProfileField[] = [
      { label: "First Name", key: "firstName", isCompleted: !!user?.firstName?.trim() },
      { label: "Last Name", key: "lastName", isCompleted: !!user?.lastName?.trim() },
      { label: "Email", key: "email", isCompleted: !!user?.email?.trim() },
      { label: "Avatar", key: "avatar", isCompleted: !!user?.avatar?.trim() },
      { label: "Gender", key: "gender", isCompleted: !!user?.gender?.trim() },
      { label: "Country", key: "country", isCompleted: !!user?.country?.trim() },
      { label: "City", key: "city", isCompleted: !!user?.city?.trim() },
    ]

    const completed = fields.filter((f) => f.isCompleted)
    const missing = fields.filter((f) => !f.isCompleted)
    const pct = Math.round((completed.length / fields.length) * 100)

    return { percentage: pct, completedFields: completed, missingFields: missing }
  }, [user])

  const textColorClass = getProgressTextColor(percentage)
  const completedCount = completedFields.length
  const missingCount = missingFields.length
  const totalFields = completedCount + missingCount

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Profile Completion</CardTitle>
          <span
            className={`text-2xl font-bold tabular-nums ${textColorClass}`}
            aria-label={`${percentage}% complete`}
          >
            {percentage}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Progress
            value={percentage}
            className="h-2.5"
            aria-label={`Profile completion progress: ${percentage}%`}
          />
          <style>{`
            [data-slot="progress-indicator"] {
              transition: background-color 500ms ease-in-out, transform 500ms ease-in-out !important;
            }
            [data-slot="progress"] [data-slot="progress-indicator"] {
              background-color: ${percentage <= 30 ? "hsl(0 84% 60%)" : percentage <= 70 ? "hsl(48 96% 53%)" : "hsl(142 71% 45%)"} !important;
            }
          `}</style>
        </div>

        <p className="text-sm text-muted-foreground">
          You've completed{" "}
          <span className={`font-semibold ${textColorClass}`}>{completedCount}</span> of{" "}
          {totalFields} profile sections.
          {missingCount > 0 && (
            <span className="ml-1">
              {missingCount} {missingCount === 1 ? "field" : "fields"} remaining.
            </span>
          )}
        </p>

        <p className="text-sm font-medium text-foreground">
          {getAchievementMessage(percentage)}
        </p>

        {missingCount > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Missing information
            </p>
            <ul className="space-y-1" role="list">
              {missingFields.map((field) => (
                <li key={field.key}>
                  <button
                    type="button"
                    onClick={() => onFieldClick?.(field.key)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                      currentEditField === field.key
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                    aria-label={`${field.label} is missing. Click to edit.`}
                  >
                    <Circle
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-left">{field.label}</span>
                    {currentEditField === field.key ? (
                      <Pencil
                        className="h-3.5 w-3.5 shrink-0 text-primary"
                        aria-label="Currently editing"
                      />
                    ) : (
                      <span className="text-xs opacity-0 transition-opacity group-hover:opacity-100">
                        Click to edit
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {completedCount > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Completed
            </p>
            <ul className="space-y-1" role="list">
              {completedFields.map((field) => (
                <li
                  key={field.key}
                  className="flex items-center gap-2 px-2 py-1 text-sm text-green-600 dark:text-green-400"
                >
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  {field.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
