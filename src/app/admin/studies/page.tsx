import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { generateStudyAssignments, validateStudyAssignments } from "@/lib/study";
import { SampleType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

type SearchProps = Promise<Record<string, string | string[] | undefined>>;

async function createStudy(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const seed = String(formData.get("seed") ?? "").trim();
  const voiceIds = formData.getAll("voiceIds").map(String).filter(Boolean);

  if (!name || voiceIds.length === 0) {
    redirect("/admin/studies?error=Cần%20tên%20nghiên%20cứu%20và%20ít%20nhất%201%20nhóm%20audio");
  }

  const study = await prisma.study.create({
    data: {
      name,
      description: description || null,
      seed: seed || null,
      participantCount: 18,
      samplesPerVoice: 12,
      quotaA: 6,
      quotaB: 6,
      studyVoices: {
        create: voiceIds.map((voiceId) => ({ voiceId })),
      },
    },
  });

  revalidatePath("/admin/studies");
  redirect(`/admin/studies?ok=Đã%20tạo%20nghiên%20cứu:%20${encodeURIComponent(study.name)}`);
}

async function runGenerator(formData: FormData) {
  "use server";
  const studyId = String(formData.get("studyId") ?? "");

  let redirectTo = "/admin/studies?error=Không%20thể%20tạo%20phân%20công";
  try {
    const result = await generateStudyAssignments(studyId);
    revalidatePath("/admin/studies");
    redirectTo = `/admin/studies?ok=Đã%20tạo%20phân%20công:%20${result.assignments}%20dòng%20cho%20${result.participants}%20người`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo phân công";
    redirectTo = `/admin/studies?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

async function runValidation(formData: FormData) {
  "use server";
  const studyId = String(formData.get("studyId") ?? "");

  let redirectTo = "/admin/studies?error=Kiểm%20tra%20phân%20công%20thất%20bại";
  try {
    const result = await validateStudyAssignments(studyId);
    if (result.ok) {
      redirectTo = `/admin/studies?ok=Kiểm%20tra%20thành%20công%20(${result.assignmentCount}%20phân%20công)`;
    } else {
      redirectTo = `/admin/studies?error=${encodeURIComponent(result.issues.slice(0, 4).join(" | "))}`;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kiểm tra thất bại";
    redirectTo = `/admin/studies?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

async function createMockStudyAndGenerate() {
  "use server";

  const ensureSyntheticMockGroup = async () => {
    const mockVoice = await prisma.voice.upsert({
      where: { code: "MOCK-AUTO" },
      update: { name: "Nhóm Audio Mẫu (Tạo Tự Động)" },
      create: { code: "MOCK-AUTO", name: "Nhóm Audio Mẫu (Tạo Tự Động)" },
    });

    const existingCount = await prisma.sample.count({ where: { voiceId: mockVoice.id } });
    if (existingCount < 200) {
      const rows = [];
      for (let i = 1; i <= 100; i += 1) {
        const aName = `A_${String(i).padStart(3, "0")}.wav`;
        const bName = `B_${String(i).padStart(3, "0")}.wav`;
        rows.push({
          voiceId: mockVoice.id,
          fileName: aName,
          fileUrl: `/api/admin/mock-audio/file?name=${encodeURIComponent(aName)}`,
          sampleType: SampleType.A,
        });
        rows.push({
          voiceId: mockVoice.id,
          fileName: bName,
          fileUrl: `/api/admin/mock-audio/file?name=${encodeURIComponent(bName)}`,
          sampleType: SampleType.B,
        });
      }

      await prisma.sample.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }
  };

  let voices = await prisma.voice.findMany({
    include: {
      samples: {
        select: {
          sampleType: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const withCounts = voices.map((voice) => {
    const aCount = voice.samples.filter((s) => s.sampleType === SampleType.A).length;
    const bCount = voice.samples.filter((s) => s.sampleType === SampleType.B).length;
    return { voice, aCount, bCount, total: aCount + bCount };
  });

  const strictEligible = withCounts.find((item) => item.aCount >= 6 && item.bCount >= 6);
  const fallbackEligible = withCounts.find((item) => item.total >= 12);
  let picked = strictEligible ?? fallbackEligible;

  if (!picked) {
    await ensureSyntheticMockGroup();
    voices = await prisma.voice.findMany({
      include: {
        samples: {
          select: {
            sampleType: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const recalculated = voices.map((voice) => {
      const aCount = voice.samples.filter((s) => s.sampleType === SampleType.A).length;
      const bCount = voice.samples.filter((s) => s.sampleType === SampleType.B).length;
      return { voice, aCount, bCount, total: aCount + bCount };
    });
    picked = recalculated.find((item) => item.aCount >= 6 && item.bCount >= 6) ?? recalculated.find((item) => item.total >= 12);
  }

  if (!picked) {
    redirect("/admin/studies?error=Không%20thể%20chuẩn%20bị%20nhóm%20audio%20mẫu%20để%20kiểm%20thử");
  }

  let quotaA = 6;
  let quotaB = 6;

  if (!strictEligible) {
    quotaA = Math.min(6, picked.aCount);
    quotaB = 12 - quotaA;
    if (quotaB > picked.bCount) {
      quotaB = picked.bCount;
      quotaA = 12 - quotaB;
    }
    if (quotaA > picked.aCount) {
      quotaA = picked.aCount;
      quotaB = 12 - quotaA;
    }

    if (quotaA < 0 || quotaB < 0 || quotaA + quotaB !== 12 || quotaA > picked.aCount || quotaB > picked.bCount) {
      redirect("/admin/studies?error=Không%20thể%20suy%20ra%20quota%20hợp%20lệ%20cho%20nghiên%20cứu%20mẫu");
    }
  }

  const study = await prisma.study.create({
    data: {
      name: `Nghiên Cứu Mẫu ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      description: "Nghiên cứu kiểm thử được tạo tự động.",
      participantCount: 18,
      samplesPerVoice: 12,
      quotaA,
      quotaB,
      seed: `mock-${Date.now()}`,
      studyVoices: {
        create: [{ voiceId: picked.voice.id }],
      },
    },
  });

  await generateStudyAssignments(study.id);
  const firstParticipant = await prisma.participant.findFirst({
    where: { studyId: study.id },
    orderBy: { createdAt: "asc" },
    select: { userCode: true },
  });

  revalidatePath("/admin/studies");
  redirect(
    `/admin/studies?ok=${encodeURIComponent(
      `Đã tạo nghiên cứu mẫu (quota A/B ${quotaA}/${quotaB}) và sinh phân công thành công. Phiên đầu tiên: /session/${firstParticipant?.userCode ?? ""}`
    )}`
  );
}

export default async function StudiesPage({ searchParams }: { searchParams?: SearchProps }) {
  const query = (await searchParams) ?? {};
  const ok = typeof query.ok === "string" ? query.ok : "";
  const error = typeof query.error === "string" ? query.error : "";

  const [voices, studies] = await Promise.all([
    prisma.voice.findMany({ orderBy: { code: "asc" } }),
    prisma.study.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        participants: {
          orderBy: { createdAt: "asc" },
          take: 18,
          select: {
            userCode: true,
          },
        },
        _count: {
          select: {
            participants: true,
            assignments: true,
          },
        },
        studyVoices: {
          include: {
            voice: true,
          },
        },
      },
    }),
  ]);
  const totalParticipants = studies.reduce((sum, study) => sum + study._count.participants, 0);
  const totalAssignments = studies.reduce((sum, study) => sum + study._count.assignments, 0);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <header className="rounded-3xl border bg-gradient-to-br from-white to-sky-50/60 p-6 shadow-sm backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight">Nghiên Cứu & Phân Công</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cấu hình nghiên cứu, gắn nhóm audio và sinh phân công cân bằng cho người tham gia.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Nghiên cứu</p>
            <p className="text-lg font-semibold">{studies.length}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Người tham gia</p>
            <p className="text-lg font-semibold">{totalParticipants}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Phân công</p>
            <p className="text-lg font-semibold">{totalAssignments}</p>
          </div>
        </div>
      </header>

      {ok ? <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm">{ok}</p> : null}
      {error ? <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm">{error}</p> : null}

      <section className="rounded-2xl border bg-card/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Tạo Nghiên Cứu</h2>
        <p className="mt-1 text-sm text-muted-foreground">Chọn một hoặc nhiều nhóm audio, sau đó sinh phân công sau khi tạo.</p>
        <form action={createStudy} className="mt-4 space-y-3">
          <input name="name" placeholder="Tên nghiên cứu" className="w-full rounded-lg border bg-white px-3 py-2" required />
          <input name="description" placeholder="Mô tả (không bắt buộc)" className="w-full rounded-lg border bg-white px-3 py-2" />
          <input
            name="seed"
            placeholder="Seed (không bắt buộc, giúp sinh phân công cố định)"
            className="w-full rounded-lg border bg-white px-3 py-2"
          />

          <div className="grid gap-2 sm:grid-cols-3">
            {voices.map((voice) => (
              <label key={voice.id} className="flex items-center gap-2 rounded-xl border bg-background p-3 text-sm">
                <input type="checkbox" name="voiceIds" value={voice.id} />
                <span>
                  {voice.code} - {voice.name}
                </span>
              </label>
            ))}
          </div>

          <button className={buttonVariants({ variant: "default" })} type="submit">
            Tạo nghiên cứu
          </button>
        </form>

        <div className="mt-4 border-t pt-4">
          <p className="text-sm font-medium">Thiết lập QA nhanh</p>
          <p className="text-xs text-muted-foreground">
            Tạo một nghiên cứu mẫu từ nhóm audio đủ điều kiện đầu tiên (cần ít nhất 6 A + 6 B), sau đó sinh phân công.
          </p>
          <form action={createMockStudyAndGenerate} className="mt-3">
            <button className={buttonVariants({ variant: "outline" })} type="submit">
              Tạo nghiên cứu mẫu + Sinh phân công
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        {studies.length === 0 ? (
          <article className="rounded-2xl border border-dashed bg-card/60 p-8 text-center">
            <p className="text-lg font-semibold">Chưa có nghiên cứu nào</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Hãy tạo nghiên cứu đầu tiên ở trên, sau đó chạy sinh phân công.
            </p>
          </article>
        ) : null}
        {studies.map((study) => (
          <article key={study.id} className="rounded-2xl border bg-card/80 p-5 shadow-sm">
            <h3 className="text-xl font-semibold">{study.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{study.description ?? "Không có mô tả"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border bg-background px-2 py-1">Nhóm audio: {study.studyVoices.map((v) => v.voice.code).join(", ")}</span>
              <span className="rounded-full border bg-background px-2 py-1">Người tham gia: {study._count.participants}</span>
              <span className="rounded-full border bg-background px-2 py-1">Phân công: {study._count.assignments}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <form action={runGenerator}>
                <input type="hidden" name="studyId" value={study.id} />
                <button className={buttonVariants({ variant: "default" })} type="submit">
                  Sinh phân công
                </button>
              </form>
              <form action={runValidation}>
                <input type="hidden" name="studyId" value={study.id} />
                <button className={buttonVariants({ variant: "outline" })} type="submit">
                  Kiểm tra phân công
                </button>
              </form>
              <a
                className={buttonVariants({ variant: "secondary" })}
                href={`/api/admin/export?studyId=${study.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Xuất Excel
              </a>
            </div>

            {study.participants.length > 0 ? (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Link kiểm thử người tham gia</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {study.participants.map((participant) => (
                    <a
                      key={participant.userCode}
                      href={`/session/${participant.userCode}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
                    >
                      {participant.userCode}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
