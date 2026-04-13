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

type TypeOrder = SampleType[];

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

function buildBalancedTypeOrders(options: {
  participantIds: string[];
  total: number;
  quotaA: number;
  seed: string;
}): Map<string, TypeOrder> {
  const { participantIds, total, quotaA, seed } = options;
  const quotaB = total - quotaA;
  if (quotaA < 0 || quotaB < 0) {
    throw new Error("Quota A/B không hợp lệ.");
  }

  const totalA = participantIds.length * quotaA;
  const basePerPosition = Math.floor(totalA / total);
  const remainder = totalA % total;
  const rand = mulberry32(hashString(`${seed}:type-order`));
  const positionOrder = shuffle(
    Array.from({ length: total }, (_, idx) => idx),
    mulberry32(hashString(`${seed}:type-order:positions`))
  );

  const targetAByPosition = new Array<number>(total).fill(basePerPosition);
  for (let i = 0; i < remainder; i += 1) {
    targetAByPosition[positionOrder[i]] += 1;
  }

  const remaining = [...targetAByPosition];
  const participantOrder = shuffle(participantIds, mulberry32(hashString(`${seed}:type-order:participants`)));
  const result = new Map<string, TypeOrder>();

  for (let pIdx = 0; pIdx < participantOrder.length; pIdx += 1) {
    const participantId = participantOrder[pIdx];
    const needsA = quotaA;
    const picked = new Set<number>();

    for (let i = 0; i < needsA; i += 1) {
      const available = Array.from({ length: total }, (_, idx) => idx).filter(
        (idx) => remaining[idx] > 0 && !picked.has(idx)
      );
      if (available.length === 0) {
        throw new Error("Không thể tạo thứ tự A/B cân bằng theo vị trí cho tất cả người tham gia.");
      }

      const sorted = available.sort((left, right) => {
        if (remaining[right] !== remaining[left]) {
          return remaining[right] - remaining[left];
        }
        return rand() < 0.5 ? -1 : 1;
      });
      const chosen = sorted[0];
      picked.add(chosen);
      remaining[chosen] -= 1;
    }

    const typeOrder: TypeOrder = Array.from({ length: total }, (_, idx) =>
      picked.has(idx) ? SampleType.A : SampleType.B
    );

    result.set(participantId, typeOrder);
  }

  return result;
}

export function generateAssignments(options: {
  participantIds: string[];
  voices: VoiceSampleBucket[];
  perVoice: { total: number; a: number; b: number };
  seed: string;
}): ParticipantAssignmentPlan[] {
  const { participantIds, voices, perVoice, seed } = options;
  if (perVoice.a + perVoice.b !== perVoice.total) {
    throw new Error("Quota theo mỗi nhóm audio không hợp lệ: a + b phải bằng total.");
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
        `Nhóm audio ${voice.voiceId} không đủ mẫu A/B duy nhất theo quota mỗi người tham gia.`
      );
    }

    const poolA = buildBalancedPool(aCandidates, participantIds.length * perVoice.a, randA);
    const poolB = buildBalancedPool(bCandidates, participantIds.length * perVoice.b, randB);

    const participantOrder = shuffle(participantIds, mulberry32(hashString(`${baseSeed}:participants`)));
    const typeOrders = buildBalancedTypeOrders({
      participantIds: participantOrder,
      total: perVoice.total,
      quotaA: perVoice.a,
      seed: baseSeed,
    });

    for (const participantId of participantOrder) {
      const blocked = new Set<string>();
      const picksA = drawUniqueForParticipant(poolA, aCandidates, blocked, perVoice.a, randA);
      const picksB = drawUniqueForParticipant(poolB, bCandidates, blocked, perVoice.b, randB);

      const aQueue = shuffle(picksA, mulberry32(hashString(`${baseSeed}:${participantId}:A-order`)));
      const bQueue = shuffle(picksB, mulberry32(hashString(`${baseSeed}:${participantId}:B-order`)));
      const typeOrder = typeOrders.get(participantId);
      if (!typeOrder || typeOrder.length !== perVoice.total) {
        throw new Error(`Không tìm thấy thứ tự A/B hợp lệ cho participant ${participantId}.`);
      }

      const orderedSampleIds = typeOrder.map((type) => {
        if (type === SampleType.A) {
          const sampleId = aQueue.shift();
          if (!sampleId) {
            throw new Error(`Thiếu mẫu A khi dựng thứ tự cho participant ${participantId}.`);
          }
          return sampleId;
        }

        const sampleId = bQueue.shift();
        if (!sampleId) {
          throw new Error(`Thiếu mẫu B khi dựng thứ tự cho participant ${participantId}.`);
        }
        return sampleId;
      });

      plans.push({
        participantId,
        voiceId: voice.voiceId,
        orderedSampleIds,
        byType: { A: picksA, B: picksB },
      });
    }
  }

  return plans;
}

