import { MoreHorizontalIcon, SearchIcon, ShieldCheckIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { GeneratedAvatar } from '@/components/generated-art';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAllUsers, useMakeAdmin, useStudioAccess, type AdminUser } from './queries';
import { ConfirmDialog, ErrorText, pageOf, PageHeader, Pager, RoleBadge, sinceCutoff, SINCE_OPTIONS, StudioPage, type Since } from './studio-ui';

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

const PAGE_SIZE = 50;
type Sort = 'newest' | 'oldest' | 'name';

const joinedFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const joinedFull = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function AllUsers() {
  const users = useAllUsers();
  const makeAdmin = useMakeAdmin();
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim().toLowerCase());
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [joined, setJoined] = useState<Since>('any');
  const [page, setPage] = useState(0);
  const [promoting, setPromoting] = useState<AdminUser | null>(null);

  // Back to the first page whenever what's shown changes.
  useEffect(() => setPage(0), [search, filter, sort, joined]);

  const all = users.data;
  const counts = useMemo(() => {
    const list = all ?? [];
    const admins = list.reduce((n, u) => n + (u.roles === 'admin' ? 1 : 0), 0);
    return { all: list.length, admin: admins, user: list.length - admins };
  }, [all]);

  const shown = useMemo(() => {
    const since = sinceCutoff(joined);
    const list = (all ?? []).filter(
      (u) =>
        (filter === 'all' || u.roles === filter) &&
        (!search || u.searchText.includes(search)) &&
        (since === null || (u.joinedAt !== null && u.joinedAt >= since)),
    );
    // Accounts without a creation time sort last either way.
    const time = (u: AdminUser, missing: number) => u.joinedAt ?? missing;
    if (sort === 'newest') list.sort((a, b) => time(b, -Infinity) - time(a, -Infinity));
    else if (sort === 'oldest') list.sort((a, b) => time(a, Infinity) - time(b, Infinity));
    else list.sort((a, b) => `${a.firstName} ${a.lastName ?? ''}`.localeCompare(`${b.firstName} ${b.lastName ?? ''}`) || a.email.localeCompare(b.email));
    return list;
  }, [all, search, filter, sort, joined]);

  const { rows, current, pages } = pageOf(shown, page, PAGE_SIZE);
  const nf = new Intl.NumberFormat();

  return (
    <StudioPage>
      <PageHeader title="Users" description="Every account on ViBe. Admins can open the studio and manage all courses." />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All {all && <span className="text-muted-foreground tabular-nums">{nf.format(counts.all)}</span>}</TabsTrigger>
            <TabsTrigger value="admin">Admins {all && <span className="text-muted-foreground tabular-nums">{nf.format(counts.admin)}</span>}</TabsTrigger>
            <TabsTrigger value="user">Learners {all && <span className="text-muted-foreground tabular-nums">{nf.format(counts.user)}</span>}</TabsTrigger>
          </TabsList>
        </Tabs>
        <InputGroup className="w-full bg-card sm:w-72">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput aria-label="Search users" placeholder="Search by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <NativeSelect size="sm" aria-label="Joined" value={joined} onChange={(e) => setJoined(e.target.value as Since)} className="bg-card">
          {SINCE_OPTIONS.map((j) => (
            <NativeSelectOption key={j.value} value={j.value}>
              Joined {j.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect size="sm" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-card">
          <NativeSelectOption value="newest">Newest first</NativeSelectOption>
          <NativeSelectOption value="oldest">Oldest first</NativeSelectOption>
          <NativeSelectOption value="name">Name, A–Z</NativeSelectOption>
        </NativeSelect>
      </div>

      <div className="mt-4">
        {users.isPending && <Skeleton className="h-64 rounded-2xl" />}
        {users.isError && <ErrorText error={users.error} />}
        {all && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">User</TableHead>
                  <TableHead className="max-sm:hidden">Joined</TableHead>
                  <TableHead className="max-sm:hidden">Role</TableHead>
                  <TableHead className="w-12 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u._id}>
                    <TableCell className="max-w-0 pl-4">
                      <div className="flex items-center gap-3">
                        <GeneratedAvatar seed={u._id} size={30} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {u.firstName} {u.lastName ?? ''}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          {/* Phones: the Joined and Role columns are hidden, so show them here. */}
                          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
                            <RoleBadge role={u.roles === 'admin' ? 'admin' : 'learner'} />
                            {u.joinedAt !== null && <span>Joined {joinedFmt.format(u.joinedAt)}</span>}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground max-sm:hidden">
                      {u.joinedAt !== null ? <time dateTime={new Date(u.joinedAt).toISOString()} title={joinedFull.format(u.joinedAt)}>{joinedFmt.format(u.joinedAt)}</time> : '—'}
                    </TableCell>
                    <TableCell className="max-sm:hidden">
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
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No users match.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pager current={current} pages={pages} pageSize={PAGE_SIZE} shownOnPage={rows.length} total={shown.length} onPage={setPage} className="border-t border-border" />
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
