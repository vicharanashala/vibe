import React, { useState, useEffect } from "react";
import { Outlet, useMatches, Link, useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { logout } from "@/utils/auth";
import { LogOut } from "lucide-react";
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

interface BreadcrumbItem {
  label: string;
  path: string;
  isCurrentPage?: boolean;
}

export default function TeacherLayout() {
  const matches = useMatches();
  const navigate = useNavigate();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  const handleLogout = () => {
    logout();
    navigate({ to: "/auth" });
  };

  // Generate breadcrumbs based on the current path
  useEffect(() => {
    const items: BreadcrumbItem[] = [];
    
    // Add Dashboard as first item
    items.push({
      label: 'Dashboard',
      path: '/teacher',
      isCurrentPage: matches.length === 1
    });
    
    // Add route segments as breadcrumb items
    if (matches.length > 1) {
      for (let i = 1; i < matches.length; i++) {
        const match = matches[i];
        const path = match.pathname;
        
        // Get the last segment of the path for the label
        const segments = path.split('/').filter(Boolean);
        let label = segments[segments.length - 1] || '';
        
        // Format label (capitalize, replace hyphens with spaces)
        label = label.replace(/-/g, ' ');
        label = label.charAt(0).toUpperCase() + label.slice(1);
        
        items.push({
          label,
          path,
          isCurrentPage: i === matches.length - 1
        });
      }
    }
    
    setBreadcrumbs(items);
  }, [matches]);
    // console.log('Current user role:', user?.role);


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
            
            {/* Add Theme Toggle and Logout Button */}
            <div className="flex items-center gap-3">
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
            </div>
          </div>
        </header>
        
        <div className="flex flex-1 flex-col p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
