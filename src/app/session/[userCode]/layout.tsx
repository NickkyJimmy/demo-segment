import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SessionSidebar } from "@/components/nav/session-sidebar";
import { prisma } from "@/lib/prisma";

export default async function SessionUserLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ userCode: string }>;
}) {
  const { userCode } = await params;
  const participant = await prisma.participant.findUnique({
    where: { userCode },
    include: { session: true },
  });
  const canAccessCompletion = Boolean(participant?.session?.completedAt);

  return (
    <SidebarProvider>
      <SessionSidebar userCode={userCode} canAccessCompletion={canAccessCompletion} />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center border-b bg-background/80 px-4 backdrop-blur">
          <div className="flex items-center">
            <SidebarTrigger />
            <p className="ml-2 text-sm font-medium text-muted-foreground">Phiên Người tham gia</p>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
