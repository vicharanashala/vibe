"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  Link2,
  Loader2,
  Plus,
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
  useQuickShare,
  useQuickShares,
  useValidateYouTubeUrl,
} from "@/hooks/share-link-hooks"
import type {
  ShareLink,
  ShareLinkViewingMode,
  YouTubeValidation,
} from "@/types/share-link.types"
import { formatWatchDuration } from "@/utils/time"

interface RecipientDraft {
  name: string
  email: string
}

const emptyRecipient = (): RecipientDraft => ({ name: "", email: "" })

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

/**
 * Share a video that isn't in a course.
 *
 * Paste a link, name who it goes to, send it — no course, version or cohort in
 * sight. ViBe files the video away out of view so the watching has somewhere
 * to record.
 */
export default function ShareVideoPage() {
  const [url, setUrl] = useState("")
  const [validation, setValidation] = useState<YouTubeValidation | null>(null)
  const [recipients, setRecipients] = useState<RecipientDraft[]>([
    emptyRecipient(),
  ])
  const [viewingMode, setViewingMode] = useState<ShareLinkViewingMode>("PLAIN")
  const [generated, setGenerated] = useState<ShareLink[]>([])
  const [sendEmail, setSendEmail] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const validateUrl = useValidateYouTubeUrl()
  const quickShare = useQuickShare()
  const { data: shares, isLoading: sharesLoading } = useQuickShares()

  const validRecipients = recipients.filter(
    r => r.name.trim() !== "" && isValidEmail(r.email.trim()),
  )
  const canShare =
    validRecipients.length > 0 && validation?.embeddable === true

  const handleCheck = async (value: string) => {
    if (!value.trim()) {
      setValidation(null)
      return
    }
    try {
      setValidation(await validateUrl.mutateAsync(value.trim()))
    } catch (err: any) {
      toast.error(err?.message || "Could not check that link. Try again.")
    }
  }

  const handleShare = async () => {
    try {
      const result = await quickShare.mutateAsync({
        url: url.trim(),
        recipients: validRecipients.map(r => ({
          name: r.name.trim(),
          email: r.email.trim(),
        })),
        viewingMode,
        sendEmail,
      })
      setGenerated(result.links)
      setRecipients([emptyRecipient()])
      setUrl("")
      setValidation(null)
      toast.success(`Shared “${result.videoTitle}” with ${result.links.length} person(s)`)
    } catch (err: any) {
      toast.error(err?.message || "Could not share that video")
    }
  }

  const handleCopy = async (link: ShareLink) => {
    await navigator.clipboard.writeText(link.url)
    setCopiedId(link.shareLinkId)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Link2 className="w-6 h-6" />
        <h1 className="text-xl md:text-2xl font-bold">Share a video</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">The video</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste a YouTube link. Recipients watch it inside ViBe — that is what
            lets you see who watched and how much. No course needed.
          </p>
          <Input
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={e => {
              setUrl(e.target.value)
              setValidation(null)
            }}
            onBlur={e => handleCheck(e.target.value)}
          />

          {validateUrl.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking the video…
            </div>
          )}

          {validation?.embeddable && (
            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-200">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Ready to share
                {validation.title ? ` — “${validation.title}”` : ""}.
              </span>
            </div>
          )}

          {validation && !validation.embeddable && (
            <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950/20 dark:text-orange-200">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{validation.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Share with</span>
            <Badge variant="secondary" className="text-xs">
              {validRecipients.length} recipient(s)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              onClick={handleShare}
              disabled={!canShare || quickShare.isPending}
            >
              {quickShare.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing…
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Share
                </>
              )}
            </Button>
          </div>

          {!validation?.embeddable && url.trim() !== "" && (
            <p className="text-xs text-muted-foreground">
              Check the video first — a video ViBe cannot play cannot be tracked
              either.
            </p>
          )}
        </CardContent>
      </Card>

      {generated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links ready to send</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-base">
            <BarChart3 className="w-5 h-5" />
            <span>Who watched</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sharesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : !shares || shares.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              You haven't shared any videos yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Watch time</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Rewinds</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shares.map(row => (
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
