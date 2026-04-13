import { SampleType } from "@/generated/prisma/enums";

export function detectSampleType(fileName: string): SampleType {
  const upper = fileName.toUpperCase();
  if (upper.startsWith("A_")) return SampleType.A;
  if (upper.startsWith("B_")) return SampleType.B;
  return SampleType.A;
}
