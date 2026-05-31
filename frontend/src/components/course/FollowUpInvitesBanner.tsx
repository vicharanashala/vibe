import { useEffect, useState } from "react";
import { useInvites, useAcceptInvite } from "@/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Persistent banner shown on the student dashboard listing any pending course
 * invites (e.g. the exclusive follow-up course unlocked on completing another
 * course). Stays until the student claims or the invite is otherwise resolved.
 */
export function FollowUpInvitesBanner() {
  const { getInvites } = useInvites();
  const { acceptInvite, loading: accepting } = useAcceptInvite();
  const [invites, setInvites] = useState<any[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = async (inviteId: string) => {
    setClaimingId(inviteId);
    try {
      await acceptInvite(inviteId, "ACCEPT");
      toast.success("You're enrolled! Redirecting to your courses…");
      // Reload so the new enrollment shows and this invite drops off.
      window.location.assign("/student");
    } catch {
      toast.error("Couldn't claim your spot. Please try again.");
      setClaimingId(null);
    }
  };

  useEffect(() => {
    let active = true;
    getInvites()
      .then((res) => {
        if (!active) return;
        const pending = (res?.invites ?? []).filter(
          (i: any) => i?.inviteStatus === "PENDING",
        );
        setInvites(pending);
      })
      .catch(() => {
        /* silently ignore — banner is optional */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!invites.length) return null;

  return (
    <div className="space-y-3">
      {invites.map((inv) => (
        <div
          key={inv.inviteId?.toString()}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">🎉 Continue your journey</p>
              <p className="text-sm text-muted-foreground">
                You've earned an exclusive spot in{" "}
                <span className="font-medium text-foreground">
                  {inv.course?.name ?? "a new course"}
                </span>
                . Claim it to get started.
              </p>
            </div>
          </div>
          <Button
            className="font-semibold shrink-0"
            disabled={accepting && claimingId === inv.inviteId?.toString()}
            onClick={() => handleClaim(inv.inviteId?.toString())}
          >
            {accepting && claimingId === inv.inviteId?.toString() ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" /> Claiming…
              </>
            ) : (
              "Claim my spot"
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}
