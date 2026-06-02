import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, ArrowDown } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  EthicsConsentBody,
  ETHICS_CONSENT_TITLE,
  ETHICS_CONSENT_DECLARATION,
  ETHICS_CONSENT_ADDITIONAL,
  ETHICS_CONSENT_VERSION,
} from "@/constants/ethicsConsent";
import { useSignEthicsConsent } from "@/hooks/system-notification-hooks";
import { useAuthStore } from "@/store/auth-store";

interface EthicsConsentModalProps {
  open: boolean;
  courseId: string;
  versionId: string;
  /** Called after the consent has been successfully signed and recorded. */
  onSigned: () => void;
  /** Called when the student declines / dismisses (navigates away from the course). */
  onCancel: () => void;
}

type Step = "form" | "preview";

export function EthicsConsentModal({
  open,
  courseId,
  versionId,
  onSigned,
  onCancel,
}: EthicsConsentModalProps) {
  const { user } = useAuthStore();
  const signEthicsConsent = useSignEthicsConsent();

  const [step, setStep] = useState<Step>("form");
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [agreeDeclaration, setAgreeDeclaration] = useState(false);
  const [agreeAdditional, setAgreeAdditional] = useState(false);
  const [signature, setSignature] = useState(user?.name ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Scroll-to-end gate ──────────────────────────────────────────────────────
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setHasScrolledToEnd(true);
    }
  };

  // If the content fits without scrolling, unlock immediately.
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleScrollRef = (node: HTMLDivElement | null) => {
    scrollRef.current = node;
    if (node && node.scrollHeight <= node.clientHeight + 24) {
      setHasScrolledToEnd(true);
    }
  };

  const canReview =
    hasScrolledToEnd &&
    agreeDeclaration &&
    agreeAdditional &&
    signature.trim().length > 0;

  const handleSubmit = async () => {
    if (!canReview) return;
    setIsSubmitting(true);
    try {
      await signEthicsConsent.mutateAsync({
        params: { path: { courseId, versionId } },
        body: {
          signature: signature.trim(),
          additionalImageConsent: agreeAdditional,
        },
      } as any);
      toast.success("Consent signed. You can now access your course.");
      onSigned();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not record your consent. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <DialogContent
        className="sm:max-w-2xl w-[calc(100%-2rem)] max-w-full"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {step === "form" ? ETHICS_CONSENT_TITLE : "Review & Sign"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Please read the full consent below. Scroll to the end to enable signing."
              : "Confirm the details below are correct, then accept to sign."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <>
            {/* Scrollable consent body */}
            <div
              ref={handleScrollRef}
              onScroll={handleScroll}
              className="max-h-[50vh] overflow-y-auto rounded-md border border-border/60 bg-muted/20 p-4"
            >
              <EthicsConsentBody />
            </div>

            {!hasScrolledToEnd && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowDown className="h-3.5 w-3.5" />
                Please scroll to the end of the document to continue.
              </p>
            )}

            {/* Mandatory declaration */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="ethics-declaration"
                className="mt-0.5"
                checked={agreeDeclaration}
                disabled={!hasScrolledToEnd}
                onCheckedChange={(v) => setAgreeDeclaration(!!v)}
              />
              <Label
                htmlFor="ethics-declaration"
                className="text-sm font-normal leading-snug cursor-pointer"
              >
                {ETHICS_CONSENT_DECLARATION}
              </Label>
            </div>

            {/* Additional consent (required) */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="ethics-additional"
                className="mt-0.5"
                checked={agreeAdditional}
                disabled={!hasScrolledToEnd}
                onCheckedChange={(v) => setAgreeAdditional(!!v)}
              />
              <Label
                htmlFor="ethics-additional"
                className="text-sm font-normal leading-snug cursor-pointer"
              >
                {ETHICS_CONSENT_ADDITIONAL}
              </Label>
            </div>

            {/* Signature */}
            <div className="space-y-1.5">
              <Label htmlFor="ethics-signature" className="text-sm">
                Signature — type your full name
              </Label>
              <Input
                id="ethics-signature"
                placeholder="Your full name"
                value={signature}
                disabled={!hasScrolledToEnd}
                onChange={(e) => setSignature(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Decline
              </Button>
              <Button disabled={!canReview} onClick={() => setStep("preview")}>
                Review &amp; Sign
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Signed-form preview */}
            <div className="rounded-md border border-border/60 bg-muted/20 p-5">
              <p className="mb-4 text-sm text-muted-foreground">
                By accepting, the following consent will be recorded against your enrollment:
              </p>
              <dl className="space-y-3 text-sm">
                <div className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Participant Name
                  </dt>
                  <dd className="font-medium">{signature.trim()}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Signature
                  </dt>
                  <dd
                    className="text-xl text-primary"
                    style={{ fontFamily: "cursive" }}
                  >
                    {signature.trim()}
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Date
                  </dt>
                  <dd className="font-medium">{todayLabel}</dd>
                </div>
                <div className="flex flex-col border-t border-border/60 pt-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Participant Declaration
                  </dt>
                  <dd className="text-green-600 dark:text-green-500">✓ Agreed</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Additional Consent (future research / demonstration)
                  </dt>
                  <dd className={agreeAdditional ? "text-green-600 dark:text-green-500" : "text-muted-foreground"}>
                    {agreeAdditional ? "✓ Agreed" : "Not granted"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep("form")}
                disabled={isSubmitting}
              >
                Back to edit
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Recording…" : "Accept & Sign"}
              </Button>
            </div>
          </>
        )}

        <p className="text-center text-[10px] text-muted-foreground">
          Consent version {ETHICS_CONSENT_VERSION}
        </p>
      </DialogContent>
    </Dialog>
  );
}
