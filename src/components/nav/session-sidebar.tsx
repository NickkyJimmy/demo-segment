"use client";

import { CheckCircle2Icon, HeadphonesIcon, LayoutDashboardIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export function SessionSidebar({ userCode, canAccessCompletion }: { userCode: string; canAccessCompletion: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  const sessionRoot = `/session/${userCode}`;
  const donePath = `/session/${userCode}/done`;

  const items = [
    { title: "Current Session", href: sessionRoot, icon: HeadphonesIcon },
    { title: "Completion", href: donePath, icon: CheckCircle2Icon },
  ];

  return (
    <Sidebar variant="floating" collapsible="icon" className="bg-sidebar/95">
      <SidebarHeader>
        <div className="rounded-xl border bg-sidebar-accent/40 px-3 py-2">
          <p className="text-xs tracking-[0.16em] uppercase text-sidebar-foreground/70">Participant POV</p>
          <p className="text-sm font-semibold">Session {userCode}</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Session</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  {item.href === donePath && !canAccessCompletion ? (
                    <SidebarMenuButton disabled tooltip="Submit rating form first">
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      onClick={() => router.push(item.href)}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => router.push("/")} tooltip="Home">
              <LayoutDashboardIcon />
              <span>Back to Home</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
