"use client";

import * as React from "react";
import {
  AudioWaveform,
  BookMarked,
  Calendar,
  Command,
  FilePen,
  Home,
  Inbox,
  LogOut,
  MessageCircleQuestion,
  Settings2,
  Trash2,
} from "lucide-react";

import { Sidebar, SidebarContent, SidebarHeader, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { TeamSwitcher } from "@/components/team-switcher";
import { CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Sample data with subparts and sub-subparts
const data = {
  teams: [
    { name: "CAL", logo: Command, plan: "Enterprise" },
    { name: "CAL", logo: AudioWaveform, plan: "Startup" },
    { name: "CAL", logo: Command, plan: "Free" },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: Home,
      subparts: [],
    },
    {
      title: "Courses",
      url: "#",
      icon: BookMarked,
      subparts: [
        {
          title: "Math 101",
          url: "#math",
          subsubparts: [
            { title: "Algebra", url: "#algebra" },
            { title: "Geometry", url: "#geometry" },
          ],
        },
        {
          title: "Physics 202",
          url: "#physics",
          subsubparts: [
            { title: "Kinematics", url: "#kinematics" },
            { title: "Dynamics", url: "#dynamics" },
          ],
        },
      ],
    },
    {
      title: "Assignments",
      url: "#",
      icon: FilePen,
      subparts: [
        {
          title: "Assignment 1",
          url: "#assign1",
          subsubparts: [
            { title: "Part A", url: "#parta" },
            { title: "Part B", url: "#partb" },
          ],
        },
      ],
    },

    {
      title: "Announcements",
      url: "#",
      icon: Inbox,
      badge: "10",
      subparts: [
        {
          title: "General Updates",
          url: "#updates",
          subsubparts: []
        },
        {
          title: "New Policies",
          url: "#policies",
          subsubparts: []
        },
      ],
    },

  ],
  navSecondary: [
    { title: "Calendar", url: "#", icon: Calendar },
    { title: "Settings", url: "#", icon: Settings2 },
    { title: "Logout", url: "#", icon: LogOut },
    { title: "Trash", url: "#", icon: Trash2 },
    { title: "Help", url: "#", icon: MessageCircleQuestion },
  ],
};



export function SidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [selectedNav, setSelectedNav] = React.useState<NavItem | null>(null);
  const [selectedSubpart, setSelectedSubpart] = React.useState<Subpart | null>(null);
  const { setOpen } = useSidebar(); // Access setOpen to control the sidebar state
  console.log("props")
  console.log("setOpen",setOpen)

  interface NavItem {
    title: string;
    url: string;
    icon: React.ComponentType;
    subparts: Subpart[];
    badge?: string;
  }

  interface Subpart {
    title: string;
    url: string;
    subsubparts: Subsubpart[];
  }

  interface Subsubpart {
    title: string;
    url: string;
  }

  const handleNavClick = (item: NavItem) => {
    if (selectedNav?.title === item.title) {
      setSelectedNav(null); // Toggle off if already selected
    } else {
      setSelectedNav(item); // Show dropdown for subparts
      setOpen(true);
    }
    setSelectedSubpart(null); // Reset subparts panel when switching main nav
    setOpen(true);
  };

  const handleSubpartClick = (subpart: Subpart) => {
    setSelectedSubpart(subpart); // Show panel for subsubparts
    setOpen(false);
    setSelectedNav(null);
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar className="w-60 border-r" {...props} collapsible="icon">
        <SidebarHeader className="pr-4 pl-2 py-3">
          <TeamSwitcher teams={data.teams} />
        </SidebarHeader>
        <SidebarContent className="flex-col justify-between px-2">
          <nav className="space-y-1">
            {data.navMain.map((item) => (
              <div key={item.title}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <SidebarMenuButton
                        className={`flex items-center text-left w-56 pl-2 pr-4 py-2 text-sm rounded-md`}
                        onClick={() => handleNavClick(item)}
                      >
                        <item.icon className="w-5 h-5 mr-3" />
                        <span className="flex-1">{item.title}</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.title}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {selectedNav?.title === item.title && item.subparts.length > 0 && (
                  <div className="pl-8 space-y-1">
                    {item.subparts.map((subpart) => (
                      <SidebarMenuButton
                        key={subpart.title}
                        className=""
                        onClick={() => {
                          handleSubpartClick(subpart);
                        }}
                      >
                        {subpart.title}
                      </SidebarMenuButton>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
          <nav className="space-y-1">
            {data.navSecondary.map((item) => (
              <SidebarMenuButton
                key={item.title}
                onClick={() => window.location.href = item.url}
                className="flex items-center pl-2 pr-4 py-2 text-sm rounded-md"
              >
                <item.icon className="w-5 h-5 mr-3 flex" />
                <span>{item.title}</span>
              </SidebarMenuButton>
            ))}
          </nav>
        </SidebarContent>
      </Sidebar>

      {/* Subparts Panel */}
      {
        selectedSubpart && (
          <div className="w-56 border-r rounded-none">
            <CardHeader>
              <CardTitle className="text-lg">{selectedSubpart.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="mt-2 w-full">
                {selectedSubpart.subsubparts.map((subsubpart) => (
                  <li key={subsubpart.title}>
                    <SidebarMenuButton>
                      <a
                        href={subsubpart.url}
                        className=""
                      >
                        {subsubpart.title}
                      </a>
                    </SidebarMenuButton>
                    <Separator />

                  </li>
                ))}
              </ul>
            </CardContent>
          </div>
        )
      }
    </div >
  );
}
