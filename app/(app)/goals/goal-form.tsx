"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "./fetch-json";

const inputClass =
  "rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const buttonClass =
  "rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

export function GoalForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [cap, setCap] = useState("");
  const [buffer, setBuffer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/goals", "POST", {
        title,
        examDate,
        ...(cap !== "" && { dailyNewTopicCap: Number(cap) }),
        ...(buffer !== "" && { bufferDays: Number(buffer) }),
      });
      setTitle("");
      setExamDate("");
      setCap("");
      setBuffer("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded border border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        New goal
      </h2>
      <input
        className={inputClass}
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
        Exam date
        <input
          type="date"
          className={inputClass}
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          required
        />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Daily new-topic cap (default 5)
          <input
            type="number"
            min={1}
            className={inputClass}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Buffer days (default 2)
          <input
            type="number"
            min={0}
            className={inputClass}
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <button type="submit" disabled={busy} className={buttonClass}>
        Create goal
      </button>
    </form>
  );
}
