export async function POST(req: Request) {
  void req;
  return Response.json(
    { error: "Per-audio response submission is disabled. Use /api/session/feedback for one final feedback form." },
    { status: 410 }
  );
}
