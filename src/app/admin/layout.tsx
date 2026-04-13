import Link from "next/link";
import { ArrowRightLeftIcon, SparklesIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/nav/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <div className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              Không Gian Quản Trị
            </div>
            <div className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
              <SparklesIcon className="size-4" />
              Vận Hành Nghiên Cứu
            </div>
          </div>
          <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowRightLeftIcon className="mr-2 size-4" />
            Chuyển sang Góc nhìn Người dùng
          </Link>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
