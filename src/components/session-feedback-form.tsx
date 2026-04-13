"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type AssignmentItem = {
  id: string;
  sequence: number;
  fileName: string;
  audioUrl: string;
  played: boolean;
};

type SessionFeedbackFormProps = {
  userCode: string;
  assignments: AssignmentItem[];
  initialOverallRating: number | null;
  feedbackSubmitted: boolean;
};

const ratingLabels: Record<number, string> = {
  1: "Rất không tự nhiên / không hợp nghĩa",
  2: "Không tự nhiên",
  3: "Bình thường",
  4: "Tự nhiên",
  5: "Rất tự nhiên / rất hợp nghĩa",
};

export function SessionFeedbackForm({
  userCode,
  assignments,
  initialOverallRating,
  feedbackSubmitted,
}: SessionFeedbackFormProps) {
  const router = useRouter();
  const [busyPlayId, setBusyPlayId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [overallRating, setOverallRating] = useState<number>(initialOverallRating ?? 0);

  const playedCount = useMemo(() => assignments.filter((item) => item.played).length, [assignments]);
  const allPlayed = assignments.length > 0 && playedCount === assignments.length;
  const showDialog = allPlayed && !feedbackSubmitted;
  const canSubmit = showDialog && overallRating >= 1;

  async function playOnce(assignmentId: string, audioUrl: string, alreadyPlayed: boolean) {
    if (alreadyPlayed || busyPlayId || feedbackSubmitted) return;
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

      toast.success("Đã nghe xong audio này.");
      setBusyPlayId(null);
      router.refresh();
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

  async function submitFeedback() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    const res = await fetch("/api/session/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userCode, overallRating }),
    });

    if (!res.ok) {
      setSubmitting(false);
      const msg = await res.json().catch(() => ({}));
      toast.error(msg.error ?? "Không gửi được biểu mẫu đánh giá.");
      return;
    }

    router.refresh();
  }

  return (
    <section className="relative rounded-3xl border bg-card/90 p-6 shadow-sm backdrop-blur md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Nghe hết audio, rồi đánh giá 1 lần</h2>
        <p className="rounded-full border bg-background px-3 py-1 text-xs font-medium">
          Đã nghe {playedCount}/{assignments.length}
        </p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Mỗi audio chỉ phát 1 lần. Form đánh giá sẽ hiện sau khi nghe hết.</p>

      <div className="mt-5 space-y-3">
        {assignments.map((item) => {
          const locked = item.played;
          return (
            <article key={item.id} className="rounded-2xl border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  #{item.sequence} {item.fileName}
                </p>
                <button
                  type="button"
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  disabled={locked || busyPlayId !== null || feedbackSubmitted}
                  onClick={() => playOnce(item.id, item.audioUrl, item.played)}
                >
                  {item.played ? "Đã nghe" : busyPlayId === item.id ? "Đang phát..." : "Nghe 1 lần"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {showDialog ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border bg-card p-5 shadow-xl md:p-6">
            <h3 className="text-lg font-semibold">Bạn đánh giá mức độ tự nhiên và hợp nghĩa của audio này như thế nào?</h3>
            <div className="mt-4 space-y-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background px-3 py-2">
                  <input
                    type="radio"
                    name="overallRating"
                    value={value}
                    checked={overallRating === value}
                    onChange={() => setOverallRating(value)}
                    className="mt-1"
                  />
                  <span className="text-sm">{ratingLabels[value]}</span>
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={submitFeedback}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "Đang gửi..." : "Hoàn tất"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
