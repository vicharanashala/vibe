import { Link } from '@tanstack/react-router';
import { MailCheckIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';

import { AuthLayout, FormError } from './auth-layout';
import { useAuth } from './auth-provider';

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await sendPasswordReset(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const backToLogin = (
    <>
      Remember your password?{' '}
      <Link to="/login" className="font-medium text-foreground hover:underline">
        Back to log in
      </Link>
    </>
  );

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox" footer={backToLogin}>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <MailCheckIcon className="size-8 text-primary" aria-hidden />
            <p className="text-sm">
              If an account exists for <span className="font-medium">{sentTo}</span>, a link to reset your password is on its way.
            </p>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we’ll send you a link to reset it." footer={backToLogin}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <Input id="email" type="email" autoCapitalize="none" spellCheck={false} autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 sm:h-10" />
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={!email.trim() || pending}>
            {pending && <Spinner />}
            Send reset link
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
