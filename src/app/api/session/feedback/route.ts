import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userCode = String(body.userCode ?? "");
  const overallRating = Number(body.overallRating ?? NaN);

  if (!userCode || !Number.isFinite(overallRating) || overallRating < 1 || overallRating > 5) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const participant = await prisma.participant.findUnique({
    where: { userCode },
    include: {
      session: true,
    },
  });

  if (!participant || !participant.session?.voiceId) {
    return Response.json({ error: "Participant session not found" }, { status: 404 });
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      participantId: participant.id,
      voiceId: participant.session.voiceId,
    },
    include: {
      playbackLock: true,
    },
  });

  if (assignments.length === 0) {
    return Response.json({ error: "No assignments found" }, { status: 400 });
  }

  const allPlayed = assignments.every((assignment) => Boolean(assignment.playbackLock?.endedAt));
  if (!allPlayed) {
    return Response.json({ error: "All audio must be listened before submitting feedback" }, { status: 400 });
  }

  if (participant.session.feedbackSubmittedAt) {
    return Response.json({ error: "Feedback already submitted" }, { status: 409 });
  }

  await prisma.participantSession.update({
    where: { participantId: participant.id },
    data: {
      overallRating,
      feedbackText: null,
      feedbackSubmittedAt: new Date(),
      completedAt: new Date(),
    },
  });

  return Response.json({ ok: true });
}
