import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studyId = searchParams.get("studyId");

  const feedbackRows = await prisma.response.findMany({
    where: studyId
      ? {
          participant: {
            studyId,
          },
        }
      : undefined,
    include: {
      participant: {
        include: {
          study: true,
        },
      },
      voice: true,
      assignment: {
        include: {
          sample: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rawRows = feedbackRows.map((row) => ({
    study: row.participant.study.name,
    participantCode: row.participant.userCode,
    participantName: row.participant.displayName ?? "",
    voiceCode: row.voice.code,
    sequence: row.assignment.sequence,
    fileName: row.assignment.sample.fileName,
    q1: row.q1,
    q2: row.q2,
    q3: row.q3,
    q4: row.q4,
    q5: row.q5,
    q6: row.q6,
    averageScore: Number(((row.q1 + row.q2 + row.q3 + row.q4 + row.q5 + row.q6) / 6).toFixed(4)),
    submittedAt: row.createdAt.toISOString(),
  }));

  const summaryMap = new Map<
    string,
    { count: number; sumQ1: number; sumQ2: number; sumQ3: number; sumQ4: number; sumQ5: number; sumQ6: number; sumAvg: number }
  >();
  for (const row of feedbackRows) {
    const key = `${row.participant.study.name}__${row.voice.code}`;
    const current = summaryMap.get(key) ?? {
      count: 0,
      sumQ1: 0,
      sumQ2: 0,
      sumQ3: 0,
      sumQ4: 0,
      sumQ5: 0,
      sumQ6: 0,
      sumAvg: 0,
    };
    current.count += 1;
    current.sumQ1 += row.q1;
    current.sumQ2 += row.q2;
    current.sumQ3 += row.q3;
    current.sumQ4 += row.q4;
    current.sumQ5 += row.q5;
    current.sumQ6 += row.q6;
    current.sumAvg += (row.q1 + row.q2 + row.q3 + row.q4 + row.q5 + row.q6) / 6;
    summaryMap.set(key, current);
  }

  const summaryRows = Array.from(summaryMap.entries()).map(([key, value]) => {
    const [study, voice] = key.split("__");
    return {
      study,
      voice,
      submissions: value.count,
      avgQ1: Number((value.sumQ1 / value.count).toFixed(4)),
      avgQ2: Number((value.sumQ2 / value.count).toFixed(4)),
      avgQ3: Number((value.sumQ3 / value.count).toFixed(4)),
      avgQ4: Number((value.sumQ4 / value.count).toFixed(4)),
      avgQ5: Number((value.sumQ5 / value.count).toFixed(4)),
      avgQ6: Number((value.sumQ6 / value.count).toFixed(4)),
      avgOverall: Number((value.sumAvg / value.count).toFixed(4)),
    };
  });

  const workbook = XLSX.utils.book_new();
  const rawSheet = XLSX.utils.json_to_sheet(rawRows);
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);

  XLSX.utils.book_append_sheet(workbook, rawSheet, "RawPerAudio");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "SummaryByVoice");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileName = studyId ? `study-${studyId}-per-audio-feedback.xlsx` : "all-studies-per-audio-feedback.xlsx";

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${fileName}\"`,
    },
  });
}
