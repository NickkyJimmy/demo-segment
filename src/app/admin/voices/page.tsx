import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SampleType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type SearchProps = Promise<Record<string, string | string[] | undefined>>;

async function createVoice(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!name || !code) {
    redirect("/admin/voices?error=Tên%20nhóm%20audio%20và%20mã%20là%20bắt%20buộc");
  }

  try {
    await prisma.voice.create({ data: { name, code } });
    revalidatePath("/admin/voices");
    redirect("/admin/voices?ok=Đã%20tạo%20nhóm%20audio");
  } catch {
    redirect("/admin/voices?error=Không%20thể%20tạo%20nhóm%20audio%20(có%20thể%20trùng%20mã)");
  }
}

async function updateSampleType(formData: FormData) {
  "use server";
  const sampleId = String(formData.get("sampleId") ?? "");
  const sampleType = String(formData.get("sampleType") ?? "") as SampleType;

  if (!sampleId || !(sampleType in SampleType)) {
    redirect("/admin/voices?error=Dữ%20liệu%20cập%20nhật%20mẫu%20không%20hợp%20lệ");
  }

  await prisma.sample.update({
    where: { id: sampleId },
    data: { sampleType },
  });

  revalidatePath("/admin/voices");
  redirect("/admin/voices?ok=Đã%20cập%20nhật%20loại%20mẫu");
}

async function deleteVoice(formData: FormData) {
  "use server";
  const voiceId = String(formData.get("voiceId") ?? "");

  if (!voiceId) {
    redirect("/admin/voices?error=Yêu%20cầu%20xóa%20nhóm%20audio%20không%20hợp%20lệ");
  }

  const usage = await prisma.voice.findUnique({
    where: { id: voiceId },
    select: {
      _count: {
        select: {
          assignments: true,
          responses: true,
          sessions: true,
          studyVoices: true,
        },
      },
    },
  });

  if (!usage) {
    redirect("/admin/voices?error=Không%20tìm%20thấy%20nhóm%20audio");
  }

  if (
    usage._count.assignments > 0 ||
    usage._count.responses > 0 ||
    usage._count.sessions > 0 ||
    usage._count.studyVoices > 0
  ) {
    redirect(
      "/admin/voices?error=Không%20thể%20xóa%20nhóm%20audio%20vì%20đã%20được%20dùng%20trong%20nghiên%20cứu%20hoặc%20phiên"
    );
  }

  await prisma.voice.delete({ where: { id: voiceId } });
  revalidatePath("/admin/voices");
  redirect("/admin/voices?ok=Đã%20xóa%20nhóm%20audio");
}

async function relabelVoiceSamplesFromFilename(formData: FormData) {
  "use server";
  const voiceId = String(formData.get("voiceId") ?? "");

  if (!voiceId) {
    redirect("/admin/voices?error=Yêu%20cầu%20gán%20nhãn%20nhóm%20audio%20không%20hợp%20lệ");
  }

  const samples = await prisma.sample.findMany({
    where: { voiceId },
    select: { id: true, fileName: true },
  });

  if (samples.length === 0) {
    redirect("/admin/voices?error=Không%20có%20mẫu%20nào%20trong%20nhóm%20audio%20này");
  }

  const updates = samples
    .map((sample) => {
      const upper = sample.fileName.toUpperCase();
      let sampleType: SampleType | null = null;

      if (upper.includes("B_")) sampleType = SampleType.B;
      else if (upper.includes("A_")) sampleType = SampleType.A;

      if (!sampleType) return null;
      return prisma.sample.update({
        where: { id: sample.id },
        data: { sampleType },
      });
    })
    .filter((item): item is ReturnType<typeof prisma.sample.update> => Boolean(item));

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  revalidatePath("/admin/voices");
  redirect(`/admin/voices?ok=Đã%20gán%20lại%20${updates.length}%20mẫu%20theo%20tên%20file`);
}

