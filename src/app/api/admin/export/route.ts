import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studyId = searchParams.get("studyId");

  const feedbackRows = await prisma.participantSession.findMany({
    where: {
      feedbackSubmittedAt: {
        not: null,
      },
      participant: studyId
        ? {
            studyId,
          }
        : undefined,
    },
    include: {
      participant: {
        include: {
          study: true,
        },
      },
      voice: true,
    },
    orderBy: { feedbackSubmittedAt: "asc" },
  });

  const rawRows = feedbackRows.map((row) => ({
    study: row.participant.study.name,
    participantCode: row.participant.userCode,
    voiceCode: row.voice?.code ?? "",
    overallRating: row.overallRating,
    feedbackText: row.feedbackText ?? "",
    submittedAt: row.feedbackSubmittedAt?.toISOString() ?? "",
  }));

  const summaryMap = new Map<string, { count: number; sum: number }>();
  for (const row of feedbackRows) {
    if (row.overallRating == null) {
      continue;
    }
    const key = `${row.participant.study.name}__${row.voice?.code ?? "-"}`;
    const current = summaryMap.get(key) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += row.overallRating;
    summaryMap.set(key, current);
  }

  const summaryRows = Array.from(summaryMap.entries()).map(([key, value]) => {
    const [study, voice] = key.split("__");
    return {
      study,
      voice,
      feedbackSubmissions: value.count,
      averageOverallRating: Number((value.sum / value.count).toFixed(4)),
    };
  });

  const workbook = XLSX.utils.book_new();
  const rawSheet = XLSX.utils.json_to_sheet(rawRows);
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);

  XLSX.utils.book_append_sheet(workbook, rawSheet, "RawFeedback");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileName = studyId ? `study-${studyId}-feedback.xlsx` : "all-studies-feedback.xlsx";

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${fileName}\"`,
    },
  });
}
