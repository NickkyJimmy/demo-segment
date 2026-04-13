import { SampleType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { generateAssignments, validateAssignmentPlans } from "@/lib/assignment/generator";

function participantCode(studyId: string, index: number) {
  return `S${studyId.slice(0, 4).toUpperCase()}-P${String(index + 1).padStart(2, "0")}`;
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
    throw new Error("Study not found.");
  }

  if (study.studyVoices.length === 0) {
    throw new Error("Study must include at least one voice.");
  }

  const participants = await ensureParticipants(study.id, study.participantCount);
  const participantIds = participants.map((p) => p.id);

  const voiceBuckets = study.studyVoices.map((sv) => ({
    voiceId: sv.voiceId,
    samplesByType: {
      A: sv.voice.samples.filter((s) => s.sampleType === SampleType.A).map((s) => s.id),
      B: sv.voice.samples.filter((s) => s.sampleType === SampleType.B).map((s) => s.id),
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
  });

  if (errors.length > 0) {
    throw new Error(`Assignment validation failed: ${errors.join(" | ")}`);
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
    throw new Error("Study not found.");
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
      issues.push(`${key} has ${bucket.total} samples; expected ${study.samplesPerVoice}.`);
    }
    if (bucket.a !== study.quotaA || bucket.b !== study.quotaB) {
      issues.push(`${key} has A/B ${bucket.a}/${bucket.b}; expected ${study.quotaA}/${study.quotaB}.`);
    }
    if (bucket.seen.size !== bucket.total) {
      issues.push(`${key} contains duplicate sample IDs.`);
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    assignmentCount: assignments.length,
  };
}
