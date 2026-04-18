// Component to display watch time data for selected item
import { Loader2,Clock } from 'lucide-react'

import { Badge } from "@/components/ui/badge"

// Import hooks - including the new quiz hooks
import {
  useWatchTimeByItemId,
} from "@/hooks/hooks"


export function WatchTimeDisplay({
  userId,
  itemId,
  courseId,
  courseVersionId,
  itemName,
  itemType,
}: {
  userId: string
  itemId: string
  courseId: string
  courseVersionId: string
  itemName?: string
  itemType?: string
}) {
  console.log(`Fetching watch time for User: ${userId}, Item: ${itemId}, Course: ${courseId}, Version: ${courseVersionId}, Type: ${itemType}`)
  const { data: watchTimeData, isLoading, error} = useWatchTimeByItemId(userId, courseId, courseVersionId, itemId, itemType?.toUpperCase() || "");
  console.log("Watch Time Data:", watchTimeData)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-muted/20 rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading watch time...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
      </div>
    )
  }

  if (!watchTimeData) {
    return (
      <div className="p-4 bg-muted/20 rounded-lg">
        <p className="text-sm text-muted-foreground">No watch time data available for this item.</p>
      </div>
    )
  }
  // if (!watchTimeData.watchTime || watchTimeData.watchTime.length === 0) {
  //   return (
  //     <div className="p-4 bg-muted/20 rounded-lg">
  //       <p className="text-sm text-muted-foreground">The user has not attempted this item yet.</p>
  //     </div>
  //   )
  // }

  const totalAttempts = watchTimeData.watchTime.length

  const getItemIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case "VIDEO":
        return "🎥"
      case "QUIZ":
        return "❓"
      case "ARTICLE":
      case "BLOG":
        return "📖"
      default:
        return "📄"
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    }
  }

  // Generate default name if item name is empty
  const displayName =
    itemName && itemName.trim() !== ""
      ? itemName
      : `${itemType ? itemType.charAt(0).toUpperCase() + itemType.slice(1).toLowerCase() : "Item"} 1`

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-foreground">Watch Time Details</h4>
      </div>

      {/* Item Info Header */}
      <div className="p-4 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getItemIcon(itemType || "")}</span>
          <div className="flex-1">
            <h5 className="font-semibold text-foreground">{displayName}</h5>
            <p className="text-sm text-muted-foreground">
              {totalAttempts} {totalAttempts === 1 ? "attempt" : "attempts"} recorded
            </p>
          </div>
          <Badge variant="secondary" className="font-medium">
            {totalAttempts} {totalAttempts === 1 ? "Attempt" : "Attempts"}
          </Badge>
        </div>
      </div>

      {/* Attempts List */}
      <div className="space-y-3">
        <h6 className="font-medium text-foreground">Attempt History</h6>
        {watchTimeData && (<div className="space-y-2 max-h-60 overflow-y-auto">
          {watchTimeData.watchTime.map((attempt: any, index: number) => {
            const { date, time } = formatDateTime(attempt.startTime)
            return (
              <div key={attempt._id} className="p-3 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Attempt {index + 1}</p>
                      <p className="text-sm text-muted-foreground">
                        {date} at {time}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">
                      {new Date(attempt.startTime).toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </div>
            )
          })}
        </div>)}
      </div>
    </div>
  )
}