import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userCode = String(body.userCode ?? "");
  const assignmentId = String(body.assignmentId ?? "");

  if (!userCode || !assignmentId) {
    return Response.json({ error: "Missing userCode or assignmentId" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      participant: true,
      playbackLock: true,
    },
  });

  if (!assignment || assignment.participant.userCode !== userCode) {
    return Response.json({ error: "Assignment not found" }, { status: 404 });
  }

  if (assignment.playbackLock?.endedAt) {
    return Response.json({ error: "Playback already completed for this audio" }, { status: 409 });
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
