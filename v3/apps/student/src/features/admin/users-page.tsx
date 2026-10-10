import { ApiError } from '@vibe/api';
import { ShieldCheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { useAllUsers, useMakeAdmin } from './queries';

function Status({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={cn('text-sm', kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
      {children}
    </p>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function UsersPage() {
  const users = useAllUsers();
  const makeAdmin = useMakeAdmin();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="font-aleo text-3xl tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every account in the system. Promote someone to admin here - there's no way to demote one yet.</p>

      <div className="mt-6">
        {users.isPending && <Spinner className="text-muted-foreground" />}
        {users.isError && <Status kind="error">{errorMessage(users.error)}</Status>}
        {users.data && (
          <div className="rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.map((u) => (
                  <TableRow key={u._id}>
                    <TableCell>
                      {u.firstName} {u.lastName ?? ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {u.roles === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <ShieldCheckIcon className="size-3.5" aria-hidden /> Admin
                        </span>
                      ) : (
                        'User'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.roles !== 'admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={makeAdmin.isPending}
                          onClick={() => makeAdmin.mutate(u._id)}
                        >
                          {makeAdmin.isPending && makeAdmin.variables === u._id ? <Spinner className="size-3.5" /> : null}
                          Make admin
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {makeAdmin.isError && <Status kind="error">{errorMessage(makeAdmin.error)}</Status>}
      </div>
    </div>
  );
}
