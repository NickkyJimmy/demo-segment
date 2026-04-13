import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectSampleType } from "@/lib/sample-type";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export async function POST(req: Request) {
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);

  const formData = await req.formData();
  const voiceId = String(formData.get("voiceId") ?? "").trim();
  const bucket = String(formData.get("bucket") ?? "test").trim() || "test";
  const files = formData
    .getAll("files")
    .map((entry) => entry as File)
    .filter((entry) => entry && entry.size > 0);

  if (!voiceId || files.length === 0) {
    return redirectTo("/admin/voices?error=Thiếu%20nhóm%20audio%20hoặc%20tệp%20tải%20lên");
  }

  try {
    const voice = await prisma.voice.findUnique({ where: { id: voiceId } });
    if (!voice) {
      return redirectTo("/admin/voices?error=Không%20tìm%20thấy%20nhóm%20audio");
    }

    const admin = createAdminClient();
    let uploaded = 0;

    for (const file of files) {
      const originalName = sanitizeFileName(file.name);
      const storagePath = `${voice.code}/${Date.now()}-${Math.random().toString(36).slice(2)}-${originalName}`;
      const bytes = await file.arrayBuffer();

      const { error: uploadError } = await admin.storage.from(bucket).upload(storagePath, bytes, {
        contentType: file.type || "audio/mpeg",
        upsert: false,
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data } = admin.storage.from(bucket).getPublicUrl(storagePath);

      await prisma.sample.create({
        data: {
          voiceId,
          fileName: `${Date.now()}-${originalName}`,
          fileUrl: data.publicUrl,
          sampleType: detectSampleType(originalName),
        },
      });

      uploaded += 1;
    }

    return redirectTo(`/admin/voices?ok=Đã%20tải%20lên%20${uploaded}%20tệp`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tải lên thất bại";
    return redirectTo(`/admin/voices?error=${encodeURIComponent(message)}`);
  }
}
