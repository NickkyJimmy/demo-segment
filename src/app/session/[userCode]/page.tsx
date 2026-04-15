import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SessionFeedbackForm } from "@/components/session-feedback-form";

export const dynamic = "force-dynamic";

async function startSession(formData: FormData) {
  "use server";
  const userCode = String(formData.get("userCode") ?? "");
  const pickedVoiceId = String(formData.get("voiceId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!userCode) {
    redirect("/");
    return;
  }

  const participant = await prisma.participant.findUnique({
    where: { userCode },
    include: { session: true },
  });

  if (!participant) {
    redirect(`/session/${userCode}`);
    return;
  }

  if (!displayName) {
    redirect(`/session/${userCode}`);
    return;
  }

  const voiceId = participant.session?.voiceId ?? pickedVoiceId;
  if (!voiceId) {
    redirect(`/session/${userCode}`);
    return;
  }

  if (participant.session?.voiceId && participant.session.voiceId !== voiceId) {
    redirect(`/session/${userCode}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.participantSession.upsert({
      where: { participantId: participant.id },
      update: {
        voiceId: participant.session?.voiceId ?? voiceId,
      },
      create: {
        participantId: participant.id,
        voiceId,
      },
    });

    await tx.$executeRaw`UPDATE "Participant" SET "displayName" = ${displayName.slice(0, 120)} WHERE "id" = ${participant.id}`;
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

  if (!participant.displayName || !participant.session?.voiceId) {
    const lockedVoice = participant.session?.voiceId
      ? voiceOptions.find((voice) => voice.id === participant.session?.voiceId) ?? null
      : null;

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-6 px-6 py-10">
        <section className="rounded-3xl border bg-white/85 p-6 shadow-sm backdrop-blur md:p-8">
          <p className="inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium tracking-[0.16em] uppercase">
            Phiên Người tham gia
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Bắt đầu phiên nghe</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vui lòng nhập tên của bạn trước khi nghe audio. Nhóm audio chỉ được chọn một lần và sẽ bị khóa trong suốt phiên.
          </p>

          <form action={startSession} className="mt-6 space-y-5">
            <input type="hidden" name="userCode" value={participant.userCode} />
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium">
                Tên người tham gia
              </label>
              <input
                id="displayName"
                name="displayName"
                defaultValue={participant.displayName ?? ""}
                required
                maxLength={120}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ring-primary/30 transition focus:ring"
                placeholder="Nhập họ tên của bạn"
              />
            </div>

            {lockedVoice ? (
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Nhóm audio đã khóa</p>
                <p className="mt-1 text-lg font-semibold">
                  {lockedVoice.code} - {lockedVoice.name}
                </p>
                <input type="hidden" name="voiceId" value={lockedVoice.id} />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Chọn nhóm audio của bạn</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {voiceOptions.map((voice, idx) => (
                    <label key={voice.id} className="block cursor-pointer">
                      <input
                        type="radio"
                        name="voiceId"
                        value={voice.id}
                        defaultChecked={idx === 0}
                        required
                        className="peer sr-only"
                      />
                      <div className="rounded-2xl border bg-card p-4 text-left shadow-sm transition peer-checked:border-primary peer-checked:bg-primary/10 hover:-translate-y-0.5 hover:shadow">
                        <p className="text-xs tracking-wide text-muted-foreground uppercase">Nhóm audio</p>
                        <p className="mt-1 text-lg font-semibold">
                          {voice.code} - {voice.name}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Tiếp tục vào phiên nghe
            </button>
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
      response: true,
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

  if (participant.session.completedAt) {
    redirect(`/session/${participant.userCode}/done`);
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div id="session-content-overlay-root" className="pointer-events-none absolute inset-0 z-40" />
      <header className="rounded-3xl border bg-white/85 p-5 shadow-sm backdrop-blur">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Phiên</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {participant.displayName ? `${participant.displayName} (${participant.userCode})` : `Người tham gia ${participant.userCode}`}
        </h1>
      </header>

      <SessionFeedbackForm
        userCode={participant.userCode}
        assignments={assignments.map((item) => ({
          id: item.id,
          sequence: item.sequence,
          fileName: item.sample.fileName,
          audioUrl: item.sample.fileUrl,
          played: Boolean(item.playbackLock?.endedAt),
          responded: Boolean(item.response),
        }))}
      />
    </main>
  );
}
