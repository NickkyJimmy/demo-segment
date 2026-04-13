import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SessionFeedbackForm } from "@/components/session-feedback-form";

export const dynamic = "force-dynamic";

async function selectVoice(formData: FormData) {
  "use server";
  const userCode = String(formData.get("userCode") ?? "");
  const voiceId = String(formData.get("voiceId") ?? "");

  const participant = await prisma.participant.findUnique({
    where: { userCode },
    include: { session: true },
  });

  if (!participant) {
    redirect(`/session/${userCode}`);
  }

  if (participant.session?.voiceId && participant.session.voiceId !== voiceId) {
    redirect(`/session/${userCode}`);
  }

  await prisma.participantSession.upsert({
    where: { participantId: participant.id },
    update: {
      voiceId: participant.session?.voiceId ?? voiceId,
    },
    create: {
      participantId: participant.id,
      voiceId,
    },
  });

  redirect(`/session/${userCode}`);
}

export default async function SessionPage({ params }: { params: Promise<{ userCode: string }> }) {
  const { userCode } = await params;

  const participant = await prisma.participant.findUnique({
    where: { userCode },
    include: {
      study: {
        include: {
          studyVoices: {
            include: {
              voice: true,
            },
          },
        },
      },
      session: true,
    },
  });

  if (!participant) {
    notFound();
  }

  const voiceOptions = participant.study.studyVoices.map((sv) => sv.voice);
  if (voiceOptions.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p>Nghiên cứu này chưa được cấu hình nhóm audio.</p>
      </main>
    );
  }

  if (!participant.session?.voiceId) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-6 px-6 py-10">
        <section className="rounded-3xl border bg-white/85 p-6 shadow-sm backdrop-blur md:p-8">
          <p className="inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium tracking-[0.16em] uppercase">
            Phiên Người tham gia
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Chọn nhóm audio của bạn</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lựa chọn này sẽ bị khóa trong suốt phiên làm bài.
          </p>

          <form action={selectVoice} className="mt-6 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="userCode" value={participant.userCode} />
            {voiceOptions.map((voice) => (
              <button
                key={voice.id}
                name="voiceId"
                value={voice.id}
                className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                type="submit"
              >
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Nhóm audio</p>
                <p className="mt-1 text-lg font-semibold">
                  {voice.code} - {voice.name}
                </p>
              </button>
            ))}
          </form>
        </section>
      </main>
    );
  }

  const selectedVoiceId = participant.session.voiceId;

  const assignments = await prisma.assignment.findMany({
    where: {
      participantId: participant.id,
      voiceId: selectedVoiceId,
    },
    orderBy: { sequence: "asc" },
    include: {
      sample: true,
      playbackLock: true,
    },
  });

  const total = assignments.length;

  if (total === 0) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p>Chưa có phân công audio cho người tham gia này.</p>
      </main>
    );
  }

  if (participant.session.feedbackSubmittedAt) {
    redirect(`/session/${participant.userCode}/done`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="rounded-3xl border bg-white/85 p-5 shadow-sm backdrop-blur">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Phiên</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Người tham gia {participant.userCode}</h1>
      </header>

      <SessionFeedbackForm
        userCode={participant.userCode}
        assignments={assignments.map((item) => ({
          id: item.id,
          sequence: item.sequence,
          fileName: item.sample.fileName,
          audioUrl: item.sample.fileUrl,
          played: Boolean(item.playbackLock?.endedAt),
        }))}
        initialOverallRating={participant.session.overallRating ?? null}
        feedbackSubmitted={Boolean(participant.session.feedbackSubmittedAt)}
      />
    </main>
  );
}
