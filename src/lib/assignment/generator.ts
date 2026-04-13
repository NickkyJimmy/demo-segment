import { SampleType } from "@/generated/prisma/enums";

export type VoiceSampleBucket = {
  voiceId: string;
  samplesByType: Record<SampleType, string[]>;
};

export type ParticipantAssignmentPlan = {
  participantId: string;
  voiceId: string;
  orderedSampleIds: string[];
  byType: Record<SampleType, string[]>;
};

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildBalancedPool(sampleIds: string[], totalSlots: number, rand: () => number): string[] {
  if (sampleIds.length === 0) {
    return [];
  }

  const shuffledBase = shuffle(sampleIds, rand);
  const base = Math.floor(totalSlots / sampleIds.length);
  const remainder = totalSlots % sampleIds.length;
  const pool: string[] = [];

  shuffledBase.forEach((sampleId, idx) => {
    const repeat = base + (idx < remainder ? 1 : 0);
    for (let i = 0; i < repeat; i += 1) {
      pool.push(sampleId);
    }
  });

  return shuffle(pool, rand);
}

function drawUniqueForParticipant(
  pool: string[],
  allCandidates: string[],
  blocked: Set<string>,
  quota: number,
  rand: () => number
): string[] {
  const picks: string[] = [];

  while (picks.length < quota) {
    const idx = pool.findIndex((sampleId) => !blocked.has(sampleId));
    if (idx === -1) {
      const fallback = shuffle(allCandidates, rand).find((sampleId) => !blocked.has(sampleId));
      if (!fallback) {
        throw new Error("Not enough unique samples to satisfy no-duplicate participant assignment.");
      }
      picks.push(fallback);
      blocked.add(fallback);
      continue;
    }

    const picked = pool[idx];
    pool.splice(idx, 1);
    picks.push(picked);
    blocked.add(picked);
  }

  return picks;
}

export function generateAssignments(options: {
  participantIds: string[];
  voices: VoiceSampleBucket[];
  perVoice: { total: number; a: number; b: number };
  seed: string;
}): ParticipantAssignmentPlan[] {
  const { participantIds, voices, perVoice, seed } = options;
  if (perVoice.a + perVoice.b !== perVoice.total) {
    throw new Error("Invalid per-voice quotas: a + b must equal total.");
  }

  const plans: ParticipantAssignmentPlan[] = [];

  for (const voice of voices) {
    const baseSeed = `${seed}:${voice.voiceId}`;
    const randA = mulberry32(hashString(`${baseSeed}:A`));
    const randB = mulberry32(hashString(`${baseSeed}:B`));

    const aCandidates = voice.samplesByType.A;
    const bCandidates = voice.samplesByType.B;

    if (aCandidates.length < perVoice.a || bCandidates.length < perVoice.b) {
      throw new Error(
        `Voice ${voice.voiceId} does not have enough unique A/B samples for per-participant quotas.`
      );
    }

    const poolA = buildBalancedPool(aCandidates, participantIds.length * perVoice.a, randA);
    const poolB = buildBalancedPool(bCandidates, participantIds.length * perVoice.b, randB);

    const participantOrder = shuffle(participantIds, mulberry32(hashString(`${baseSeed}:participants`)));

    for (const participantId of participantOrder) {
      const blocked = new Set<string>();
      const picksA = drawUniqueForParticipant(poolA, aCandidates, blocked, perVoice.a, randA);
      const picksB = drawUniqueForParticipant(poolB, bCandidates, blocked, perVoice.b, randB);

      const mixed = shuffle(
        [...picksA.map((id) => ({ id, type: SampleType.A })), ...picksB.map((id) => ({ id, type: SampleType.B }))],
        mulberry32(hashString(`${baseSeed}:${participantId}:mix`))
      );

      plans.push({
        participantId,
        voiceId: voice.voiceId,
        orderedSampleIds: mixed.map((item) => item.id),
        byType: { A: picksA, B: picksB },
      });
    }
  }

  return plans;
}

export function validateAssignmentPlans(
  plans: ParticipantAssignmentPlan[],
  perVoice: { total: number; a: number; b: number }
): string[] {
  const errors: string[] = [];

  for (const plan of plans) {
    if (plan.orderedSampleIds.length !== perVoice.total) {
      errors.push(
        `Participant ${plan.participantId} voice ${plan.voiceId}: expected ${perVoice.total} samples, got ${plan.orderedSampleIds.length}.`
      );
    }

    if (plan.byType.A.length !== perVoice.a || plan.byType.B.length !== perVoice.b) {
      errors.push(
        `Participant ${plan.participantId} voice ${plan.voiceId}: A/B quota mismatch (${plan.byType.A.length}/${plan.byType.B.length}).`
      );
    }

    const dedup = new Set(plan.orderedSampleIds);
    if (dedup.size !== plan.orderedSampleIds.length) {
      errors.push(`Participant ${plan.participantId} voice ${plan.voiceId}: duplicate sample detected.`);
    }
  }

  return errors;
}