export function validateAssignmentPlans(
  plans: ParticipantAssignmentPlan[],
  perVoice: { total: number; a: number; b: number },
  options?: {
    voices?: VoiceSampleBucket[];
  }
): string[] {
  const errors: string[] = [];
  const voiceBuckets = new Map((options?.voices ?? []).map((voice) => [voice.voiceId, voice]));

  for (const plan of plans) {
    if (plan.orderedSampleIds.length !== perVoice.total) {
      errors.push(
        `Người tham gia ${plan.participantId} nhóm ${plan.voiceId}: mong đợi ${perVoice.total} mẫu, thực tế ${plan.orderedSampleIds.length}.`
      );
    }

    if (plan.byType.A.length !== perVoice.a || plan.byType.B.length !== perVoice.b) {
      errors.push(
        `Người tham gia ${plan.participantId} nhóm ${plan.voiceId}: lệch quota A/B (${plan.byType.A.length}/${plan.byType.B.length}).`
      );
    }

    const dedup = new Set(plan.orderedSampleIds);
    if (dedup.size !== plan.orderedSampleIds.length) {
      errors.push(`Người tham gia ${plan.participantId} nhóm ${plan.voiceId}: phát hiện mẫu trùng.`);
    }

    const sequenceA = plan.orderedSampleIds.reduce((sum, sampleId) => sum + (plan.byType.A.includes(sampleId) ? 1 : 0), 0);
    if (sequenceA !== perVoice.a) {
      errors.push(
        `Người tham gia ${plan.participantId} nhóm ${plan.voiceId}: thứ tự chứa ${sequenceA} mẫu A, mong đợi ${perVoice.a}.`
      );
    }
  }

  const plansByVoice = new Map<string, ParticipantAssignmentPlan[]>();
  for (const plan of plans) {
    const current = plansByVoice.get(plan.voiceId) ?? [];
    current.push(plan);
    plansByVoice.set(plan.voiceId, current);
  }

  plansByVoice.forEach((voicePlans, voiceId) => {
    const participantCount = voicePlans.length;
    const countByType = {
      A: new Map<string, number>(),
      B: new Map<string, number>(),
    } as const;

    const positionACounts = new Array<number>(perVoice.total).fill(0);

    for (const plan of voicePlans) {
      const setA = new Set(plan.byType.A);
      const setB = new Set(plan.byType.B);
      for (const sampleId of plan.byType.A) {
        countByType.A.set(sampleId, (countByType.A.get(sampleId) ?? 0) + 1);
      }
      for (const sampleId of plan.byType.B) {
        countByType.B.set(sampleId, (countByType.B.get(sampleId) ?? 0) + 1);
      }

      plan.orderedSampleIds.forEach((sampleId, idx) => {
        if (setA.has(sampleId)) {
          positionACounts[idx] += 1;
        } else if (!setB.has(sampleId)) {
          errors.push(`Người tham gia ${plan.participantId} nhóm ${voiceId}: sample ${sampleId} không thuộc A/B.`);
        }
      });
    }

    const expectedAByPosition = participantCount * (perVoice.a / perVoice.total);
    const minAByPosition = Math.floor(expectedAByPosition);
    const maxAByPosition = Math.ceil(expectedAByPosition);
    positionACounts.forEach((countA, idx) => {
      if (countA < minAByPosition || countA > maxAByPosition) {
        errors.push(
          `Nhóm ${voiceId} vị trí ${idx + 1}: số lần A là ${countA}, mong đợi trong khoảng ${minAByPosition}-${maxAByPosition}.`
        );
      }
    });

    const bucket = voiceBuckets.get(voiceId);
    if (!bucket) {
      return;
    }

    ([SampleType.A, SampleType.B] as const).forEach((type) => {
      const candidates = bucket.samplesByType[type];
      const expectedTotal = participantCount * (type === SampleType.A ? perVoice.a : perVoice.b);
      const base = Math.floor(expectedTotal / candidates.length);
      const ceiling = Math.ceil(expectedTotal / candidates.length);
      const typeCounts = countByType[type];

      for (const sampleId of candidates) {
        const count = typeCounts.get(sampleId) ?? 0;
        if (count < base || count > ceiling) {
          errors.push(
            `Nhóm ${voiceId} sample ${sampleId} (${type}) xuất hiện ${count} lần, mong đợi trong khoảng ${base}-${ceiling}.`
          );
        }
      }
    });
  });

  return errors;
}
