import { prisma } from "@/lib/prisma";

function readScore(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    return null;
  }
  return parsed;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userCode = String(body.userCode ?? "");
  const assignmentId = String(body.assignmentId ?? "");
  const q1 = readScore(body.q1);
  const q2 = readScore(body.q2);
  const q3 = readScore(body.q3);
  const q4 = readScore(body.q4);
  const q5 = readScore(body.q5);
  const q6 = readScore(body.q6);

  if (!userCode || !assignmentId || [q1, q2, q3, q4, q5, q6].some((q) => q == null)) {
    return Response.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });
  }
  const scores = {
    q1: q1 as number,
    q2: q2 as number,
    q3: q3 as number,
    q4: q4 as number,
    q5: q5 as number,
    q6: q6 as number,
  };

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      response: true,
      playbackLock: true,
      participant: {
        include: { session: true },
      },
    },
  });

  if (!assignment || assignment.participant.userCode !== userCode) {
    return Response.json({ error: "Không tìm thấy phân công audio" }, { status: 404 });
  }

  if (!assignment.playbackLock?.endedAt) {
    return Response.json({ error: "Bạn cần nghe xong audio trước khi gửi biểu mẫu" }, { status: 400 });
  }

  if (assignment.response) {
    return Response.json({ error: "Audio này đã được đánh giá rồi" }, { status: 409 });
  }

  if (!assignment.participant.session?.voiceId || assignment.participant.session.voiceId !== assignment.voiceId) {
    return Response.json({ error: "Phiên không hợp lệ hoặc chưa chọn nhóm audio" }, { status: 400 });
  }

  if (assignment.participant.session.completedAt) {
    return Response.json({ error: "Phiên đã hoàn tất, không thể gửi thêm" }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.response.create({
      data: {
        assignmentId,
        participantId: assignment.participantId,
        voiceId: assignment.voiceId,
        sampleId: assignment.sampleId,
        q1: scores.q1,
        q2: scores.q2,
        q3: scores.q3,
        q4: scores.q4,
        q5: scores.q5,
        q6: scores.q6,
      },
    });

    const [totalAssignments, answeredCount] = await Promise.all([
      tx.assignment.count({
        where: {
          participantId: assignment.participantId,
          voiceId: assignment.voiceId,
        },
      }),
      tx.response.count({
        where: {
          participantId: assignment.participantId,
          voiceId: assignment.voiceId,
        },
      }),
    ]);

    if (answeredCount >= totalAssignments) {
      await tx.participantSession.update({
        where: { participantId: assignment.participantId },
        data: { completedAt: new Date() },
      });
      return { done: true };
    }

    return { done: false };
  });

  return Response.json({ ok: true, done: result.done });
}
