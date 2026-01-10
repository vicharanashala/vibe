import React, { useState, useEffect, useRef } from "react";
import { Outlet, useMatches, Link, useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth-store";
import { logout } from "@/utils/auth";
import { LogOut, ArrowLeft, UserRoundCheck } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import type { BreadcrumbItemment } from "@/types/layout.types";
import InviteDropdown from "@/components/inviteDropDown";
import ConfirmationModal from "@/app/pages/teacher/components/confirmation-modal";

export default function TeacherLayout() {
  const matches = useMatches();
  const navigate = useNavigate();
  const { user } = useAuthStore(); // 🧠 from store
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [showInvites, setShowInvites] = useState(false);
  const [confirmLogout,setConfirmLogout] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const invitesRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = () => {
    logout();
    navigate({ to: "/auth" });
  };

  const handleGoBack = () => {
    window.history.back();
  };

  useEffect(() => {
    const items: BreadcrumbItem[] = [];
    items.push({
      label: "Dashboard",
      path: "/teacher",
      isCurrentPage: matches.length === 1,
    });

    if (matches.length > 1) {
      for (let i = 1; i < matches.length; i++) {
        const match = matches[i];
        const path = match.pathname;
        const segments = path.split("/").filter(Boolean);
        let label = segments[segments.length - 1] || "";
        label = label.replace(/-/g, " ");
        label = label.charAt(0).toUpperCase() + label.slice(1);

        items.push({
          label,
          path,
          isCurrentPage: i === matches.length - 1,
        });
      }
    }

    setBreadcrumbs(items);
  }, [matches]);

  useEffect(() => {
    if (!showInvites) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (invitesRef.current && target && !invitesRef.current.contains(target)) {
        setShowInvites(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowInvites(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true } as any);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown as any);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showInvites]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="max-w-full overflow-hidden h-screen flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear sticky top-0 z-50 bg-background">
          <div className="flex w-full items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 h-4" />

              <Breadcrumb className="hidden md:flex">
                <BreadcrumbList>
                  {breadcrumbs.map((item, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>
                        {item.isCurrentPage ? (
                          <BreadcrumbPage className="lg:flex md:hidden">{item.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={item.path} asChild>
                            <Link to={item.path}>{item.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-3">

              <div className="relative"  ref={invitesRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInvites((prev) => !prev)}
                 className="relative h-10 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-primary/5 data-[state=active]:text-primary before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                >
                  <UserRoundCheck className="h-4 w-4" />
                  <span className="hidden sm:block ml-2">Invites</span>
                </Button>

                {showInvites && <InviteDropdown setPendingInvites={setPendingInvites} pendingInvites={pendingInvites} />}
              </div>

              <ConfirmationModal isOpen={confirmLogout} 
                  onClose={()=>setConfirmLogout(false)} 
                  onConfirm={handleLogout} 
                  title={`Confirm Logout`}
                  description="Are you sure you want to log out? You will need to sign in again to access your dashboard."
                />

              <Button
                variant="ghost"
                size="sm"
                onClick={()=>setConfirmLogout(true)}
                 className="relative  h-10 px-4 text-sm font-medium transition-all duration-300  hover:text-red-600 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 hover:shadow-red-500/10 dark:hover:text-red-400  dark:hover:bg-gradient-to-r dark:over:from-red-500/10 dark:hover:to-red-400/5"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block ml-2">Logout</span>
              </Button>

              <ThemeToggle />

              <Link to="/teacher/profile" className="group relative">
                <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-primary/10 via-transparent to-secondary/10 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110 blur-sm" />
                <Avatar className="relative h-9 w-9 cursor-pointer border-2 border-transparent transition-all duration-300 group-hover:border-primary/20 group-hover:shadow-xl group-hover:shadow-primary/20 group-hover:scale-105">
                  <AvatarImage
                    src={user?.avatar || "/placeholder.svg"}
                    alt={user?.name}
                    className="transition-all duration-300"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 text-primary font-bold text-sm transition-all duration-300 group-hover:from-primary/25 group-hover:to-primary/10">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col md:p-6 p-4 max-w-full overflow-auto">
          <Outlet />
        </div>
      </SidebarInset >
    </SidebarProvider >
  );
}
