"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPortal } from "react-dom";

type AssignmentItem = {
  id: string;
  sequence: number;
  fileName: string;
  audioUrl: string;
  played: boolean;
  responded: boolean;
};

type SessionFeedbackFormProps = {
  userCode: string;
  assignments: AssignmentItem[];
};

type Question = {
  id: "q1" | "q2" | "q3" | "q4" | "q5" | "q6";
  text: string;
  options: Array<{ value: number; label: string }>;
};

const questions: Question[] = [
  {
    id: "q1",
    text: "Anh/chị đánh giá mức độ tự nhiên của giọng nói này như thế nào?",
    options: [
      { value: 1, label: "Rất không tự nhiên" },
      { value: 2, label: "Không tự nhiên" },
      { value: 3, label: "Bình thường" },
      { value: 4, label: "Tự nhiên" },
      { value: 5, label: "Rất tự nhiên, gần như người thật" },
    ],
  },
  {
    id: "q2",
    text: "Anh/chị có cảm thấy giọng nói có lên xuống, nhấn nhá đúng ngữ cảnh và không đều đều như robot không?",
    options: [
      { value: 1, label: "Hoàn toàn đơn điệu" },
      { value: 2, label: "Hơi đơn điệu" },
      { value: 3, label: "Bình thường" },
      { value: 4, label: "Có nhấn nhá tốt" },
      { value: 5, label: "Nhấn nhá rất tốt, hoàn toàn đúng ngữ cảnh" },
    ],
  },
  {
    id: "q3",
    text: "Khi yêu cầu giọng vui vẻ, khẩn cấp, trung tính..., giọng có thể hiện đúng cảm xúc không?",
    options: [
      { value: 1, label: "Hoàn toàn không thể hiện được cảm xúc theo yêu cầu" },
      { value: 2, label: "Không thể hiện được cảm xúc theo yêu cầu" },
      { value: 3, label: "Bình thường" },
      { value: 4, label: "Thể hiện được cảm xúc theo yêu cầu" },
      { value: 5, label: "Hoàn toàn thể hiện được cảm xúc theo yêu cầu" },
    ],
  },
  {
    id: "q4",
    text: "Trong đoạn âm thanh bạn vừa nghe, giọng có phát âm sai hoặc bỏ sót từ nào không?",
    options: [
      { value: 1, label: "Sai rất nhiều từ, gần như không hiểu được nội dung" },
      { value: 2, label: "Sai nhiều từ, phải đoán mới hiểu được ý" },
      { value: 3, label: "Sai một vài từ lẻ, nội dung vẫn hiểu được" },
      { value: 4, label: "Chỉ sai một từ duy nhất, không ảnh hưởng đến hiểu nội dung" },
      { value: 5, label: "Không sai bất kỳ từ nào, nghe hoàn toàn chính xác" },
    ],
  },
  {
    id: "q5",
    text: "Giọng có phát âm đúng các tên riêng, tên thương hiệu và thuật ngữ chuyên ngành trong đoạn audio không?",
    options: [
      { value: 1, label: "Hầu hết tên riêng và thuật ngữ đều bị phát âm sai, gây khó hiểu" },
      { value: 2, label: "Khoảng một nửa số tên riêng và thuật ngữ bị phát âm sai" },
      { value: 3, label: "Chỉ một vài tên riêng hoặc thuật ngữ bị sai, vẫn hiểu được" },
      { value: 4, label: "Không sai nhưng một số từ phát âm chưa tự nhiên, hơi vấp tai" },
      { value: 5, label: "Toàn bộ tên riêng và thuật ngữ phát âm chuẩn xác và tự nhiên" },
    ],
  },
  {
    id: "q6",
    text: "Trong môi trường có tiếng ồn nền, giọng nói có nghe rõ và nổi bật không?",
    options: [
      { value: 1, label: "Không nghe được nội dung, giọng bị tiếng ồn lấn át hoàn toàn" },
      { value: 2, label: "Nghe được một phần nhưng mất nhiều từ do tiếng ồn" },
      { value: 3, label: "Nghe đủ nội dung nhưng phải tập trung mới theo kịp" },
      { value: 4, label: "Nghe rõ, tiếng ồn hầu như không ảnh hưởng đến việc hiểu" },
      { value: 5, label: "Giọng hoàn toàn nổi bật, nghe dễ dàng dù có tiếng ồn nền" },
    ],
  },
];

function findPendingResponseAssignment(assignments: AssignmentItem[], playedSet: Set<string>, respondedSet: Set<string>) {
  return assignments.find((item) => (item.played || playedSet.has(item.id)) && !(item.responded || respondedSet.has(item.id)));
}

