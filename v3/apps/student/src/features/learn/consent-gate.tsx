import { CircleAlertIcon, ShieldCheckIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/features/auth/auth-provider';

import { ETHICS_CONSENT_ADDITIONAL, ETHICS_CONSENT_DECLARATION, ETHICS_CONSENT_TITLE, EthicsConsentBody } from './ethics-consent-text';
import { useSignConsent } from './queries';

/**
 * The participant consent form every student signs before their first lesson
 * in a course (same rule and wording as the current app).
 */
export function ConsentGate({ courseId, versionId }: { courseId: string; versionId: string }) {
  const { user } = useAuth();
  const sign = useSignConsent(courseId, versionId);
  const [signature, setSignature] = useState(user?.displayName ?? '');
  const [agreed, setAgreed] = useState(false);
  const [additional, setAdditional] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!agreed || !signature.trim()) return;
    sign.mutate({ signature: signature.trim(), additionalImageConsent: additional });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheckIcon className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-aleo text-2xl tracking-tight">{ETHICS_CONSENT_TITLE}</h1>
          <p className="text-sm text-muted-foreground">Please read this before your first lesson in this course.</p>
        </div>
      </div>

      <Card tabIndex={0} aria-label="Consent form" className="max-h-[45vh] overflow-y-auto px-5">
        <EthicsConsentBody />
      </Card>

      <form onSubmit={onSubmit} className="mt-6">
        <FieldGroup className="gap-4">
          <Field orientation="horizontal">
            <Checkbox id="consent-declaration" checked={agreed} onCheckedChange={(c) => setAgreed(c === true)} />
            <FieldLabel htmlFor="consent-declaration" className="font-normal leading-snug">
              {ETHICS_CONSENT_DECLARATION}
            </FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="consent-additional" checked={additional} onCheckedChange={(c) => setAdditional(c === true)} />
            <FieldLabel htmlFor="consent-additional" className="font-normal leading-snug text-muted-foreground">
              <span>
                {ETHICS_CONSENT_ADDITIONAL} <span className="italic">(optional)</span>
              </span>
            </FieldLabel>
          </Field>
          <Field className="sm:max-w-sm">
            <FieldLabel htmlFor="consent-signature">Type your full name to sign</FieldLabel>
            <Input id="consent-signature" value={signature} onChange={(e) => setSignature(e.target.value)} autoComplete="name" className="h-11 sm:h-10" />
            <FieldDescription>Date: {new Date().toLocaleDateString()}</FieldDescription>
          </Field>
          {sign.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{sign.error.message}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={!agreed || !signature.trim() || sign.isPending}>
            {sign.isPending && <Spinner />}
            Sign and continue
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
