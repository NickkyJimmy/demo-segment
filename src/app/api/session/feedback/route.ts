export async function POST(req: Request) {
  void req;
  return Response.json(
    { error: "Endpoint này đã ngừng dùng. Vui lòng gửi biểu mẫu SA theo từng audio qua /api/session/response." },
    { status: 410 }
  );
}