export function SessionFeedbackForm({ userCode, assignments }: SessionFeedbackFormProps) {
  const router = useRouter();
  const [busyPlayId, setBusyPlayId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [playedSet, setPlayedSet] = useState<Set<string>>(new Set());
  const [respondedSet, setRespondedSet] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<Question["id"], number>>({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0 });

  const pendingItem = useMemo(
    () => findPendingResponseAssignment(assignments, playedSet, respondedSet),
    [assignments, playedSet, respondedSet]
  );

  const playedCount = useMemo(
    () => assignments.filter((item) => item.played || playedSet.has(item.id)).length,
    [assignments, playedSet]
  );
  const respondedCount = useMemo(
    () => assignments.filter((item) => item.responded || respondedSet.has(item.id)).length,
    [assignments, respondedSet]
  );

  const canSubmit = pendingItem && questions.every((question) => answers[question.id] >= 1 && answers[question.id] <= 5);
  const answeredQuestionsCount = useMemo(
    () => questions.filter((question) => answers[question.id] >= 1 && answers[question.id] <= 5).length,
    [answers]
  );
  const overlayRoot =
    typeof document !== "undefined" ? document.getElementById("session-content-overlay-root") : null;

  async function playOnce(assignmentId: string, audioUrl: string, alreadyPlayed: boolean, alreadyResponded: boolean) {
    if (alreadyPlayed || alreadyResponded || busyPlayId || pendingItem) return;
    setBusyPlayId(assignmentId);

    const audio = new Audio(audioUrl);
    audio.onended = async () => {
      const response = await fetch("/api/session/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode, assignmentId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        toast.error(payload.error ?? "Không lưu được trạng thái phát audio.");
        setBusyPlayId(null);
        return;
      }

      setPlayedSet((prev) => new Set(prev).add(assignmentId));
      setAnswers({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0 });
      toast.success("Đã nghe xong. Vui lòng trả lời biểu mẫu ngay bây giờ.");
      setBusyPlayId(null);
    };

    audio.onerror = () => {
      setBusyPlayId(null);
      toast.error("Không thể phát audio này.");
    };

    try {
      await audio.play();
    } catch {
      setBusyPlayId(null);
      toast.error("Trình duyệt chặn phát audio. Hãy bấm lại để cho phép.");
    }
  }

  async function submitPerAudioFeedback() {
    if (!pendingItem || !canSubmit || submitting) return;
    setSubmitting(true);

    const res = await fetch("/api/session/response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userCode,
        assignmentId: pendingItem.id,
        ...answers,
      }),
    });

    if (!res.ok) {
      setSubmitting(false);
      const msg = await res.json().catch(() => ({}));
      toast.error(msg.error ?? "Không gửi được biểu mẫu đánh giá.");
      return;
    }

    const payload = await res.json().catch(() => ({}));
    setRespondedSet((prev) => new Set(prev).add(pendingItem.id));
    setAnswers({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0 });
    setSubmitting(false);

    toast.success("Đã gửi biểu mẫu cho audio này.");
    if (payload.done) {
      router.push(`/session/${userCode}/done`);
      return;
    }

    router.refresh();
  }

  return (
    <section className="relative min-h-[calc(100dvh-9rem)] rounded-3xl border bg-card/90 p-6 shadow-sm backdrop-blur md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Nghe audio và trả lời biểu mẫu SA theo từng mẫu</h2>
        <p className="rounded-full border bg-background px-3 py-1 text-xs font-medium">
          Đã gửi {respondedCount}/{assignments.length}
        </p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Mỗi audio chỉ phát 1 lần. Sau khi nghe xong, bạn phải gửi biểu mẫu SA trước khi nghe audio tiếp theo.
      </p>

      <div className="mt-5 space-y-3">
        {assignments.map((item) => {
          const played = item.played || playedSet.has(item.id);
          const responded = item.responded || respondedSet.has(item.id);
          const disabled = played || responded || busyPlayId !== null || Boolean(pendingItem);

          return (
            <article key={item.id} className="rounded-2xl border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  #{item.sequence} {item.fileName}
                </p>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => playOnce(item.id, item.audioUrl, played, responded)}
                >
                  {responded ? "Đã gửi biểu mẫu" : played ? "Đã nghe xong" : busyPlayId === item.id ? "Đang phát..." : "Nghe 1 lần"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {pendingItem && overlayRoot
        ? createPortal(
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-end justify-center bg-black/72 p-2 backdrop-blur-[3px] sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl">
            <div className="sticky top-0 z-10 border-b bg-gradient-to-b from-card to-card/95 px-4 py-3 backdrop-blur md:px-6 md:py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold md:text-lg">Biểu mẫu SA cho audio #{pendingItem.sequence}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vui lòng trả lời đầy đủ 6 câu hỏi để tiếp tục.
                  </p>
                </div>
                <div className="rounded-full border bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Đã trả lời {answeredQuestionsCount}/6
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${(answeredQuestionsCount / questions.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="overflow-auto px-4 py-4 md:px-6 md:py-5">
              <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question.id} className="rounded-2xl border bg-background/80 p-4 md:p-5">
                  <p className="text-sm font-semibold text-primary">
                    Câu {index + 1}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{question.text}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {question.options.map((option) => (
                      <label
                        key={`${question.id}-${option.value}`}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                          answers[question.id] === option.value
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "hover:border-primary/40 hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option.value}
                          checked={answers[question.id] === option.value}
                          onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: option.value }))}
                          className="mt-1"
                        />
                        <span className="text-sm leading-snug">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </div>

            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur md:px-6 md:py-4">
              <p className="text-xs text-muted-foreground">Tiến độ nghe: {playedCount}/{assignments.length}</p>
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={submitPerAudioFeedback}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
              >
                {submitting ? "Đang gửi..." : "Gửi biểu mẫu"}
              </button>
            </div>
          </div>
        </div>,
          overlayRoot
        )
        : null}
    </section>
  );
}
