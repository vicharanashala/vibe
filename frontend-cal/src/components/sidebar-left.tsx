"use client";

import * as React from "react";
import {
  AudioWaveform,
  BookMarked,
  Calendar,
  Command,
  File,
  Home,
  Inbox,
  LogOut,
  MessageCircleQuestion,
  Settings2,
  Trash2,
} from "lucide-react";

import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { TeamSwitcher } from "@/components/team-switcher";

// Sample data with subparts for each navigation item
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
        { title: "Math 101", url: "#math" },
        { title: "Physics 202", url: "#physics" },
        { title: "Biology 303", url: "#biology" },
      ],
    },
    {
      title: "Assignments",
      url: "#",
      icon: File,
      subparts: [
        { title: "Assignment 1", url: "#assign1" },
        { title: "Assignment 2", url: "#assign2" },
      ],
    },
    {
      title: "Announcements",
      url: "#",
      icon: Inbox,
      badge: "10",
      subparts: [
        { title: "General Updates", url: "#updates" },
        { title: "New Policies", url: "#policies" },
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
  const [selectedNav, setSelectedNav] = React.useState(null);

  const handleNavClick = (item) => {
    if (selectedNav?.title === item.title) {
      setSelectedNav(null); // Close the subparts panel if the same item is clicked again
    } else {
      setSelectedNav(item); // Open subparts panel
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar className="w-60 bg-gray-50 border-r border-gray-200 flex flex-col" {...props}>
        <SidebarHeader className="px-4 py-3">
          <TeamSwitcher teams={data.teams} />
        </SidebarHeader>
        <SidebarContent className="flex-1 px-2">
          <nav className="space-y-1">
            {data.navMain.map((item) => (
              <button
                key={item.title}
                className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-md ${
                  selectedNav?.title === item.title
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-800 hover:bg-gray-100"
                }`}
                onClick={() => handleNavClick(item)}
              >
                <item.icon className="w-5 h-5 mr-3" />
                <span className="flex-1">{item.title}</span>
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </SidebarContent>

        {/* NavSecondary Section */}
        <div className="border-t border-gray-200">
          <nav className="p-2 space-y-1">
            {data.navSecondary.map((item) => (
              <a
                key={item.title}
                href={item.url}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
              >
                <item.icon className="w-5 h-5 mr-3" />
                <span>{item.title}</span>
              </a>
            ))}
          </nav>
        </div>
      </Sidebar>

      {/* Subparts Panel */}
      {selectedNav && selectedNav.subparts.length > 0 && (
        <div className="w-64 bg-gray-50 border-l border-gray-200 mr-2">
          <div className="p-4">
            <h2 className="text-lg text-gray-800">{selectedNav.title}</h2>
            <ul className="mt-4 space-y-2">
              {selectedNav.subparts.map((subpart) => (
                <li key={subpart.title}>
                  <a
                    href={subpart.url}
                    className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded"
                  >
                    {subpart.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
