"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  BarChart3,
  Check,
  Copy,
  Link2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCreateShareLinks,
  useRevokeShareLink,
  useShareLinkAnalytics,
} from "@/hooks/share-link-hooks"
import type {
  ShareLink,
  ShareLinkViewingMode,
} from "@/types/share-link.types"
import { formatWatchDuration } from "@/utils/time"

interface ShareCoursePanelProps {
  courseId: string
  versionId: string
  cohortId?: string
}

interface RecipientDraft {
  name: string
  email: string
}

const emptyRecipient = (): RecipientDraft => ({ name: "", email: "" })

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

/**
 * Sharing a course with named people, and what they watched.
 *
 * Sits beside the invite flow because the instructor's real question is "how do
 * I get this in front of this person" — enrol them, or share a link they can
 * open without signing up.
 */
export default function ShareCoursePanel({
  courseId,
  versionId,
  cohortId,
}: ShareCoursePanelProps) {
  const [recipients, setRecipients] = useState<RecipientDraft[]>([
    emptyRecipient(),
  ])
  const [viewingMode, setViewingMode] = useState<ShareLinkViewingMode>("PLAIN")
  const [generated, setGenerated] = useState<ShareLink[]>([])
  const [sendEmail, setSendEmail] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const createLinks = useCreateShareLinks(courseId, versionId)
  const revoke = useRevokeShareLink(courseId, versionId)
  const { data: analytics, isLoading: analyticsLoading } = useShareLinkAnalytics(
    courseId,
    versionId,
    cohortId,
  )

  const validRecipients = recipients.filter(
    r => r.name.trim() !== "" && isValidEmail(r.email.trim()),
  )

  const handleGenerate = async () => {
    if (validRecipients.length === 0) return
    try {
      const links = await createLinks.mutateAsync({
        recipients: validRecipients.map(r => ({
          name: r.name.trim(),
          email: r.email.trim(),
        })),
        cohortId,
        viewingMode,
        sendEmail,
      })
      setGenerated(links)
      setRecipients([emptyRecipient()])
      toast.success(`Generated ${links.length} link(s)`)
    } catch (err: any) {
      toast.error(err?.message || "Could not generate the links")
    }
  }

  const handleCopy = async (link: ShareLink) => {
    await navigator.clipboard.writeText(link.url)
    setCopiedId(link.shareLinkId)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleRevoke = async (shareLinkId: string) => {
    try {
      await revoke.mutateAsync(shareLinkId)
      toast.success("Link revoked. The watching it recorded is kept.")
    } catch (err: any) {
      toast.error(err?.message || "Could not revoke that link")
    }
  }

  return (
    <div className="space-y-6">
      {/* Recipients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Link2 className="w-5 h-5" />
              <span>Share with</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {validRecipients.length} recipient(s)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Shares this course's own content. Each person gets their own link,
            opens it and watches straight away — no sign-up — and you see who
            watched and how much. To share a video that isn't in a course yet,
            add it to the course first.
          </p>

          <div className="space-y-3">
            {recipients.map((recipient, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50"
              >
                <div className="text-sm font-medium text-muted-foreground lg:min-w-[40px]">
                  #{index + 1}
                </div>
                <Input
                  placeholder="Name"
                  className="flex-1"
                  value={recipient.name}
                  onChange={e => {
                    const next = [...recipients]
                    next[index] = { ...next[index], name: e.target.value }
                    setRecipients(next)
                  }}
                />
                <Input
                  placeholder="email@example.com"
                  className="flex-1"
                  value={recipient.email}
                  onChange={e => {
                    const next = [...recipients]
                    next[index] = { ...next[index], email: e.target.value }
                    setRecipients(next)
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={recipients.length === 1}
                  onClick={() =>
                    setRecipients(recipients.filter((_, i) => i !== index))
                  }
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRecipients([...recipients, emptyRecipient()])}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add recipient
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Viewing</span>
              <Select
                value={viewingMode}
                onValueChange={value =>
                  setViewingMode(value as ShareLinkViewingMode)
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLAIN">Plain viewing</SelectItem>
                  <SelectItem value="PROCTORED">Full ViBe experience</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="send-email"
                checked={sendEmail}
                onCheckedChange={checked => setSendEmail(checked === true)}
              />
              <Label htmlFor="send-email" className="text-sm font-normal">
                Email the links
              </Label>
            </div>

            <Button
              className="ml-auto"
              onClick={handleGenerate}
              disabled={validRecipients.length === 0 || createLinks.isPending}
            >
              {createLinks.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Generate links
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {viewingMode === "PLAIN"
              ? "Plain viewing: no proctoring, rollback or gating for these recipients. Their watching is still tracked."
              : "Full ViBe experience: proctoring, rollback and linear progression apply, exactly as for enrolled learners."}
          </p>
        </CardContent>
      </Card>

      {/* Freshly generated links, ready to copy */}
      {generated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Links ready to send
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {generated.map(link => (
              <div
                key={link.shareLinkId}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {link.recipientName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {link.url}
                  </div>
                  {link.emailStatus === "SENT" && (
                    <div className="text-xs text-muted-foreground">
                      Emailed to {link.recipientEmail}
                    </div>
                  )}
                  {link.emailStatus === "FAILED" && (
                    <div className="text-xs text-orange-600 dark:text-orange-400">
                      Could not email {link.recipientEmail} — copy the link and
                      send it yourself.
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(link)}
                >
                  {copiedId === link.shareLinkId ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Who watched */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Who watched</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : !analytics || analytics.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              You haven't shared this course with anyone yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Watched</TableHead>
                  <TableHead className="text-right">Watch time</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Rewinds</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.map(row => (
                  <TableRow key={row.shareLinkId}>
                    <TableCell>
                      <div className="font-medium">{row.recipientName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.recipientEmail}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "REVOKED" || row.status === "EXPIRED"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.watchedPercent}%
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.completedItems}/{row.totalItems})
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatWatchDuration(row.totalWatchTimeSeconds)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.openCount}
                    </TableCell>
                    <TableCell className="text-right">{row.rewinds}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.lastSeenAt
                        ? new Date(row.lastSeenAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status !== "REVOKED" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Revoke this link"
                          onClick={() => handleRevoke(row.shareLinkId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
