import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function SessionDonePage({ params }: { params: Promise<{ userCode: string }> }) {
  const { userCode } = await params;
  const participant = await prisma.participant.findUnique({
    where: { userCode },
    include: { session: true },
  });

  if (!participant?.session?.completedAt) {
    redirect(`/session/${userCode}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-16">
      <section className="w-full rounded-3xl border bg-white/85 p-8 text-center shadow-sm backdrop-blur md:p-12">
        <p className="inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium tracking-[0.16em] uppercase">
          Hoàn tất
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Cảm ơn bạn</h1>
        <p className="mt-3 text-muted-foreground">
          Bạn đã nghe xong toàn bộ audio được giao và gửi đánh giá thành công.
        </p>
      </section>
    </main>
  );
}
