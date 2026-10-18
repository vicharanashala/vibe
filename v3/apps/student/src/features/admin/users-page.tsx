import { MoreHorizontalIcon, SearchIcon, ShieldCheckIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { GeneratedAvatar } from '@/components/generated-art';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAllUsers, useMakeAdmin, useStudioAccess, type AdminUser } from './queries';
import { ConfirmDialog, ErrorText, PageHeader, RoleBadge, StudioPage } from './studio-ui';

type Filter = 'all' | 'admin' | 'user';

/** Every account, Substack "Subscribers"-style: count, search, role filter, row actions. Admins only. */
export function UsersPage() {
  const { isAdmin } = useStudioAccess();
  return isAdmin ? <AllUsers /> : <AdminsOnly />;
}

/** Teachers reach the studio too; the account list stays admin-only (as on the backend). */
function AdminsOnly() {
  return (
    <StudioPage>
      <Empty className="rounded-2xl border border-dashed border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheckIcon />
          </EmptyMedia>
          <EmptyTitle>Admins only</EmptyTitle>
          <EmptyDescription>Only admins can see every account. You can manage the people in your own courses from each course’s People tab.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </StudioPage>
  );
}

function AllUsers() {
  const users = useAllUsers();
  const makeAdmin = useMakeAdmin();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [promoting, setPromoting] = useState<AdminUser | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users.data ?? []).filter(
      (u) => (filter === 'all' || u.roles === filter) && (!q || u.email.toLowerCase().includes(q) || `${u.firstName} ${u.lastName ?? ''}`.toLowerCase().includes(q)),
    );
  }, [users.data, query, filter]);
  const count = (f: Filter) => (users.data ?? []).filter((u) => f === 'all' || u.roles === f).length;

  return (
    <StudioPage>
      <PageHeader title="Users" description="Every account on ViBe. Admins can open the studio and manage all courses." />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All {users.data && <span className="text-muted-foreground tabular-nums">{count('all')}</span>}</TabsTrigger>
            <TabsTrigger value="admin">Admins {users.data && <span className="text-muted-foreground tabular-nums">{count('admin')}</span>}</TabsTrigger>
            <TabsTrigger value="user">Learners {users.data && <span className="text-muted-foreground tabular-nums">{count('user')}</span>}</TabsTrigger>
          </TabsList>
        </Tabs>
        <InputGroup className="w-full bg-card sm:w-72">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput aria-label="Search users" placeholder="Search by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
      </div>

      <div className="mt-4">
        {users.isPending && <Skeleton className="h-64 rounded-2xl" />}
        {users.isError && <ErrorText error={users.error} />}
        {users.data && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-12 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((u) => (
                  <TableRow key={u._id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <GeneratedAvatar seed={u._id} size={30} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {u.firstName} {u.lastName ?? ''}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={u.roles === 'admin' ? 'admin' : 'learner'} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {u.roles !== 'admin' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.email}`} className="text-muted-foreground" />}>
                            <MoreHorizontalIcon aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setPromoting(u)}>
                              <ShieldCheckIcon /> Make admin
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No users match.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!promoting}
        onOpenChange={(o) => !o && setPromoting(null)}
        title={`Make ${promoting?.firstName ?? 'this user'} an admin?`}
        description={
          <>
            {promoting?.email} will be able to open the studio and manage every course and user. There’s no way to remove admin rights here yet.
          </>
        }
        confirmLabel="Make admin"
        destructive={false}
        onConfirm={async () => {
          await makeAdmin.mutateAsync(promoting!._id);
          toast.success(`${promoting!.email} is now an admin.`);
        }}
      />
    </StudioPage>
  );
}
