"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StarIcon } from "lucide-react";

type AssignmentItem = {
  id: string;
  sequence: number;
  fileName: string;
  audioUrl: string;
  played: boolean;
  responseRating: number | null;
};

type SessionBatchFormProps = {
  userCode: string;
  assignments: AssignmentItem[];
};

export function SessionBatchForm({ userCode, assignments }: SessionBatchFormProps) {
  const router = useRouter();
  const [busyPlayId, setBusyPlayId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    assignments.forEach((item) => {
      if (item.responseRating) {
        initial[item.id] = item.responseRating;
      }
    });
    return initial;
  });

  const pending = useMemo(() => assignments.filter((item) => item.responseRating == null), [assignments]);
  const playedCount = useMemo(() => assignments.filter((item) => item.played || item.responseRating != null).length, [assignments]);

  const canSubmit = pending.length > 0 && pending.every((item) => (item.played || item.responseRating != null) && ratings[item.id] >= 1);

  async function playOnce(assignmentId: string, audioUrl: string, alreadyPlayed: boolean, hasResponse: boolean) {
    if (alreadyPlayed || hasResponse || busyPlayId) return;
    setBusyPlayId(assignmentId);

    const audio = new Audio(audioUrl);
    audio.onended = async () => {
      await fetch("/api/session/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode, assignmentId }),
      });
      setBusyPlayId(null);
      router.refresh();
    };

    audio.onerror = () => {
      setBusyPlayId(null);
      alert("Unable to play this sample.");
    };

    try {
      await audio.play();
    } catch {
      setBusyPlayId(null);
      alert("Playback blocked by browser. Click again to allow audio.");
    }
  }

  async function submitAll() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    const payload = pending.map((item) => ({
      assignmentId: item.id,
      rating: ratings[item.id],
    }));

    const res = await fetch("/api/session/response-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userCode, ratings: payload }),
    });

    if (!res.ok) {
      setSubmitting(false);
      const msg = await res.json().catch(() => ({}));
      alert(msg.error ?? "Failed to submit ratings.");
      return;
    }

    router.refresh();
  }

  return (
    <section className="rounded-3xl border bg-card/90 p-6 shadow-sm backdrop-blur md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Listen All, Then Submit</h2>
        <p className="rounded-full border bg-background px-3 py-1 text-xs font-medium">
          Played {playedCount}/{assignments.length}
        </p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Each audio can be played once. After listening, rate with stars. Submit once for the full form.
      </p>

      <div className="mt-5 space-y-3">
        {assignments.map((item) => {
          const locked = item.played || item.responseRating != null;
          const activeRating = ratings[item.id] ?? 0;

          return (
            <article key={item.id} className="rounded-2xl border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">#{item.sequence} {item.fileName}</p>
                <button
                  type="button"
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  disabled={locked || busyPlayId !== null}
                  onClick={() => playOnce(item.id, item.audioUrl, item.played, item.responseRating != null)}
                >
                  {item.responseRating != null ? "Completed" : item.played ? "Played" : busyPlayId === item.id ? "Playing..." : "Play once"}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= activeRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      disabled={!locked || item.responseRating != null}
                      onClick={() => setRatings((prev) => ({ ...prev, [item.id]: star }))}
                      className="rounded-md p-1 disabled:opacity-40"
                      aria-label={`Rate ${star} stars`}
                    >
                      <StarIcon className={`size-5 ${filled ? "fill-amber-400 text-amber-500" : "text-zinc-300"}`} />
                    </button>
                  );
                })}
                <span className="ml-2 text-xs text-muted-foreground">
                  {item.responseRating != null ? `Submitted: ${item.responseRating}/5` : activeRating ? `${activeRating}/5` : "Not rated"}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={submitAll}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit All Ratings"}
        </button>
      </div>
    </section>
  );
}
