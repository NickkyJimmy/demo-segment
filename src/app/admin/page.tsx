import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [voiceCount, studyCount, feedbackCount] = await Promise.all([
    prisma.voice.count(),
    prisma.study.count(),
    prisma.response.count(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
      <section className="animate-[fade-up_500ms_ease-out] rounded-3xl border bg-gradient-to-br from-white to-orange-50/60 p-6 shadow-sm backdrop-blur md:p-8">
        <p className="inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium tracking-[0.16em] uppercase">
          Admin Portal
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Hệ thống đánh giá chất lượng giọng nói</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          Quản lý nhóm audio, tạo nghiên cứu, sinh phân công và theo dõi đánh giá từ người tham gia tại một nơi.
        </p>
      </section>

      <section className="animate-[fade-up_650ms_ease-out] grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Nhóm Audio</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">{voiceCount}</p>
        </div>
        <div className="rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Nghiên Cứu</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">{studyCount}</p>
        </div>
        <div className="rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Lượt Gửi Đánh Giá</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">{feedbackCount}</p>
        </div>
      </section>

      <section className="animate-[fade-up_800ms_ease-out] flex flex-wrap gap-3">
        <Link href="/admin/voices" className={buttonVariants({ variant: "default", size: "lg" })}>
          Quản Lý Audio
        </Link>
        <Link href="/admin/studies" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Nghiên Cứu & Phân Công
        </Link>
        <Link href="/admin/responses" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Phản Hồi & Xuất File
        </Link>
      </section>

      <section className="animate-[fade-up_900ms_ease-out] rounded-2xl border bg-card/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Quy Trình Khuyến Nghị</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Bước 1</p>
            <p className="mt-1 font-medium">Tạo Nhóm Audio</p>
            <p className="mt-1 text-sm text-muted-foreground">Tạo nhóm và tải file A_/B_ trong mục Quản Lý Audio.</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Bước 2</p>
            <p className="mt-1 font-medium">Tạo Nghiên Cứu + Sinh Dữ Liệu</p>
            <p className="mt-1 text-sm text-muted-foreground">Chọn nhóm audio, sau đó sinh phân công cho người tham gia.</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Bước 3</p>
            <p className="mt-1 font-medium">Theo Dõi & Xuất File</p>
            <p className="mt-1 text-sm text-muted-foreground">Theo dõi phản hồi và xuất Excel ở mục Phản Hồi.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
