"use client";

import { BarChart3Icon, FolderCogIcon, HomeIcon, Mic2Icon } from "lucide-react";
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

const items = [
  { title: "Dashboard", href: "/admin", icon: HomeIcon },
  { title: "Stimulus", href: "/admin/voices", icon: Mic2Icon },
  { title: "Studies", href: "/admin/studies", icon: FolderCogIcon },
  { title: "Responses", href: "/admin/responses", icon: BarChart3Icon },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Sidebar variant="inset" className="bg-sidebar/95">
      <SidebarHeader>
        <div className="rounded-xl border bg-sidebar-accent/50 px-3 py-2">
          <p className="text-xs tracking-[0.16em] uppercase text-sidebar-foreground/70">Admin POV</p>
          <p className="text-sm font-semibold">Research Operations</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    onClick={() => router.push(item.href)}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <div className="space-y-2 px-2">
          <p className="text-xs text-sidebar-foreground/70">Admin tools for setup, execution, and reporting.</p>
          <p className="text-[11px] text-sidebar-foreground/60">Tip: Use “Studies” to generate participant session links fast.</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
