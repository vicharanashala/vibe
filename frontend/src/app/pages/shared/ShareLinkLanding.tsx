"use client"

import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import { signInWithCustomToken } from "firebase/auth"
import { AlertTriangle, Loader2 } from "lucide-react"

import { auth } from "@/lib/firebase"
import { openShareLink } from "@/lib/api/share-links"
import { useAuthStore } from "@/store/auth-store"
import { useCourseStore } from "@/store/course-store"
import { useShareLinkStore } from "@/store/share-link-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Landing page for a share link: `/share/:token`.
 *
 * The recipient never signs in. The token is exchanged for a Firebase custom
 * token, which is exchanged for an ID token, and from there they are an
 * ordinary (guest) viewer of the course — which is what makes their watching
 * trackable at all.
 */
export default function ShareLinkLanding() {
  const { token } = useParams({ strict: false }) as { token?: string }
  const navigate = useNavigate()
  const { setToken, setUser } = useAuthStore()
  const { setCurrentCourse } = useCourseStore()
  const { setSession } = useShareLinkStore()

  const [error, setError] = useState<string | null>(null)
  // React 18 mounts effects twice in development; opening twice would burn two
  // requests and race the sign-in.
  const hasOpened = useRef(false)

  useEffect(() => {
    if (!token || hasOpened.current) return
    hasOpened.current = true

    const open = async () => {
      try {
        const link = await openShareLink(token)

        const credential = await signInWithCustomToken(auth, link.customToken)
        const idToken = await credential.user.getIdToken()
        setToken(idToken)
        setUser({
          uid: credential.user.uid,
          email: credential.user.email ?? "",
          name: link.recipientName,
          firstName: link.recipientName.split(" ")[0],
          role: "student",
        })

        setSession({
          recipientName: link.recipientName,
          viewingMode: link.viewingMode,
          courseId: link.courseId,
          courseVersionId: link.courseVersionId,
        })

        setCurrentCourse({
          courseId: link.courseId,
          versionId: link.courseVersionId,
          moduleId: null,
          sectionId: null,
          itemId: link.itemId ?? null,
          watchItemId: link.itemId ?? null,
        })

        navigate({ to: "/student/learn" })
      } catch (err: any) {
        setError(
          err?.message ||
            "This link is not valid, or it has expired. Ask whoever shared it for a new one.",
        )
      }
    }

    open()
  }, [token, navigate, setToken, setUser, setCurrentCourse, setSession])

  if (!token) {
    return <ShareLinkError message="This link is missing its token." />
  }

  if (error) {
    return <ShareLinkError message={error} />
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground">Opening your video…</p>
      </div>
    </div>
  )
}

function ShareLinkError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <AlertTriangle className="h-8 w-8 text-orange-500" />
          <p className="text-sm">{message}</p>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            Go to ViBe
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
