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
      <DialogContent className="max-w-4xl max-h-[90vh]">

        

       <DialogHeader>
  <DialogTitle className="flex items-center gap-2">
    <Shield className="h-5 w-5 text-primary" />
    Course Policies
  </DialogTitle>

  <p className="text-sm text-muted-foreground py-3">
    These rules determine when a student may be automatically removed from the course.
  </p>
</DialogHeader>
<div className="max-h-[75vh] overflow-y-auto pr-2">
  <div className="space-y-6 py-4">
        {isLoading ? (
          <div className="text-center py-6">Loading policies...</div>
        ) : (
          <StudentPolicyList policies={policies} />
        )}
</div></div>
      </DialogContent>
    </Dialog>
  )
}