export default async function VoicesPage({ searchParams }: { searchParams?: SearchProps }) {
  const query = (await searchParams) ?? {};
  const ok = typeof query.ok === "string" ? query.ok : "";
  const error = typeof query.error === "string" ? query.error : "";

  const voices = await prisma.voice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      samples: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      _count: {
        select: {
          samples: true,
        },
      },
    },
  });
  const totalSamples = voices.reduce((sum, voice) => sum + voice._count.samples, 0);
  const voiceWithABReady = voices.filter((voice) => {
    const aCount = voice.samples.filter((s) => s.sampleType === SampleType.A).length;
    const bCount = voice.samples.filter((s) => s.sampleType === SampleType.B).length;
    return aCount >= 6 && bCount >= 6;
  }).length;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <header className="rounded-3xl border bg-gradient-to-br from-white to-amber-50/60 p-6 shadow-sm backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight">Quản Lý Audio</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tạo nhóm audio, tải lên hàng loạt và quản lý nhãn mẫu A/B một cách chính xác.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Nhóm Audio</p>
            <p className="text-lg font-semibold">{voices.length}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Tổng số file Audio</p>
            <p className="text-lg font-semibold">{totalSamples}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Đủ điều kiện (6A/6B)</p>
            <p className="text-lg font-semibold">{voiceWithABReady}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/api/admin/mock-audio"
            className={buttonVariants({ variant: "outline", size: "sm" })}
            target="_blank"
            rel="noreferrer"
          >
            Tải bộ Audio mẫu (200 file)
          </a>
        </div>
      </header>

      {ok ? <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm">{ok}</p> : null}
      {error ? <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm">{error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border bg-card/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Tạo Nhóm Audio</h2>
          <form action={createVoice} className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              name="name"
              placeholder="Tên nhóm audio"
              className="rounded-lg border bg-white px-3 py-2 text-sm"
              required
            />
            <input
              name="code"
              placeholder="Mã (ví dụ: V1)"
              className="rounded-lg border bg-white px-3 py-2 text-sm"
              required
            />
            <button className={buttonVariants({ variant: "default" })} type="submit">
              Tạo
            </button>
          </form>
        </article>

        <article className="rounded-2xl border bg-card/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Tải Lên Hàng Loạt</h2>
          <form
            action="/api/admin/samples/upload"
            method="post"
            encType="multipart/form-data"
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="bucket" value="test" />
            <select name="voiceId" className="rounded-lg border bg-white px-3 py-2 text-sm" required>
              <option value="">Chọn nhóm audio</option>
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.code} - {voice.name}
                </option>
              ))}
            </select>
            <input
              type="file"
              name="files"
              accept="audio/*"
              multiple
              className="rounded-lg border bg-white px-3 py-2 text-sm sm:col-span-2"
              required
            />
            <button className={buttonVariants({ variant: "default" })} type="submit">
              Tải file lên
            </button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Loại mẫu được tự nhận diện theo tiền tố tên file: `A_` và `B_`.
          </p>
        </article>
      </section>

      <section className="space-y-4">
        {voices.length === 0 ? (
          <article className="rounded-2xl border border-dashed bg-card/60 p-8 text-center">
            <p className="text-lg font-semibold">Chưa có nhóm audio</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Hãy tạo nhóm audio đầu tiên, sau đó tải các file có tiền tố `A_` và `B_` để tiếp tục.
            </p>
          </article>
        ) : null}
        {voices.map((voice) => {
          const aCount = voice.samples.filter((s) => s.sampleType === SampleType.A).length;
          const bCount = voice.samples.filter((s) => s.sampleType === SampleType.B).length;
          return (
            <article key={voice.id} className="overflow-hidden rounded-2xl border bg-card/90 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-5 py-4">
                <h3 className="text-lg font-semibold">
                  {voice.code} - {voice.name}
                </h3>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Tổng: {voice._count.samples} · A: {aCount} · B: {bCount}
                  </p>
                  <form action={relabelVoiceSamplesFromFilename}>
                    <input type="hidden" name="voiceId" value={voice.id} />
                    <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
                      Tự sửa A/B
                    </button>
                  </form>
                  <form action={deleteVoice}>
                    <input type="hidden" name="voiceId" value={voice.id} />
                    <button className={buttonVariants({ variant: "destructive", size: "sm" })} type="submit">
                      Xóa
                    </button>
                  </form>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/30 text-xs tracking-wide uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Tệp</th>
                      <th className="px-4 py-3">Loại</th>
                      <th className="px-4 py-3">Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voice.samples.map((sample) => (
                      <tr key={sample.id} className="border-t">
                        <td className="px-4 py-3 font-mono text-xs md:text-sm">{sample.fileName}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border bg-background px-2 py-1 text-xs font-medium">
                            {sample.sampleType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <form action={updateSampleType} className="flex items-center gap-2">
                            <input type="hidden" name="sampleId" value={sample.id} />
                            <select
                              name="sampleType"
                              defaultValue={sample.sampleType}
                              className="rounded-md border bg-white px-2 py-1"
                            >
                              <option value="A">A</option>
                              <option value="B">B</option>
                            </select>
                            <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
                              Lưu
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
