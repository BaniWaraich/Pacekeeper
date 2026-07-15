"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary as buttonClass, inputClass } from "@/app/ui";
import { fetchJson } from "./fetch-json";

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
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          New goal
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          A subject with an exam date. PaceKeeper builds a daily plan to get
          you ready in time.
        </p>
      </div>
      <input
        className={inputClass}
        placeholder="Goal title (e.g. Organic Chemistry final)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
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
        <label className="flex flex-1 flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
          Max new topics per day (default 5)
          <input
            type="number"
            min={1}
            className={inputClass}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
          Buffer days before exam (default 2)
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
