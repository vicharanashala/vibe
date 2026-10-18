import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  HomeIcon,
  LogOutIcon,
  MoonIcon,
  PlusIcon,
  ShieldAlertIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ArtPaletteContext, GeneratedAvatar, STUDIO_PALETTE } from '@/components/generated-art';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/features/auth/auth-provider';
import { NotificationBell } from '@/features/notifications/notification-bell';

import { NewCourseDialog } from './new-course-dialog';
import { useCurrentUserProfile } from './queries';

type NavTo = '/admin' | '/admin/courses' | '/admin/users';

const NAV_GROUPS: { label?: string; items: { label: string; to: NavTo; icon: LucideIcon }[] }[] = [
  { items: [{ label: 'Home', to: '/admin', icon: HomeIcon }] },
  { label: 'Content', items: [{ label: 'Courses', to: '/admin/courses', icon: BookOpenIcon }] },
  { label: 'People', items: [{ label: 'Users', to: '/admin/users', icon: UsersIcon }] },
];

/** Page name shown in the top bar, Substack-style. */
function titleFor(pathname: string) {
  if (pathname.startsWith('/admin/courses')) return 'Courses';
  if (pathname.startsWith('/admin/users')) return 'Users';
  return 'Home';
}

/**
 * Studio: the teacher/admin area. Its own chrome (Substack-like sidebar with a
 * "New course" call to action) and its own warm theme, applied by putting
 * `studio` on <html> while mounted so portalled menus and dialogs match.
 */
export function AdminShell() {
  const profile = useCurrentUserProfile();
  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    document.documentElement.classList.add('studio');
    return () => document.documentElement.classList.remove('studio');
  }, []);

  if (profile.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (profile.isError || profile.data?.roles !== 'admin') {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlertIcon />
            </EmptyMedia>
            <EmptyTitle className="font-aleo text-2xl">Admins only</EmptyTitle>
            <EmptyDescription>You need an admin account to use the studio.</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" render={<Link to="/home" />}>
            <ArrowLeftIcon aria-hidden /> Back to learning
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <ArtPaletteContext.Provider value={STUDIO_PALETTE}>
      <SidebarProvider>
        <Sidebar aria-label="Studio sidebar">
          <SidebarHeader className="gap-3 p-3">
            <Link to="/admin" aria-label="Studio home" className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-card px-2.5 py-2 shadow-xs">
              <span className="grid size-7 place-items-center rounded-md bg-primary font-aleo text-sm font-semibold text-primary-foreground">V</span>
              <span className="min-w-0 leading-tight">
                <span className="block font-aleo text-sm font-semibold">ViBe Studio</span>
                <span className="block truncate text-[11px] text-muted-foreground">{profile.data.email}</span>
              </span>
            </Link>
            <Button className="w-full" onClick={() => setNewCourseOpen(true)}>
              <PlusIcon aria-hidden /> New course
            </Button>
          </SidebarHeader>

          <SidebarContent>
            {NAV_GROUPS.map((group, i) => (
              <SidebarGroup key={group.label ?? i} className="py-1">
                {group.label && <SidebarGroupLabel className="text-[11px] tracking-wider uppercase">{group.label}</SidebarGroupLabel>}
                <StudioNav items={group.items} pathname={pathname} />
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link to="/home" />} className="text-muted-foreground">
                  <ArrowLeftIcon aria-hidden />
                  <span>Back to learning</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md [box-sizing:content-box] sm:px-6">
            <SidebarTrigger className="-ml-1.5" />
            <span className="text-lg font-semibold tracking-tight">{titleFor(pathname)}</span>
            <div className="ml-auto flex items-center gap-1">
              <ThemeButton />
              <NotificationBell />
              <StudioAccountMenu />
            </div>
          </header>
          <div id="main" className="relative flex-1">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <NewCourseDialog open={newCourseOpen} onOpenChange={setNewCourseOpen} />
    </ArtPaletteContext.Provider>
  );
}

function StudioNav({ items, pathname }: { items: { label: string; to: NavTo; icon: LucideIcon }[]; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {items.map(({ label, to, icon: Icon }) => (
        <SidebarMenuItem key={to}>
          <SidebarMenuButton
            isActive={to === '/admin' ? pathname === '/admin' || pathname === '/admin/' : pathname.startsWith(to)}
            render={<Link to={to} onClick={() => isMobile && setOpenMobile(false)} />}
          >
            <Icon aria-hidden />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme}>
      {theme === 'dark' ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
    </Button>
  );
}

function StudioAccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    await navigate({ to: '/login', replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="ml-1 grid size-9 place-items-center rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'admin'} size={34} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex flex-col items-center gap-1 px-3 py-3 text-center">
          <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'admin'} size={44} />
          {user?.displayName && <span className="text-sm font-medium">{user.displayName}</span>}
          <span className="max-w-full truncate text-xs text-muted-foreground">{user?.email}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: '/home' })}>
          <ArrowLeftIcon /> Back to learning
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: '/profile' })}>
          <UserIcon /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
