import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-8 px-6 py-16">
      <div className="animate-[fade-up_500ms_ease-out] space-y-4">
        <p className="inline-flex rounded-full border bg-white/70 px-3 py-1 text-xs font-medium tracking-[0.18em] uppercase backdrop-blur">
          Research Ops Suite
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Professional listening-study platform for admin teams and participants.
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
          Manage audio groups, generate balanced assignments, enforce single-play sessions, and export analytics-ready
          Excel reports.
        </p>
      </div>

      <div className="animate-[fade-up_700ms_ease-out] flex flex-wrap gap-3">
        <Link href="/admin" className={buttonVariants({ variant: "default", size: "lg" })}>
          Open Admin Portal
        </Link>
      </div>
    </main>
  );
}
