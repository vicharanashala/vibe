// @ts-nocheck

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, AlertTriangle, Shield } from "lucide-react"
import { EjectionPolicy } from "@/types/ejection-policy.types"
import { calculateNextMilestones } from "@/lib/policy-utils"

interface StudentPolicyCardProps {
  policy: EjectionPolicy;
  enrollmentDate?: Date | string;
  currentProgressPercent?: number;
}

export function StudentPolicyCard({ policy, enrollmentDate, currentProgressPercent = 0 }: StudentPolicyCardProps) {

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

    const rules = policy.triggers.missedDeadlines.progressRules;
    if (rules && rules.length > 0) {
      const startDate = enrollmentDate || new Date();
      const milestones = calculateNextMilestones(rules, startDate, currentProgressPercent);
      milestones.forEach(m => triggers.push(m.studentFormattedString));
    }
  }

  if (policy.triggers.policyViolations?.enabled) {
  const predefined =
    policy.triggers.policyViolations.violations?.predefined || [];

  const custom =
    policy.triggers.policyViolations.violations?.custom || [];

  const allViolations = [...predefined, ...custom];

  if (allViolations.length > 0) {
    triggers.push(
      `${policy.triggers.policyViolations.thresholdCount} violations (${allViolations.join(", ")})`
    );
  }
}
  if (policy.triggers.anomalyDetection?.enabled) {
  const threshold = policy.triggers.anomalyDetection.thresholdScore;
  triggers.push( `Anomaly score ≥ ${threshold}`)
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
              <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
              <span>{trigger}</span>
            </div>
          ))}
          {currentProgressPercent !== undefined && (
            <div className="flex items-center gap-2 mt-2 text-green-600 dark:text-green-500 font-medium">
               <span>Current Progress: {currentProgressPercent}%</span>
            </div>
          )}

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