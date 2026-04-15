import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function averageRow(row: { q1: number; q2: number; q3: number; q4: number; q5: number; q6: number }) {
  return (row.q1 + row.q2 + row.q3 + row.q4 + row.q5 + row.q6) / 6;
}

export default async function ResponsesPage() {
  const studies = await prisma.study.findMany({ orderBy: { createdAt: "desc" } });
  const rows = await prisma.response.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      participant: {
        include: {
          study: true,
        },
      },
      voice: true,
      assignment: {
        include: {
          sample: true,
        },
      },
    },
    take: 1000,
  });

  const summaryByVoice = new Map<string, { count: number; sum: number }>();
  for (const row of rows) {
    const key = row.voice.code;
    const current = summaryByVoice.get(key) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += averageRow(row);
    summaryByVoice.set(key, current);
  }

  const avgOverall = rows.length > 0 ? (rows.reduce((sum, row) => sum + averageRow(row), 0) / rows.length).toFixed(2) : "0.00";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <header className="rounded-3xl border bg-gradient-to-br from-white to-emerald-50/60 p-6 shadow-sm backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight">Phản Hồi & Báo Cáo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mỗi dòng là một biểu mẫu SA theo từng audio của từng người tham gia.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Tổng biểu mẫu theo audio</p>
            <p className="text-lg font-semibold">{rows.length}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Số nhóm audio có dữ liệu</p>
            <p className="text-lg font-semibold">{summaryByVoice.size}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Điểm SA trung bình</p>
            <p className="text-lg font-semibold">{avgOverall}</p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border bg-card/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Xuất dữ liệu</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            href="/api/admin/export"
            target="_blank"
            rel="noreferrer"
          >
            Xuất tất cả nghiên cứu
          </a>
          {studies.map((study) => (
            <a
              key={study.id}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              href={`/api/admin/export?studyId=${study.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {study.name}
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Tổng quan theo nhóm audio</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(summaryByVoice.entries()).map(([voice, data]) => (
            <div key={voice} className="rounded-xl border bg-background p-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Nhóm audio</p>
              <p className="mt-1 text-lg font-semibold">{voice}</p>
              <p className="mt-2 text-sm text-muted-foreground">Số biểu mẫu: {data.count}</p>
              <p className="text-sm text-muted-foreground">Điểm SA TB: {(data.sum / data.count).toFixed(2)}</p>
            </div>
          ))}
        </div>
        {summaryByVoice.size === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Chưa có phản hồi. Hãy yêu cầu người tham gia hoàn tất phiên.</p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card/80 shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Dữ liệu thô (1000 dòng mới nhất)</h2>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs tracking-wide uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Nghiên cứu</th>
                <th className="px-4 py-3">Người tham gia</th>
                <th className="px-4 py-3">Tên người tham gia</th>
                <th className="px-4 py-3">Nhóm audio</th>
                <th className="px-4 py-3">Audio</th>
                <th className="px-4 py-3">Q1</th>
                <th className="px-4 py-3">Q2</th>
                <th className="px-4 py-3">Q3</th>
                <th className="px-4 py-3">Q4</th>
                <th className="px-4 py-3">Q5</th>
                <th className="px-4 py-3">Q6</th>
                <th className="px-4 py-3">TB</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{row.createdAt.toISOString()}</td>
                  <td className="px-4 py-3">{row.participant.study.name}</td>
                  <td className="px-4 py-3">{row.participant.userCode}</td>
                  <td className="px-4 py-3">{row.participant.displayName ?? "-"}</td>
                  <td className="px-4 py-3">{row.voice.code}</td>
                  <td className="px-4 py-3">#{row.assignment.sequence} - {row.assignment.sample.fileName}</td>
                  <td className="px-4 py-3 font-medium">{row.q1}</td>
                  <td className="px-4 py-3 font-medium">{row.q2}</td>
                  <td className="px-4 py-3 font-medium">{row.q3}</td>
                  <td className="px-4 py-3 font-medium">{row.q4}</td>
                  <td className="px-4 py-3 font-medium">{row.q5}</td>
                  <td className="px-4 py-3 font-medium">{row.q6}</td>
                  <td className="px-4 py-3 font-semibold">{averageRow(row).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link href="/admin" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
        Quay lại trang quản trị
      </Link>
    </main>
  );
}
