import { StudentPolicyCard } from "./StudentPolicyCard"
import { EjectionPolicy } from "@/types/ejection-policy.types"

export function StudentPolicyList({
  policies,
  enrollmentDate,
  currentProgressPercent
}: {
  policies: EjectionPolicy[]
  enrollmentDate?: Date | string
  currentProgressPercent?: number
}) {

  if (!policies.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No policies configured for this course
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {policies.map((policy) => (
        <StudentPolicyCard 
          key={policy._id} 
          policy={policy} 
          enrollmentDate={enrollmentDate}
          currentProgressPercent={currentProgressPercent}
        />
      ))}
    </div>
  )
}