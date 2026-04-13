import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-8 px-6 py-16">
      <div className="animate-[fade-up_500ms_ease-out] space-y-4">
        <p className="inline-flex rounded-full border bg-white/70 px-3 py-1 text-xs font-medium tracking-[0.18em] uppercase backdrop-blur">
          Bộ Công Cụ Nghiên Cứu
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Nền tảng nghiên cứu nghe chuyên nghiệp cho đội ngũ quản trị và người tham gia.
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
          Quản lý nhóm audio, tạo phân công cân bằng, giới hạn nghe 1 lần và xuất báo cáo Excel sẵn sàng phân tích.
        </p>
      </div>

      <div className="animate-[fade-up_700ms_ease-out] flex flex-wrap gap-3">
        <Link href="/admin" className={buttonVariants({ variant: "default", size: "lg" })}>
          Mở Cổng Quản Trị
        </Link>
      </div>
    </main>
  );
}
