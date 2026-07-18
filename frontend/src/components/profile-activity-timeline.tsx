"use client"

import { useMemo } from "react"
import {
  CheckCircle,
  Camera,
  BookOpen,
  UserPlus,
  Clock,
  type LucideIcon,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export interface TimelineActivity {
  id: string
  type: "profile_updated" | "avatar_updated" | "enrollment" | "account_created"
  title: string
  description: string
  timestamp: string
  courseName?: string
}

const ACTIVITY_CONFIG: Record<
  TimelineActivity["type"],
  { icon: LucideIcon; colorClass: string; bgColorClass: string }
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

function formatRelativeTime(timestamp: string): string {
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

function getIcon(type: TimelineActivity["type"]): LucideIcon {
  return ACTIVITY_CONFIG[type]?.icon ?? Clock
}

function getColorClasses(type: TimelineActivity["type"]) {
  return (
    ACTIVITY_CONFIG[type] ?? {
      icon: Clock,
      colorClass: "text-muted-foreground",
      bgColorClass: "bg-muted",
    }
  )
}

function generateTimelineActivities(user: {
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  avatar?: string
  gender?: string
  country?: string
  state?: string
  city?: string
}, enrollments: { courseTitle?: string; enrolledAt?: string }[]): TimelineActivity[] {
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

export interface ProfileActivityTimelineProps {
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

export default function ProfileActivityTimeline({
  user,
  enrollments = [],
}: ProfileActivityTimelineProps) {
  const activities = useMemo(
    () => generateTimelineActivities(user ?? {}, enrollments),
    [user, enrollments]
  )

  return (
    <Card>
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
              const Icon = getIcon(activity.type)
              const colors = getColorClasses(activity.type)

              return (
                <div key={activity.id}>
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
                          {formatRelativeTime(activity.timestamp)}
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
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
