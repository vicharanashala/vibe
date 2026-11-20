import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

import { useChangeUserEmail, type AdminUser } from './queries';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GOOGLE_NOTE =
  'They signed up with Google, so they have no password yet. They can set one with “Forgot password” on the sign-in page, using the new email.';

/** Admin: change the email a user signs in with. They keep their password, courses and progress. */
export function ChangeEmailDialog({ user, onOpenChange }: { user: AdminUser | null; onOpenChange: (open: boolean) => void }) {
  const change = useChangeUserEmail();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmail('');
    setError(null);
  }, [user]);

  const name = user ? `${user.firstName} ${user.lastName ?? ''}`.trim() || user.email : '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const next = email.trim().toLowerCase();
    if (!EMAIL.test(next)) return setError('Enter a valid email address.');
    if (next === user.email.trim().toLowerCase()) return setError('That’s already their email.');
    setError(null);
    try {
      const res = await change.mutateAsync({ userId: user._id, email: next });
      const noPassword = !res.signInMethods.includes('password');
      toast.success(`Email changed to ${res.email}`, {
        description: noPassword ? GOOGLE_NOTE : `${name} signs in with the new email from now on.`,
        duration: noPassword ? 12000 : 5000,
      });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message || 'Couldn’t change the email. Please try again.');
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Change email</DialogTitle>
            <DialogDescription>
              {name} · <span className="break-all">{user?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="new-email">New email</FieldLabel>
            <Input
              id="new-email"
              type="email"
              autoComplete="off"
              autoFocus
              placeholder="name@example.com"
              value={email}
              aria-invalid={!!error || undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>
                They keep their password, courses and progress, and sign in with the new email from now on. If they used
                Google to sign in, they can set a password with “Forgot password” on the sign-in page using the new email.
              </FieldDescription>
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={change.isPending || !email.trim()}>
              {change.isPending && <Spinner />}
              Change email
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
