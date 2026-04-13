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
    redirect("/admin/voices?error=Audio%20group%20name%20and%20code%20are%20required");
  }

  try {
    await prisma.voice.create({ data: { name, code } });
    revalidatePath("/admin/voices");
    redirect("/admin/voices?ok=Audio%20group%20created");
  } catch {
    redirect("/admin/voices?error=Failed%20to%20create%20audio%20group%20(duplicate%20code%20maybe)");
  }
}

async function updateSampleType(formData: FormData) {
  "use server";
  const sampleId = String(formData.get("sampleId") ?? "");
  const sampleType = String(formData.get("sampleType") ?? "") as SampleType;

  if (!sampleId || !(sampleType in SampleType)) {
    redirect("/admin/voices?error=Invalid%20sample%20update");
  }

  await prisma.sample.update({
    where: { id: sampleId },
    data: { sampleType },
  });

  revalidatePath("/admin/voices");
  redirect("/admin/voices?ok=Sample%20type%20updated");
}

async function deleteVoice(formData: FormData) {
  "use server";
  const voiceId = String(formData.get("voiceId") ?? "");

  if (!voiceId) {
    redirect("/admin/voices?error=Invalid%20audio%20group%20delete%20request");
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
    redirect("/admin/voices?error=Audio%20group%20not%20found");
  }

  if (
    usage._count.assignments > 0 ||
    usage._count.responses > 0 ||
    usage._count.sessions > 0 ||
    usage._count.studyVoices > 0
  ) {
    redirect(
      "/admin/voices?error=Cannot%20delete%20audio%20group%20that%20is%20already%20used%20in%20studies%20or%20sessions"
    );
  }

  await prisma.voice.delete({ where: { id: voiceId } });
  revalidatePath("/admin/voices");
  redirect("/admin/voices?ok=Audio%20group%20deleted");
}

async function relabelVoiceSamplesFromFilename(formData: FormData) {
  "use server";
  const voiceId = String(formData.get("voiceId") ?? "");

  if (!voiceId) {
    redirect("/admin/voices?error=Invalid%20audio%20group%20relabel%20request");
  }

  const samples = await prisma.sample.findMany({
    where: { voiceId },
    select: { id: true, fileName: true },
  });

  if (samples.length === 0) {
    redirect("/admin/voices?error=No%20samples%20found%20for%20this%20audio%20group");
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
  redirect(`/admin/voices?ok=${updates.length}%20samples%20re-labeled%20from%20filename`);
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
        <h1 className="text-3xl font-semibold tracking-tight">Stimulus Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create audio groups, upload batches, and curate A/B sample labels with confidence.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Audio Groups</p>
            <p className="text-lg font-semibold">{voices.length}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Total Audio Files</p>
            <p className="text-lg font-semibold">{totalSamples}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Eligible (6A/6B)</p>
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
            Download Mock Audio Pack (200)
          </a>
        </div>
      </header>

      {ok ? <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm">{ok}</p> : null}
      {error ? <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm">{error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border bg-card/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Create Audio Group</h2>
          <form action={createVoice} className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              name="name"
              placeholder="Audio Group Name"
              className="rounded-lg border bg-white px-3 py-2 text-sm"
              required
            />
            <input
              name="code"
              placeholder="Code (e.g. V1)"
              className="rounded-lg border bg-white px-3 py-2 text-sm"
              required
            />
            <button className={buttonVariants({ variant: "default" })} type="submit">
              Create
            </button>
          </form>
        </article>

        <article className="rounded-2xl border bg-card/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Batch Upload</h2>
          <form
            action="/api/admin/samples/upload"
            method="post"
            encType="multipart/form-data"
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="bucket" value="test" />
            <select name="voiceId" className="rounded-lg border bg-white px-3 py-2 text-sm" required>
              <option value="">Select Audio Group</option>
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
              Upload Files
            </button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Types are auto-detected from filename prefixes: `A_` and `B_`.
          </p>
        </article>
      </section>

      <section className="space-y-4">
        {voices.length === 0 ? (
          <article className="rounded-2xl border border-dashed bg-card/60 p-8 text-center">
            <p className="text-lg font-semibold">No audio groups yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first audio group, then upload files with `A_` and `B_` prefixes to continue.
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
                    Total: {voice._count.samples} · A: {aCount} · B: {bCount}
                  </p>
                  <form action={relabelVoiceSamplesFromFilename}>
                    <input type="hidden" name="voiceId" value={voice.id} />
                    <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
                      Auto-fix A/B
                    </button>
                  </form>
                  <form action={deleteVoice}>
                    <input type="hidden" name="voiceId" value={voice.id} />
                    <button className={buttonVariants({ variant: "destructive", size: "sm" })} type="submit">
                      Delete
                    </button>
                  </form>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/30 text-xs tracking-wide uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">File</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Update</th>
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
                              Save
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
