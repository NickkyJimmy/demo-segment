import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { generateStudyAssignments, validateStudyAssignments } from "@/lib/study";
import { SampleType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

type SearchProps = Promise<Record<string, string | string[] | undefined>>;

function studiesRedirectUrl(type: "ok" | "error", message: string) {
  return `/admin/studies?${type}=${encodeURIComponent(message)}`;
}

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
      samplesPerVoice: 6,
      quotaA: 3,
      quotaB: 3,
      studyVoices: {
        create: voiceIds.map((voiceId) => ({ voiceId })),
      },
    },
  });

  revalidatePath("/admin/studies");
  redirect(studiesRedirectUrl("ok", `Đã tạo nghiên cứu: ${study.name}`));
}

async function runGenerator(formData: FormData) {
  "use server";
  const studyId = String(formData.get("studyId") ?? "");

  let redirectTo = "/admin/studies?error=Không%20thể%20tạo%20phân%20công";
  try {
    const result = await generateStudyAssignments(studyId);
    revalidatePath("/admin/studies");
    redirectTo = studiesRedirectUrl(
      "ok",
      `Đã tạo phân công: ${result.assignments} dòng cho ${result.participants} người`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo phân công";
    redirectTo = studiesRedirectUrl("error", message);
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
      redirectTo = studiesRedirectUrl("ok", `Kiểm tra thành công (${result.assignmentCount} phân công)`);
    } else {
      redirectTo = studiesRedirectUrl("error", result.issues.slice(0, 4).join(" | "));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kiểm tra thất bại";
    redirectTo = studiesRedirectUrl("error", message);
  }

  redirect(redirectTo);
}

async function deleteStudy(formData: FormData) {
  "use server";
  const studyId = String(formData.get("studyId") ?? "");
  if (!studyId) {
    redirect(studiesRedirectUrl("error", "Thiếu mã nghiên cứu để xóa"));
  }

  try {
    const existing = await prisma.study.findUnique({
      where: { id: studyId },
      select: { name: true },
    });
    if (!existing) {
      redirect(studiesRedirectUrl("error", "Không tìm thấy nghiên cứu"));
    }

    await prisma.study.delete({
      where: { id: studyId },
    });

    revalidatePath("/admin/studies");
    redirect(studiesRedirectUrl("ok", `Đã xóa nghiên cứu: ${existing.name}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xóa nghiên cứu thất bại";
    redirect(studiesRedirectUrl("error", message));
  }
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
            session: {
              select: {
                completedAt: true,
              },
            },
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
              <form action={deleteStudy}>
                <input type="hidden" name="studyId" value={study.id} />
                <button className={buttonVariants({ variant: "destructive" })} type="submit">
                  Xóa nghiên cứu
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
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        participant.session?.completedAt
                          ? "border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                          : "bg-background hover:bg-muted"
                      }`}
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
