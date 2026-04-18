import React, { useState, useEffect } from "react";
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

export default function TeacherLayout() {
  const matches = useMatches();
  const navigate = useNavigate();
  const { user } = useAuthStore(); // 🧠 from store
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [showInvites, setShowInvites] = useState(false);

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

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
          <div className="flex w-full items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 h-4" />

              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((item, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>
                        {item.isCurrentPage ? (
                          <BreadcrumbPage>{item.label}</BreadcrumbPage>
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

              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInvites((prev) => !prev)}
                  className="relative h-9 px-3 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 hover:text-red-600 dark:hover:text-red-400 hover:shadow-lg hover:shadow-red-500/10"
                >
                  <UserRoundCheck className="h-4 w-4" />
                  <span className="hidden sm:block ml-2">Invites</span>
                </Button>

                {showInvites && <InviteDropdown />}
              </div>


              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="relative h-9 px-3 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 hover:text-red-600 dark:hover:text-red-400 hover:shadow-lg hover:shadow-red-500/10"
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

        <div className="flex flex-1 flex-col p-6">
          <Outlet />
        </div>
      </SidebarInset >
    </SidebarProvider >
  );
}
