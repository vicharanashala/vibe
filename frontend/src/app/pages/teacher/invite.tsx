"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  UserPlus,
  Mail,
  Send,
  RotateCcw,
  X,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Plus,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

// Import hooks and types
import {
  useInviteUsers,
  useCourseInvites,
  useResendInvite,
  useCancelInvite,
  useCourseById,
  useCourseVersionById,
} from "@/hooks/hooks"
import { useCourseStore } from "@/store/course-store"
import type { EmailInvite, EnrollmentRole, InviteStatus, InviteResult } from "@/types/invite.types"
import { useNavigate, redirect } from "@tanstack/react-router"

export default function InvitePage() {
  const navigate = useNavigate()

  // Get course info from store
  const { currentCourse } = useCourseStore()
  const courseId = currentCourse?.courseId
  const versionId = currentCourse?.versionId

  if (!currentCourse || !courseId || !versionId) {
    navigate({ to: '/teacher' });
    return null
  }

  // State for new invites
  const [inviteEmails, setInviteEmails] = useState<EmailInvite[]>([
    { email: "", role: "STUDENT" as EnrollmentRole }
  ])

  // State to track which invite operations are in progress
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null)
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null)

  // Hooks
  const { data: course, isLoading: courseLoading } = useCourseById(courseId || "")
  const {
    data: invitesData,
    isLoading: invitesLoading,
    error: invitesError,
    refetch: refetchInvites,
  } = useCourseInvites(courseId || "", versionId || "", !!(courseId && versionId))

  // Add course version data hook to check structure
  const { data: courseVersion, isLoading: versionLoading } = useCourseVersionById(versionId || "")

  const inviteUsers = useInviteUsers()
  const resendInvite = useResendInvite()
  const cancelInvite = useCancelInvite()

  // Function to check if course has required structure for progress initialization
  const hasRequiredStructure = () => {
    if (!courseVersion || !courseVersion.modules || courseVersion.modules.length === 0) {
      return false
    }

    const firstModule = courseVersion.modules.sort((a, b) => 
      a.order.localeCompare(b.order)
    )[0]

    if (!firstModule.sections || firstModule.sections.length === 0) {
      return false
    }

    const firstSection = firstModule.sections.sort((a, b) => 
      a.order.localeCompare(b.order)
    )[0]

    // Note: We can't check if items exist in the itemsGroup without making additional API calls
    // The backend will handle this check when trying to initialize progress
    // For now, we'll assume that if a section exists, it should have an itemsGroup
    return true
  }

  // Function to get the reason why invites can't be sent
  const getInviteBlockReason = () => {
    if (!courseVersion) {
      return "Course version data is not available"
    }

    if (!courseVersion.modules || courseVersion.modules.length === 0) {
      return "Course must have at least one module to send invites"
    }

    const firstModule = courseVersion.modules.sort((a, b) => 
      a.order.localeCompare(b.order)
    )[0]

    if (!firstModule.sections || firstModule.sections.length === 0) {
      return "Course must have at least one section in the first module to send invites"
    }

    return "Course must have at least one item in the first section to send invites"
  }

  // Check if course has required structure
  const canSendInvites = hasRequiredStructure()

  // Handle adding new invite row
  const addInviteRow = () => {
    setInviteEmails([...inviteEmails, { email: "", role: "STUDENT" }])
  }

  // Handle removing invite row
  const removeInviteRow = (index: number) => {
    if (inviteEmails.length > 1) {
      const newInvites = inviteEmails.filter((_, i) => i !== index)
      setInviteEmails(newInvites)
    }
  }

  // Handle updating invite email with smart space-separated parsing
  const updateInviteEmail = (index: number, email: string) => {
    // Check if the input contains multiple emails separated by spaces
    const emailsArray = email.trim().split(/\s+/).filter(e => e.length > 0)

    if (emailsArray.length > 1) {
      // Multiple emails detected - split them into separate rows
      const newInvites = [...inviteEmails]

      // Update the current row with the first email
      newInvites[index].email = emailsArray[0]

      // Create new rows for the remaining emails
      const additionalInvites = emailsArray.slice(1).map(emailAddr => ({
        email: emailAddr,
        role: newInvites[index].role // Use the same role as the current row
      }))

      // Insert the new rows after the current index
      newInvites.splice(index + 1, 0, ...additionalInvites)

      setInviteEmails(newInvites)
    } else {
      // Single email - normal update
      const newInvites = [...inviteEmails]
      newInvites[index].email = email
      setInviteEmails(newInvites)
    }
  }

  // Handle updating invite role
  const updateInviteRole = (index: number, role: EnrollmentRole) => {
    const newInvites = [...inviteEmails]
    newInvites[index].role = role
    setInviteEmails(newInvites)
  }

  // Handle sending invites
  const handleSendInvites = async () => {
    if (!courseId || !versionId) {
      toast.error("Course ID and version ID are required")
      return
    }

    if (!canSendInvites) {
      toast.error(`Cannot send invites: ${getInviteBlockReason()}`)
      return
    }

    const validInvites = inviteEmails.filter(invite => invite.email.trim() !== "")

    if (validInvites.length === 0) {
      toast.error("Please enter at least one email address")
      return
    }

    try {
      await inviteUsers.mutateAsync({
        params: {
          path: {
            courseId,
            courseVersionId: versionId,
          },
        },
        body: {
          inviteData: validInvites,
        },
      })

      toast.success(`Sent ${validInvites.length} invite(s) successfully`)

      // Reset form
      setInviteEmails([{ email: "", role: "STUDENT" }])

      // Refetch invites to show updated list
      refetchInvites()
    } catch {
      toast.error(inviteUsers.error || "Failed to send invites")
    }
  }

  // Handle resending invite
  const handleResendInvite = async (inviteId: string) => {
    setResendingInviteId(inviteId)
    try {
      await resendInvite.mutateAsync({
        params: { path: { inviteId } },
      })

      toast.success("Invite resent successfully")

      refetchInvites()
    } catch {
      toast.error(resendInvite.error || "Failed to resend invite")
    } finally {
      setResendingInviteId(null)
    }
  }

  // Handle canceling invite
  const handleCancelInvite = async (inviteId: string) => {
    setCancelingInviteId(inviteId)
    try {
      await cancelInvite.mutateAsync({
        params: { path: { inviteId } },
      })

      toast.success("Invite canceled successfully")

      refetchInvites()
    } catch {
      toast.error(cancelInvite.error || "Failed to cancel invite")
    } finally {
      setCancelingInviteId(null)
    }
  }

  // Status badge variants
  const getStatusBadge = (status: InviteStatus) => {
    switch (status) {
      case "ACCEPTED":
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>
      case "PENDING":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case "CANCELLED":
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Cancelled</Badge>
      case "EMAIL_FAILED":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>
      case "ALREADY_ENROLLED":
        return <Badge variant="outline"><CheckCircle className="w-3 h-3 mr-1" />Already Enrolled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Role badge variants
  const getRoleBadge = (role: EnrollmentRole) => {
    const variants: Record<EnrollmentRole, string> = {
      INSTRUCTOR: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      STUDENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      MANAGER: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      TA: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      STAFF: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    }

    return (
      <Badge variant="outline" className={variants[role]}>
        {role}
      </Badge>
    )
  }

  if (courseLoading || versionLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <UserPlus className="w-6 h-6" />
        <h1 className="text-xl md:text-2xl font-bold">Invite Users</h1>
        {course && (
          <Badge variant="outline" className="ml-2">
            {course.name}
          </Badge>
        )}
      </div>

      {/* Course Structure Warning */}
      {!canSendInvites && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Course Structure Required</span>
            </div>
            <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">
              {getInviteBlockReason()}. Please add the required content before sending invites.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Send New Invites Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Send className="w-5 h-5" />
              <span>Send New Invites</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {inviteEmails.filter(invite => invite.email.trim() !== "").length} recipient(s)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {inviteEmails.map((invite, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center text-sm font-medium text-muted-foreground lg:min-w-[70px]">
                  #{index + 1}
                </div>

                <div className="flex-1">
                  <Input
                    id={`email-${index}`}
                    type="email"
                    placeholder="Enter email address (space-separated for multiple)"
                    value={invite.email}
                    onChange={(e) => updateInviteEmail(index, e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="lg:w-40">
                  <Select
                    value={invite.role}
                    onValueChange={(value: EnrollmentRole) => updateInviteRole(index, value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STUDENT">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                          Student
                        </div>
                      </SelectItem>
                      <SelectItem value="TA">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                          Teaching Assistant
                        </div>
                      </SelectItem>
                      <SelectItem value="INSTRUCTOR">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                          Instructor
                        </div>
                      </SelectItem>
                      <SelectItem value="MANAGER">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                          Manager
                        </div>
                      </SelectItem>
                      <SelectItem value="STAFF">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
                          Staff
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inviteEmails.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInviteRow(index)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={addInviteRow}
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Invite</span>
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {inviteEmails.filter(invite => invite.email.trim() !== "").length}
              </span>
              {" "}valid email(s) ready to send
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setInviteEmails([{ email: "", role: "STUDENT" }])}
                disabled={inviteUsers.isPending}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button
                onClick={handleSendInvites}
                disabled={inviteUsers.isPending || inviteEmails.filter(invite => invite.email.trim() !== "").length === 0 || !canSendInvites}
                className="min-w-[120px]"
              >
                {inviteUsers.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Invites
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Invites Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5" />
              <span>Current Invites</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refetchInvites}
              disabled={invitesLoading}
            >
              {invitesLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invitesError && (
            <div className="text-destructive text-sm mb-4">
              Error loading invites: {invitesError}
            </div>
          )}

          {invitesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : invitesData?.invites?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accepted At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Display invites in reverse order */}
                {invitesData.invites.slice().reverse().map((invite: InviteResult) => (
                  <TableRow key={invite.inviteId}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>{getRoleBadge(invite.role)}</TableCell>
                    <TableCell>{getStatusBadge(invite.inviteStatus)}</TableCell>
                    <TableCell>
                      {invite.acceptedAt
                        ? new Date(invite.acceptedAt).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {invite.inviteStatus === "PENDING" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResendInvite(invite.inviteId)}
                              disabled={resendingInviteId === invite.inviteId}
                            >
                              {resendingInviteId === invite.inviteId ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelInvite(invite.inviteId)}
                              disabled={cancelingInviteId === invite.inviteId}
                            >
                              {cancelingInviteId === invite.inviteId ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                            </Button>
                          </>
                        )}
                        {invite.inviteStatus === "EMAIL_FAILED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendInvite(invite.inviteId)}
                            disabled={resendingInviteId === invite.inviteId}
                          >
                            {resendingInviteId === invite.inviteId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No invites found for this course version.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
