import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SampleType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
  import { buttonVariants } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectSampleTypeStrict } from "@/lib/sample-type";

export const dynamic = "force-dynamic";

type SearchProps = Promise<Record<string, string | string[] | undefined>>;

function voicesRedirectUrl(type: "ok" | "error", message: string) {
  return `/admin/voices?${type}=${encodeURIComponent(message)}`;
}

async function createVoice(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!name || !code) {
    redirect(voicesRedirectUrl("error", "Tên nhóm audio và mã là bắt buộc"));
  }

  try {
    const voice = await prisma.voice.create({ data: { name, code } });

    const bucket = "test";
    const prefix = code;
    const admin = createAdminClient();
    const { data: listed, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`Không thể đọc bucket ${bucket}/${prefix}: ${error.message}`);
    }

    const files = (listed ?? []).filter((item) => Boolean(item.id) && item.name !== ".emptyFolderPlaceholder");
    let rows = files
      .map((item) => {
        const sampleType = detectSampleTypeStrict(item.name);
        if (!sampleType) return null;
        const storagePath = `${prefix}/${item.name}`;
        const { data } = admin.storage.from(bucket).getPublicUrl(storagePath);
        return {
          voiceId: voice.id,
          fileName: item.name,
          fileUrl: data.publicUrl,
          sampleType,
        };
      })
      .filter(
        (
          row
        ): row is { voiceId: string; fileName: string; fileUrl: string; sampleType: SampleType } => Boolean(row)
      );

    // Fallback: if test/<CODE> is empty, try test/A + test/B folder layout.
    if (rows.length === 0) {
      const [aList, bList] = await Promise.all([
        admin.storage.from(bucket).list("A", {
          limit: 1000,
          offset: 0,
          sortBy: { column: "name", order: "asc" },
        }),
        admin.storage.from(bucket).list("B", {
          limit: 1000,
          offset: 0,
          sortBy: { column: "name", order: "asc" },
        }),
      ]);

      if (aList.error) throw new Error(`Không thể đọc bucket ${bucket}/A: ${aList.error.message}`);
      if (bList.error) throw new Error(`Không thể đọc bucket ${bucket}/B: ${bList.error.message}`);

      const mapFolderRows = (folder: "A" | "B", list: { id?: string | null; name: string }[]) =>
        list
          .filter((item) => Boolean(item.id) && item.name !== ".emptyFolderPlaceholder")
          .map((item) => {
            const storagePath = `${folder}/${item.name}`;
            const { data } = admin.storage.from(bucket).getPublicUrl(storagePath);
            return {
              voiceId: voice.id,
              fileName: `${folder}_${item.name}`,
              fileUrl: data.publicUrl,
              sampleType: folder as SampleType,
            };
          });

      rows = [...mapFolderRows("A", aList.data ?? []), ...mapFolderRows("B", bList.data ?? [])];
    }

    if (rows.length > 0) {
      await prisma.sample.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }

    revalidatePath("/admin/voices");
    redirect(
      voicesRedirectUrl(
        "ok",
        `Đã tạo nhóm audio. Đã đồng bộ ${rows.length} file từ bucket test (ưu tiên test/${prefix}, fallback test/A + test/B).`
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo nhóm audio (có thể trùng mã)";
    redirect(voicesRedirectUrl("error", message));
  }
}

async function updateSampleType(formData: FormData) {
  "use server";
  const sampleId = String(formData.get("sampleId") ?? "");
  const sampleType = String(formData.get("sampleType") ?? "") as SampleType;

  if (!sampleId || !(sampleType in SampleType)) {
    redirect(voicesRedirectUrl("error", "Dữ liệu cập nhật mẫu không hợp lệ"));
  }

  try {
    await prisma.sample.update({
      where: { id: sampleId },
      data: { sampleType },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể cập nhật loại mẫu";
    redirect(voicesRedirectUrl("error", message));
  }

  revalidatePath("/admin/voices");
  redirect(voicesRedirectUrl("ok", "Đã cập nhật loại mẫu"));
}

async function deleteVoice(formData: FormData) {
  "use server";
  const voiceId = String(formData.get("voiceId") ?? "");

  if (!voiceId) {
    redirect(voicesRedirectUrl("error", "Yêu cầu xóa nhóm audio không hợp lệ"));
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
    redirect(voicesRedirectUrl("error", "Không tìm thấy nhóm audio"));
  }

  if (
    usage._count.assignments > 0 ||
    usage._count.responses > 0 ||
    usage._count.sessions > 0 ||
    usage._count.studyVoices > 0
  ) {
    redirect(voicesRedirectUrl("error", "Không thể xóa nhóm audio vì đã được dùng trong nghiên cứu hoặc phiên"));
  }

  try {
    await prisma.voice.delete({ where: { id: voiceId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể xóa nhóm audio";
    redirect(voicesRedirectUrl("error", message));
  }

  revalidatePath("/admin/voices");
  redirect(voicesRedirectUrl("ok", "Đã xóa nhóm audio"));
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
      },
      _count: {
        select: {
          samples: true,
        },
      },
    },
  });
  const totalSamples = voices.reduce((sum, voice) => sum + voice._count.samples, 0);

  const groupedTypeCounts = await prisma.sample.groupBy({
    by: ["voiceId", "sampleType"],
    _count: { _all: true },
  });

  const countByVoice = new Map<string, { a: number; b: number }>();
  for (const row of groupedTypeCounts) {
    const current = countByVoice.get(row.voiceId) ?? { a: 0, b: 0 };
    if (row.sampleType === SampleType.A) current.a = row._count._all;
    if (row.sampleType === SampleType.B) current.b = row._count._all;
    countByVoice.set(row.voiceId, current);
  }

  const voiceWithABReady = voices.filter((voice) => {
    const counts = countByVoice.get(voice.id) ?? { a: 0, b: 0 };
    return counts.a >= 3 && counts.b >= 3;
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
            <p className="text-xs text-muted-foreground">Đủ điều kiện (3A/3B)</p>
            <p className="text-lg font-semibold">{voiceWithABReady}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
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
          <p className="mt-2 text-xs text-muted-foreground">
            Sau khi tạo, hệ thống tự đồng bộ file từ Supabase bucket `test/&lt;MÃ_NHÓM&gt;` (ví dụ `test/V1`).
          </p>
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
          const counts = countByVoice.get(voice.id) ?? { a: 0, b: 0 };
          const aCount = counts.a;
          const bCount = counts.b;
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
