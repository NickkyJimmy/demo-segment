import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userCode = String(body.userCode ?? "");
  const assignmentId = String(body.assignmentId ?? "");

  if (!userCode || !assignmentId) {
    return Response.json({ error: "Thiếu userCode hoặc assignmentId" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      participant: true,
      playbackLock: true,
    },
  });

  if (!assignment || assignment.participant.userCode !== userCode) {
    return Response.json({ error: "Không tìm thấy phân công audio" }, { status: 404 });
  }

  if (assignment.playbackLock?.endedAt) {
    return Response.json({ error: "Audio này đã được nghe xong trước đó" }, { status: 409 });
  }

  await prisma.playbackLock.upsert({
    where: { assignmentId },
    update: {
      endedAt: new Date(),
    },
    create: {
      assignmentId,
      endedAt: new Date(),
    },
  });

  return Response.json({ ok: true });
}
