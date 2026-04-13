import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ResponsesPage() {
  const studies = await prisma.study.findMany({ orderBy: { createdAt: "desc" } });
  const feedbackRows = await prisma.participantSession.findMany({
    where: {
      feedbackSubmittedAt: {
        not: null,
      },
    },
    orderBy: { feedbackSubmittedAt: "desc" },
    include: {
      participant: {
        include: {
          study: true,
        },
      },
      voice: true,
    },
    take: 500,
  });

  const summaryByVoice = new Map<string, { count: number; sum: number }>();
  for (const row of feedbackRows) {
    if (!row.voiceId || row.overallRating == null || !row.voice) {
      continue;
    }
    const key = row.voice.code;
    const current = summaryByVoice.get(key) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += row.overallRating;
    summaryByVoice.set(key, current);
  }
  const totalFeedback = feedbackRows.length;
  const ratedRows = feedbackRows.filter((row) => row.overallRating != null);
  const avgOverall =
    ratedRows.length > 0
      ? (ratedRows.reduce((sum, row) => sum + (row.overallRating ?? 0), 0) / ratedRows.length).toFixed(2)
      : "0.00";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <header className="rounded-3xl border bg-gradient-to-br from-white to-emerald-50/60 p-6 shadow-sm backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight">Responses & Reporting</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Inspect participant-level feedback, monitor per-group trends, and export workbooks for analysis.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Feedback Submitted</p>
            <p className="text-lg font-semibold">{totalFeedback}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Rated Sessions</p>
            <p className="text-lg font-semibold">{ratedRows.length}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Global Avg Rating</p>
            <p className="text-lg font-semibold">{avgOverall}</p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border bg-card/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Export</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            href="/api/admin/export"
            target="_blank"
            rel="noreferrer"
          >
            Export All Studies
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
        <h2 className="text-lg font-semibold">Summary (latest 500 rows)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(summaryByVoice.entries()).map(([voice, data]) => (
            <div key={voice} className="rounded-xl border bg-background p-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Audio Group</p>
              <p className="mt-1 text-lg font-semibold">{voice}</p>
              <p className="mt-2 text-sm text-muted-foreground">Responses: {data.count}</p>
              <p className="text-sm text-muted-foreground">Avg overall rating: {(data.sum / data.count).toFixed(2)}</p>
            </div>
          ))}
        </div>
        {summaryByVoice.size === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No feedback yet. Ask participants to complete sessions.</p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card/80 shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Raw Feedback</h2>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs tracking-wide uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Study</th>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Audio Group</th>
                <th className="px-4 py-3">Overall Rating</th>
                <th className="px-4 py-3">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {feedbackRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{row.feedbackSubmittedAt?.toISOString() ?? "-"}</td>
                  <td className="px-4 py-3">{row.participant.study.name}</td>
                  <td className="px-4 py-3">{row.participant.userCode}</td>
                  <td className="px-4 py-3">{row.voice?.code ?? "-"}</td>
                  <td className="px-4 py-3 font-semibold">{row.overallRating ?? "-"}</td>
                  <td className="px-4 py-3">{row.feedbackText || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link href="/admin" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
        Back to Admin Home
      </Link>
    </main>
  );
}
