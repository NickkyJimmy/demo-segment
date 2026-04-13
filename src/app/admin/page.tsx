import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [voiceCount, studyCount, feedbackCount] = await Promise.all([
    prisma.voice.count(),
    prisma.study.count(),
    prisma.participantSession.count({
      where: {
        feedbackSubmittedAt: {
          not: null,
        },
      },
    }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
      <section className="animate-[fade-up_500ms_ease-out] rounded-3xl border bg-gradient-to-br from-white to-orange-50/60 p-6 shadow-sm backdrop-blur md:p-8">
        <p className="inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium tracking-[0.16em] uppercase">
          Admin Workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Research Operations Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          Oversee stimuli, create studies, generate assignments, and track incoming participant ratings from one place.
        </p>
      </section>

      <section className="animate-[fade-up_650ms_ease-out] grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Audio Groups</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">{voiceCount}</p>
        </div>
        <div className="rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Studies</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">{studyCount}</p>
        </div>
        <div className="rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Feedback Submissions</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">{feedbackCount}</p>
        </div>
      </section>

      <section className="animate-[fade-up_800ms_ease-out] flex flex-wrap gap-3">
        <Link href="/admin/voices" className={buttonVariants({ variant: "default", size: "lg" })}>
          Stimulus Management
        </Link>
        <Link href="/admin/studies" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Studies & Assignments
        </Link>
        <Link href="/admin/responses" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Responses & Exports
        </Link>
      </section>

      <section className="animate-[fade-up_900ms_ease-out] rounded-2xl border bg-card/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Recommended Workflow</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Step 1</p>
            <p className="mt-1 font-medium">Create Audio Groups</p>
            <p className="mt-1 text-sm text-muted-foreground">Add groups and upload A_/B_ files in Stimulus.</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Step 2</p>
            <p className="mt-1 font-medium">Create Study + Generate</p>
            <p className="mt-1 text-sm text-muted-foreground">Select groups, then generate assignments for participants.</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Step 3</p>
            <p className="mt-1 font-medium">Track & Export</p>
            <p className="mt-1 text-sm text-muted-foreground">Monitor submissions and export Excel from Responses.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
