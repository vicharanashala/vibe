"use client"

import { useState, useEffect } from "react"
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
  Search,
  Download,
  Upload,
  Check,
  Pencil,
  Trash2,
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
import { Pagination } from "@/components/ui/Pagination"

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

  // State to track which invite operations are in progress
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null);

  // CSV parsed emails state
  const [parsedEmails, setParsedEmails] = useState<{ id: string, email: string }[]>([]);

  // handle CSV parsed emails states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState<string>("");
  const [error, setError] = useState<string>("")

  // handle edit or remove csv parsed emails starts
  const startEdit = (item: { id: string, email: string }) => {
    setEditingId(item.id);
    setDraftEmail(item.email);
    setError("")
  }

  const cancelEdit = () => {
    setEditingId(null);
    setDraftEmail("");
  }

  const saveEdit = (id: string) => {
    const trimmed = draftEmail.trim().toLowerCase();
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      setError("Please enter a valid email address")
      return;
    }
    if (parsedEmails.some((item) => item.email === trimmed && item.id !== id)) {

      setError(" This email already exits in the list")
      return;
    }
    setParsedEmails((prev) =>
      prev.map((item) =>
        item.id === id ?
          { ...item, email: trimmed }
          : item)
    )
    setError("");
    cancelEdit();
  }

  const removeEmail = (id: string) => {
    setParsedEmails((prev) =>
      prev.filter((item) =>
        item.id !== id))
  }

  // edit or remove csv parsed emails ends 

  // filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const inviteStatusOptions = ['All', 'ACCEPTED', 'PENDING', 'CANCELLED', 'EMAIL_FAILED', 'ALREADY_ENROLLED'];
  const sortOptions = [
    { label: "All Invites", value: "All" },
    { label: "Recently Accepted", value: "accept_date_desc" },
    { label: "Earliest Accepted", value: "accept_date_asc" },
  ];
  // Hooks
  const { data: course, isLoading: courseLoading } = useCourseById(courseId || "")
  const {
    data: invitesData,
    isLoading: invitesLoading,
    error: invitesError,
    refetch: refetchInvites,
  } = useCourseInvites(courseId || "", versionId || "", !!(courseId && versionId), debouncedSearchQuery,
    currentPage, itemsPerPage, inviteStatus, sort, startDate, endDate);

  // Add course version data hook to check structure
  const { data: courseVersion, isLoading: versionLoading } = useCourseVersionById(versionId || "")

  const inviteUsers = useInviteUsers()
  const resendInvite = useResendInvite()
  const cancelInvite = useCancelInvite()

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const handlePageChange = (newPage: number) => {
    if (invitesData && newPage >= 1 && newPage <= invitesData.totalPages) {
      setCurrentPage(newPage)
    }
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  // Function to get the reason why invites can't be sent
  const getInviteBlockReason = () => {
    if (!courseVersion) {
      return "Course version data is not available"
    }

    if (!courseVersion.modules || courseVersion.modules.length === 0) {
      return "Course must have at least one module to send invites to students"
    }

    const firstModule = courseVersion.modules.sort((a, b) =>
      a.order.localeCompare(b.order)
    )[0]

    if (!firstModule.sections || firstModule.sections.length === 0) {
      return "Course must have at least one section in the first module to send invites to students"
    }

    return "Course must have at least one item in the first section to send invites to students"
  }

  // Check if course has required structure
  const canSendInvites = hasRequiredStructure()

  // Default role based on course structure
  const defaultRole: EnrollmentRole = canSendInvites ? "STUDENT" : "INSTRUCTOR";

  // State for new invites
  const [inviteEmails, setInviteEmails] = useState<EmailInvite[]>([
    { email: "", role: defaultRole }
  ]);

  // Handle adding new invite row
  const addInviteRow = () => {
    setInviteEmails([...inviteEmails, { email: "", role: defaultRole }]);
  };



  const roles = [
    {
      label: "Student",
      value: "STUDENT",
      color: "bg-blue-500",
      disabled: !canSendInvites,
    },
    {
      label: "Teaching Assistant",
      value: "TA",
      color: "bg-green-500",
      disabled: false,
    },
    {
      label: "Instructor",
      value: "INSTRUCTOR",
      color: "bg-purple-500",
      disabled: false,
    },
    {
      label: "Manager",
      value: "MANAGER",
      color: "bg-red-500",
      disabled: false,
    },
    {
      label: "Staff",
      value: "STAFF",
      color: "bg-yellow-500",
      disabled: false,
    },
  ];




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

      await refetchInvites()

      // Show success message after confirming status update
      toast.success("Invitation sent successfully")
    } catch {
      // Refetch to show EMAIL_FAILED status
      await refetchInvites()
      toast.error("Failed to send email")
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

  // Handle CSV file selection and parsing
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validExtensions = ['.csv']
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

    if (!validExtensions.includes(fileExtension)) {
      toast.error("Please upload a CSV file")
      e.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB")
      e.target.value = ''
      return
    }

    try {
      // Read and parse CSV file
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(line => line.trim())

      if (lines.length === 0) {
        toast.error("CSV file is empty")
        e.target.value = ''
        return
      }

      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
      const emails: string[] = []

      for (const line of lines) {
        const matches = line.match(emailRegex)
        if (matches) {
          matches.forEach(email => {
            const cleanedEmail = email.trim().toLowerCase()
            if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(cleanedEmail)) {
              emails.push(cleanedEmail)
            }
          })
        }
      }

      if (emails.length === 0) {
        toast.error("No valid email addresses found in the file")
        e.target.value = ''
        return
      }

      const uniqueEmails = [...new Set(emails)]

      if (uniqueEmails.length > 500) {
        toast.error(`CSV contains ${uniqueEmails.length} emails. Maximum allowed is 500 emails per upload.`)
        e.target.value = ''
        return
      }

      //adding temp ids to emails
      const emailsWithIds = uniqueEmails.map((email, indx) => ({
        id: `email-${Date.now()}-${indx}`,
        email,
      }))

      setParsedEmails(emailsWithIds)

      toast.success(`Found ${uniqueEmails.length} email(s) from CSV file`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process CSV file")
      e.target.value = ''
    }
  }

  // Handle sending bulk invites from parsed CSV
  const handleSendBulkInvites = async () => {
    if (!courseId || !versionId || parsedEmails.length === 0) {
      toast.error("No emails to send")
      return
    }

    try {
      const inviteData = parsedEmails.map(item => ({
        email: item.email,
        role: 'STUDENT' as EnrollmentRole
      }))

      const response = await inviteUsers.mutateAsync({
        params: {
          path: {
            courseId,
            courseVersionId: versionId,
          },
        },
        body: {
          inviteData,
        },
      })

      const results = response.invites || []
      const succeeded = results.filter(r => r.inviteStatus === 'PENDING' || r.inviteStatus === 'ALREADY_ENROLLED')
      const failed = results.filter(r => r.inviteStatus === 'EMAIL_FAILED')
      const total = results.length

      if (failed.length === 0) {
        toast.success(`Successfully sent all ${total} invitations`)
      } else {
        toast.warning(`${succeeded.length} out of ${total} invitations sent successfully. ${failed.length} failed to send.`)
      }

      setParsedEmails([])
      const input = document.getElementById('csv-upload') as HTMLInputElement
      if (input) input.value = ''

      refetchInvites()
    } catch (error) {
      toast.error(inviteUsers.error || "Failed to send invites")
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
                      {roles.map(role => (
                        <SelectItem key={role.value} value={role.value} disabled={role.disabled}>
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${role.color}`}></div>
                            {role.label}
                          </div>
                        </SelectItem>
                      ))}
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
                disabled={inviteUsers.isPending || inviteEmails.filter(invite => invite.email.trim() !== "").length === 0}
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

      {/* Bulk CSV Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5" />
            <span>Bulk Invite via CSV</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canSendInvites && (
            <div className="p-4 border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 rounded-lg">
              <div className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Course Structure Required</span>
              </div>
              <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                {getInviteBlockReason()}.
              </p>
            </div>
          )}

          <div className="relative">
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              disabled={inviteUsers.isPending || !canSendInvites}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${!canSendInvites
                ? 'border-muted-foreground/10 bg-muted/20 opacity-50 cursor-not-allowed'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50 cursor-pointer'
              }`}>
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-base font-medium mb-1">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground">CSV file with student emails (max 5MB)</p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled={!canSendInvites}
            onClick={() => {
              const link = document.createElement('a')
              link.href = '/templates/Bulk registration - Template_Sheet1.csv'
              link.download = 'Bulk registration - Template_Sheet1.csv'
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Sample CSV Template
          </Button>

          <div className="text-sm space-y-2">
            <p className="font-medium">CSV Format:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>First row should be the header with column names</li>
              <li>Required column: Email</li>
              <li>Optional columns: SNo, Name</li>
              <li>Example: SNo, Name, Email</li>
            </ul>
          </div>

          {parsedEmails.length > 0 && (
            <>
              <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {parsedEmails.length} email(s) found
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setParsedEmails([])
                      const input = document.getElementById('csv-upload') as HTMLInputElement
                      if (input) input.value = ''
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-1">
                  {parsedEmails.map(({ id, email }, _idx) => {
                    const isEditing = editingId === id;
                    return (

                      <div key={id} className="flex items-start gap-2 justify-between group">
                        {
                          isEditing ? (

                            <div className="flex-1">
                              <input
                                value={draftEmail}
                                onChange={(e) => {
                                  setDraftEmail(e.target.value);
                                  if (error) setError("");
                                }}
                                className={`w-full flex-1 px-1 py-0.5 text-xs border rounded ${error ? "border-red-500" : ""}`}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(id)
                                  if (e.key === "Escape") cancelEdit()
                                }}
                              />
                              {
                                error && (
                                  <p className="mt-0.5 text-[10px] text-red-500">
                                    {error}
                                  </p>
                                )
                              }
                            </div>
                          ) : (
                            <span className="truncate">{email}</span>
                          )
                        }

                        <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition mr-2">
                          {
                            isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-auto w-auto p-1"
                                  onClick={() => saveEdit(id)}
                                >
                                  <Check className="w-4 h-4 text-green-500 cursor-pointer" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-auto w-auto p-1"
                                  onClick={cancelEdit}
                                >
                                  <X className="w-4 h-4 text-gray-500 cursor-pointer" />
                                </Button>
                              </>
                            )
                              :
                              (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-auto w-auto p-1"
                                    onClick={() => startEdit({ id, email })}
                                  >
                                    <Pencil className="w-4 h-4 text-gray-500 cursor-pointer" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-auto w-auto p-1"
                                    onClick={() => removeEmail(id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500 cursor-pointer" />
                                  </Button>
                                </>
                              )
                          }
                        </div>
                      </div>

                    )
                  })}
                </div>
              </div>

              <Button
                onClick={handleSendBulkInvites}
                disabled={inviteUsers.isPending}
                className="w-full"
              >
                {inviteUsers.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send {parsedEmails.length} Invite(s)
                  </>
                )}
              </Button>
            </>
          )}
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
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />

                </>
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
            </Button>
          </CardTitle>
          <div className="w-full flex flex-col gap-4 mt-5 px-4">
            <div className="relative w-full max-w-md">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg blur-sm"></div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name, email ... "
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value) }}
                  className="pl-10 pr-10 w-full bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300"
                />
                <X className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSearchQuery("");
                  }} />
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-3">
              <div className="flex items-center gap-2 w-auto">
                <label htmlFor="statusFilter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Status:
                </label>
                <Select
                  value={inviteStatus}
                  onValueChange={(value) => {
                    setInviteStatus(value === "All" ? "" : value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {inviteStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "All" ? "All" : status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 w-auto">
                <label htmlFor="sortFilter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Sort:
                </label>
                <Select
                  value={sort}
                  onValueChange={(value) => {
                    setSort(value === "All" ? "" : value);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Recent" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label === "All Invites" ? "All" : option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 w-auto">
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  From:
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-[140px]"
                />
              </div>
              <div className="flex items-center gap-2 w-auto">
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  To:
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-[140px]"
                />
              </div>
              <div className="flex items-center gap-2 w-auto">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-[70px]"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-sm text-muted-foreground whitespace-nowrap">per page</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invitesError && (
            <div className="text-destructive text-sm mb-4">
              Error loading invites: {invitesError}
            </div>
          )}

          {invitesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" /><span className="text-gray-800 dark:text-gray-200 text-sm ms-2">Loading invites ...</span>
            </div>
          ) : invitesData?.invites?.length ? (
            <>
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
              {invitesData && invitesData?.totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={invitesData.totalPages}
                  totalDocuments={invitesData.totalDocuments}
                  onPageChange={handlePageChange}
                />
              )}
            </>
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
