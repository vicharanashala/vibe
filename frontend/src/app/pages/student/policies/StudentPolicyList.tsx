import { StudentPolicyCard } from "./StudentPolicyCard"
import { EjectionPolicy } from "@/types/ejection-policy.types"

export function StudentPolicyList({
  policies,
}: {
  policies: EjectionPolicy[]
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
        <StudentPolicyCard key={policy._id} policy={policy} />
      ))}
    </div>
  )
}