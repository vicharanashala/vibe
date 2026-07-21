"use client"

import React, { useMemo } from "react"
import { BookOpen, Award, GraduationCap, UserPlus, Clock, CheckCircle2, FileText, Star, Inbox, Camera, CheckCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/utils/utils"
import { motion } from "motion/react"

export interface Activity {
  icon: React.ReactNode
  title: string
  description: string
  timestamp: string
  variant?: "default" | "success" | "warning" | "info"
}

export interface TimelineActivity {
  id: string
  type: "profile_updated" | "avatar_updated" | "enrollment" | "account_created"
  title: string
  description: string
  timestamp: string
  courseName?: string
}

const VARIANT_STYLES: Record<NonNullable<Activity["variant"]>, { dot: string; icon: string }> = {
  default: { dot: "bg-muted-foreground/40", icon: "bg-muted text-muted-foreground" },
  success: { dot: "bg-emerald-500", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400" },
  warning: { dot: "bg-amber-500", icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400" },
  info: { dot: "bg-blue-500", icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" },
}

const ACTIVITY_CONFIG: Record<
  TimelineActivity["type"],
  { icon: React.FC<{ className?: string }>; colorClass: string; bgColorClass: string }
> = {
  profile_updated: {
    icon: CheckCircle,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgColorClass: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  avatar_updated: {
    icon: Camera,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgColorClass: "bg-blue-100 dark:bg-blue-900/40",
  },
  enrollment: {
    icon: BookOpen,
    colorClass: "text-violet-600 dark:text-violet-400",
    bgColorClass: "bg-violet-100 dark:bg-violet-900/40",
  },
  account_created: {
    icon: UserPlus,
    colorClass: "text-amber-600 dark:text-amber-400",
    bgColorClass: "bg-amber-100 dark:bg-amber-900/40",
  },
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

function getTimelineRelativeTime(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "Just now"
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`
  }
  const months = Math.floor(diffDays / 30)
  return months === 1 ? "1 month ago" : `${months} months ago`
}

function getTimelineIcon(type: TimelineActivity["type"]): React.FC<{ className?: string }> {
  return ACTIVITY_CONFIG[type]?.icon ?? Clock
}

function getTimelineColorClasses(type: TimelineActivity["type"]) {
  return (
    ACTIVITY_CONFIG[type] ?? {
      icon: Clock,
      colorClass: "text-muted-foreground",
      bgColorClass: "bg-muted",
    }
  )
}

function generateTimelineActivities(
  user: {
    firstName?: string
    lastName?: string
    name?: string
    email?: string
    avatar?: string
    gender?: string
    country?: string
    state?: string
    city?: string
  },
  enrollments: { courseTitle?: string; enrolledAt?: string }[]
): TimelineActivity[] {
  const activities: TimelineActivity[] = []
  const now = new Date()
  let id = 0

  activities.push({
    id: String(id++),
    type: "account_created",
    title: "Account Created",
    description: "Joined ViBe (Vicharanashala)",
    timestamp: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  })

  const hasProfileData = user.firstName || user.lastName || user.gender || user.country
  if (hasProfileData) {
    activities.push({
      id: String(id++),
      type: "profile_updated",
      title: "Updated Profile",
      description: "Personal information was updated",
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  if (user.avatar) {
    activities.push({
      id: String(id++),
      type: "avatar_updated",
      title: "Updated Avatar",
      description: "Profile picture changed",
      timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  enrollments.slice(0, 3).forEach((enrollment, index) => {
    activities.push({
      id: String(id++),
      type: "enrollment",
      title: "Enrolled in Course",
      description: `Started learning ${enrollment.courseTitle || "a new course"}`,
      timestamp: new Date(
        now.getTime() - (index + 3) * 24 * 60 * 60 * 1000
      ).toISOString(),
      courseName: enrollment.courseTitle,
    })
  })

  return activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

interface ProfileActivityTimelineBaseProps {
  className?: string
}

interface ProfileActivityTimelineActivitiesProps extends ProfileActivityTimelineBaseProps {
  activities: Activity[]
  user?: never
  enrollments?: never
}

interface ProfileActivityTimelineDataProps extends ProfileActivityTimelineBaseProps {
  activities?: never
  user?: {
    firstName?: string
    lastName?: string
    name?: string
    email?: string
    avatar?: string
    gender?: string
    country?: string
    state?: string
    city?: string
  } | null
  enrollments?: { courseTitle?: string; enrolledAt?: string }[]
}

type ProfileActivityTimelineProps = ProfileActivityTimelineActivitiesProps | ProfileActivityTimelineDataProps

export default function ProfileActivityTimeline(props: ProfileActivityTimelineProps) {
  const { className } = props

  if ("activities" in props && props.activities) {
    const items = props.activities.length > 0 ? props.activities : PLACEHOLDER_ACTIVITIES

    return (
      <Card className={cn("transition-shadow duration-200 hover:shadow-md", className)}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2.5 text-lg md:text-xl font-bold">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Your latest actions and milestones</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2">
          <div className="relative space-y-0">
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
                  <div className="relative z-10 mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center">
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full",
                        styles.icon
                      )}
                    />
                    <span className="relative z-10">{activity.icon}</span>
                  </div>

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

  const user = ("user" in props ? props.user : null) ?? null
  const enrollments = ("enrollments" in props ? props.enrollments : []) ?? []

  const activities = useMemo(
    () => generateTimelineActivities(user ?? {}, enrollments),
    [user, enrollments]
  )

  return (
    <Card className={cn("transition-shadow duration-200 hover:shadow-md", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-2xl font-bold">
          <Clock className="h-6 w-6" />
          Recent Activity
        </CardTitle>
        <CardDescription>Your recent learning and profile activities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-0">
            {activities.map((activity, index) => {
              const Icon = getTimelineIcon(activity.type)
              const colors = getTimelineColorClasses(activity.type)

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <div className="relative flex items-start gap-4 py-3">
                    <div
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors.bgColorClass}`}
                    >
                      <Icon className={`h-4 w-4 ${colors.colorClass}`} />
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <p className="text-sm font-medium leading-none">
                          {activity.title}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {getTimelineRelativeTime(activity.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {activity.description}
                      </p>
                    </div>
                  </div>

                  {index < activities.length - 1 && (
                    <Separator className="ml-12" />
                  )}
                </motion.div>
              )
            })}
          </div>
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
