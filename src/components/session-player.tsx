"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SessionPlayerProps = {
  userCode: string;
  assignmentId: string;
  audioUrl: string;
  fileName: string;
  sequence: number;
  total: number;
  playbackCompleted: boolean;
  statusList: Array<{ sequence: number; done: boolean }>;
};

export function SessionPlayer(props: SessionPlayerProps) {
  const { userCode, assignmentId, audioUrl, fileName, sequence, total, playbackCompleted, statusList } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [played, setPlayed] = useState(playbackCompleted);
  const [rating, setRating] = useState<number>(3);
  const progress = useMemo(() => statusList.filter((item) => item.done).length, [statusList]);

  async function playOnce() {
    if (played || busy) return;
    setBusy(true);

    const audio = new Audio(audioUrl);
    audio.onended = async () => {
      await fetch("/api/session/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode, assignmentId }),
      });
      setPlayed(true);
      setBusy(false);
      router.refresh();
    };

    audio.onerror = () => {
      setBusy(false);
      alert("Unable to play this sample.");
    };

    try {
      await audio.play();
    } catch {
      setBusy(false);
      alert("Playback blocked by browser. Click again to allow audio.");
    }
  }

  async function submitRating() {
    if (!played || busy) return;
    setBusy(true);

    const response = await fetch("/api/session/response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userCode, assignmentId, rating }),
    });

    if (!response.ok) {
      setBusy(false);
      const payload = await response.json().catch(() => ({}));
      alert(payload.error ?? "Failed to save response");
      return;
    }

    router.refresh();
  }

  return (
    <section className="rounded-3xl border bg-card/90 p-6 shadow-sm backdrop-blur md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="rounded-full border bg-background px-3 py-1 text-xs font-medium tracking-wide uppercase">
          Progress {progress}/{total}
        </p>
        <p className="text-sm text-muted-foreground">
          Sample {sequence} of {total}
        </p>
      </div>

      <h2 className="mt-4 text-2xl font-semibold tracking-tight">Listen and Rate</h2>
      <p className="mt-1 rounded-lg border bg-background px-3 py-2 font-mono text-xs md:text-sm">{fileName}</p>

      <div className="mt-5 rounded-2xl border bg-muted/30 p-4">
        <p className="text-sm font-medium">Step 1: Play audio (one-time only)</p>
        <button
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          disabled={played || busy}
          onClick={playOnce}
          type="button"
        >
          {played ? "Playback completed" : busy ? "Playing..." : "Play once"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border bg-muted/30 p-4">
        <p className="text-sm font-medium">Step 2: Submit rating</p>
        <p className="text-xs text-muted-foreground">This unlocks only after playback has finished.</p>

        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
            disabled={!played || busy}
            className="w-full"
          />
          <span className="w-10 rounded-md border bg-background py-1 text-center text-sm font-semibold">{rating}</span>
        </div>

        <button
          className="mt-3 rounded-lg border bg-background px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={!played || busy}
          onClick={submitRating}
          type="button"
        >
          Submit rating
        </button>
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium">Checklist</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {statusList.map((item) => (
            <span
              key={item.sequence}
              className={`rounded-full border px-2.5 py-1 text-xs ${item.done ? "bg-emerald-100" : "bg-background"}`}
            >
              #{item.sequence} {item.done ? "done" : "pending"}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
