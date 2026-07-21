import React from "react"
import { BookOpen, Award, GraduationCap, UserPlus, Clock, CheckCircle2, FileText, Star, Inbox } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/utils/utils"
import { motion } from "motion/react"

export interface Activity {
  icon: React.ReactNode
  title: string
  description: string
  timestamp: string
  variant?: "default" | "success" | "warning" | "info"
}

const VARIANT_STYLES: Record<NonNullable<Activity["variant"]>, { dot: string; icon: string }> = {
  default: { dot: "bg-muted-foreground/40", icon: "bg-muted text-muted-foreground" },
  success: { dot: "bg-emerald-500", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400" },
  warning: { dot: "bg-amber-500", icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400" },
  info: { dot: "bg-blue-500", icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" },
}

const PLACEHOLDER_ACTIVITIES: Activity[] = [
  {
    icon: <GraduationCap className="h-4 w-4" />,
    title: "Enrolled in a course",
    description: "Welcome aboard! Start exploring your courses.",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    variant: "info",
  },
  {
    icon: <BookOpen className="h-4 w-4" />,
    title: "Started learning",
    description: "Begin your first lesson to track your progress.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    variant: "default",
  },
  {
    icon: <Award className="h-4 w-4" />,
    title: "Complete a quiz",
    description: "Test your knowledge and earn achievements.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    variant: "default",
  },
]

function getRelativeTime(isoTimestamp: string): string {
  const now = Date.now()
  const then = new Date(isoTimestamp).getTime()
  const diffMs = now - then

  if (diffMs < 0) return "just now"

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return "just now"

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`

  return new Date(isoTimestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export default function ProfileActivityTimeline({ activities }: { activities?: Activity[] }) {
  const items = activities && activities.length > 0 ? activities : PLACEHOLDER_ACTIVITIES

  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2.5 text-lg md:text-xl font-bold">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>Your latest actions and milestones</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-2">
        <div className="relative space-y-0">
          {/* Vertical timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

          {items.map((activity, index) => {
            const styles = VARIANT_STYLES[activity.variant ?? "default"]
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className={cn(
                  "relative flex gap-4 py-3 transition-colors duration-150 rounded-md -mx-2 px-2",
                  "hover:bg-accent/50"
                )}
              >
                {/* Dot */}
                <div className="relative z-10 mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full",
                      styles.icon
                    )}
                  />
                  <span className="relative z-10">{activity.icon}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {activity.title}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                      {getRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {activity.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function buildActivityFromEnrollment(enrollment: {
  enrollmentDate?: string
  course?: { name?: string }
  completedItems?: number
  contentCounts?: { totalItems?: number }
  percentCompleted?: number
}): Activity | null {
  if (!enrollment.enrollmentDate) return null

  const courseName = enrollment.course?.name || "a course"
  const completed = enrollment.completedItems ?? 0
  const total = enrollment.contentCounts?.totalItems ?? 0
  const percent = enrollment.percentCompleted ?? (total > 0 ? Math.round((completed / total) * 100) : 0)

  if (percent >= 100) {
    return {
      icon: <CheckCircle2 className="h-4 w-4" />,
      title: `Completed ${courseName}`,
      description: `Finished all ${total} items in this course.`,
      timestamp: enrollment.enrollmentDate,
      variant: "success",
    }
  }

  if (completed > 0) {
    return {
      icon: <BookOpen className="h-4 w-4" />,
      title: `Continued ${courseName}`,
      description: `${completed} of ${total} items completed (${percent}%).`,
      timestamp: enrollment.enrollmentDate,
      variant: "info",
    }
  }

  return {
    icon: <UserPlus className="h-4 w-4" />,
    title: `Enrolled in ${courseName}`,
    description: "Started a new learning journey.",
    timestamp: enrollment.enrollmentDate,
    variant: "default",
  }
}
