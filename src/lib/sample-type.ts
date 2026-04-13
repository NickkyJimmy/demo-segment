import { SampleType } from "@/generated/prisma/enums";

export function detectSampleTypeStrict(fileName: string): SampleType | null {
  const upper = fileName.toUpperCase();
  const normalized = upper.replace(/\.[A-Z0-9]+$/, "");

  const explicitPrefix = normalized.match(/(?:^|[^A-Z0-9])([AB])[_-]/);
  if (explicitPrefix?.[1] === "A") return SampleType.A;
  if (explicitPrefix?.[1] === "B") return SampleType.B;

  const token = normalized.match(/(?:^|[^A-Z0-9])([AB])(?:[^A-Z0-9]|$)/);
  if (token?.[1] === "A") return SampleType.A;
  if (token?.[1] === "B") return SampleType.B;

  return null;
}

export function detectSampleType(fileName: string): SampleType {
  const strict = detectSampleTypeStrict(fileName);
  if (strict) return strict;
  return SampleType.A;
}
