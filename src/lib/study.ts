import { SampleType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { generateAssignments, validateAssignmentPlans } from "@/lib/assignment/generator";

function participantCode(studyId: string, index: number) {
  // Use full study id to guarantee uniqueness across different studies.
  return `S${studyId.toUpperCase()}-P${String(index + 1).padStart(2, "0")}`;
}

export async function ensureParticipants(studyId: string, count: number) {
  const existing = await prisma.participant.findMany({ where: { studyId }, orderBy: { createdAt: "asc" } });

  if (existing.length >= count) {
    return existing;
  }

  const toCreate = Array.from({ length: count - existing.length }).map((_, idx) => ({
    studyId,
    userCode: participantCode(studyId, existing.length + idx),
  }));

  if (toCreate.length > 0) {
    await prisma.participant.createMany({ data: toCreate });
  }

  return prisma.participant.findMany({ where: { studyId }, orderBy: { createdAt: "asc" } });
}

function extractPairKeyFromFileName(fileName: string): string | null {
  const normalized = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  const upper = normalized.toUpperCase();
  const idxA = upper.lastIndexOf("A_");
  const idxB = upper.lastIndexOf("B_");
  const idx = Math.max(idxA, idxB);
  if (idx < 0) return null;

  const raw = normalized.slice(idx + 2);
  const dot = raw.lastIndexOf(".");
  const key = (dot >= 0 ? raw.slice(0, dot) : raw).trim();
  return key ? key.toLowerCase() : null;
}

export async function generateStudyAssignments(studyId: string) {
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    include: {
      studyVoices: {
        include: {
          voice: {
            include: {
              samples: true,
            },
          },
        },
      },
    },
  });

  if (!study) {
    throw new Error("Không tìm thấy nghiên cứu.");
  }

  if (study.studyVoices.length === 0) {
    throw new Error("Nghiên cứu phải có ít nhất một nhóm audio.");
  }

  const participants = await ensureParticipants(study.id, study.participantCount);
  const participantIds = participants.map((p) => p.id);

  const voiceBuckets = study.studyVoices.map((sv) => ({
    voiceId: sv.voiceId,
    samplesByType: {
      A: sv.voice.samples
        .filter((s) => s.sampleType === SampleType.A)
        .map((s) => ({ id: s.id, pairKey: extractPairKeyFromFileName(s.fileName) })),
      B: sv.voice.samples
        .filter((s) => s.sampleType === SampleType.B)
        .map((s) => ({ id: s.id, pairKey: extractPairKeyFromFileName(s.fileName) })),
    },
  }));

  const plans = generateAssignments({
    participantIds,
    voices: voiceBuckets,
    perVoice: { total: study.samplesPerVoice, a: study.quotaA, b: study.quotaB },
    seed: study.seed ?? study.id,
  });

  const errors = validateAssignmentPlans(plans, {
    total: study.samplesPerVoice,
    a: study.quotaA,
    b: study.quotaB,
  }, {
    voices: voiceBuckets,
  });

  if (errors.length > 0) {
    throw new Error(`Kiểm tra phân công thất bại: ${errors.join(" | ")}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.assignment.deleteMany({ where: { studyId } });

    await tx.assignment.createMany({
      data: plans.flatMap((plan) =>
        plan.orderedSampleIds.map((sampleId, idx) => ({
          studyId,
          participantId: plan.participantId,
          voiceId: plan.voiceId,
          sampleId,
          sequence: idx + 1,
        }))
      ),
    });
  });

  return {
    studyId,
    participants: participants.length,
    voices: study.studyVoices.length,
    assignments: plans.length * study.samplesPerVoice,
  };
}

export async function validateStudyAssignments(studyId: string) {
  const study = await prisma.study.findUnique({ where: { id: studyId } });
  if (!study) {
    throw new Error("Không tìm thấy nghiên cứu.");
  }

  const assignments = await prisma.assignment.findMany({
    where: { studyId },
    include: {
      sample: { select: { sampleType: true } },
    },
  });

  const grouped = new Map<string, { total: number; a: number; b: number; seen: Set<string> }>();

  for (const assignment of assignments) {
    const key = `${assignment.participantId}:${assignment.voiceId}`;
    if (!grouped.has(key)) {
      grouped.set(key, { total: 0, a: 0, b: 0, seen: new Set() });
    }

    const bucket = grouped.get(key)!;
    bucket.total += 1;
    if (assignment.sample.sampleType === SampleType.A) bucket.a += 1;
    if (assignment.sample.sampleType === SampleType.B) bucket.b += 1;
    bucket.seen.add(assignment.sampleId);
  }

  const issues: string[] = [];

  grouped.forEach((bucket, key) => {
    if (bucket.total !== study.samplesPerVoice) {
      issues.push(`${key} có ${bucket.total} mẫu; mong đợi ${study.samplesPerVoice}.`);
    }
    if (bucket.a !== study.quotaA || bucket.b !== study.quotaB) {
      issues.push(`${key} có tỷ lệ A/B là ${bucket.a}/${bucket.b}; mong đợi ${study.quotaA}/${study.quotaB}.`);
    }
    if (bucket.seen.size !== bucket.total) {
      issues.push(`${key} chứa sample ID bị trùng.`);
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    assignmentCount: assignments.length,
  };
}
