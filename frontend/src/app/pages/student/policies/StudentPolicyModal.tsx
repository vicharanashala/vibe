import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Shield } from "lucide-react"
import { useActivePoliciesForCourse } from "@/hooks/ejection-policy-hooks"
import { StudentPolicyList } from "./StudentPolicyList"

export function StudentPolicyModal({
  open,
  onClose,
  courseId,
}: {
  open: boolean
  onClose: () => void
  courseId: string
}) {

  const { policies, isLoading } = useActivePoliciesForCourse(courseId)
  console.log("Policies API response:", policies)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Course Policies
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-6">Loading policies...</div>
        ) : (
          <StudentPolicyList policies={policies} />
        )}

      </DialogContent>
    </Dialog>
  )
}