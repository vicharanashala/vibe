import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, AlertTriangle, Shield } from "lucide-react"
import { EjectionPolicy } from "@/types/ejection-policy.types"

export function StudentPolicyCard({ policy }: { policy: EjectionPolicy }) {

  const triggers = []

  if (policy.triggers.inactivity?.enabled) {
    triggers.push(
      `Inactive for ${policy.triggers.inactivity.thresholdDays} days`
    )
  }

  if (policy.triggers.missedDeadlines?.enabled) {
    triggers.push(
      `${policy.triggers.missedDeadlines.consecutiveMisses} missed deadlines`
    )
  }

  if (policy.triggers.policyViolations?.enabled) {
    triggers.push(
      `${policy.triggers.policyViolations.thresholdCount} violations`
    )
  }

  return (
    <Card className="border border-border/50">
      <CardContent className="p-4 space-y-3">

        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{policy.name}</h3>

          <Badge variant="outline">
            {policy.scope === "platform" ? "Platform Rule" : "Course Rule"}
          </Badge>
        </div>

        {policy.description && (
          <p className="text-sm text-muted-foreground">
            {policy.description}
          </p>
        )}

        <div className="space-y-1 text-sm">

          {triggers.map((trigger, i) => (
            <div key={i} className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              {trigger}
            </div>
          ))}

        </div>

        {policy.actions.allowAppeal && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Appeals allowed within {policy.actions.appealDeadlineDays} days
          </div>
        )}

      </CardContent>
    </Card>
  )
}