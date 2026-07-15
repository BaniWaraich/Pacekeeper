"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MATERIAL_MAX } from "@/lib/validations";
import { Card } from "@/app/ui";
import { fetchJson } from "../../../fetch-json";
import { buttonClass, inputClass } from "./question-fields";

/**
 * Edits `topic.material` — the source text POST /api/ai/questions reads
 * server-side. Saves through the existing PATCH /api/topics/:id (no new
 * endpoint). Reports dirtiness upward so the draft panel can refuse to
 * draft from stale material.
 */
export function MaterialEditor({
  topicId,
  initialMaterial,
  onDirtyChange,
}: {
  topicId: string;
  initialMaterial: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [savedMaterial, setSavedMaterial] = useState(initialMaterial);
  const [text, setText] = useState(initialMaterial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = text !== savedMaterial;
  const overLimit = text.length > MATERIAL_MAX;
  // The contract can't clear material (PATCH `material` is min-1), so an
  // emptied textarea is unsaveable rather than silently dropped.
  const empty = text.trim().length === 0;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/topics/${topicId}`, "PATCH", { material: text });
      setSavedMaterial(text);
      onDirtyChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
        Material
      </h2>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        The source text AI drafts this topic&apos;s questions from. Save it,
        then use Draft with AI below.
      </p>
      <textarea
        className={`${inputClass} min-h-32`}
        placeholder="Paste the notes this topic covers…"
        value={text}
        disabled={busy}
        onChange={(e) => {
          setText(e.target.value);
          onDirtyChange(e.target.value !== savedMaterial);
        }}
      />
      <p
        className={
          overLimit
            ? "text-xs text-red-600 dark:text-red-400"
            : "text-xs text-slate-500 dark:text-slate-400"
        }
      >
        {text.length.toLocaleString()} / {MATERIAL_MAX.toLocaleString()}{" "}
        characters
      </p>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          className={buttonClass}
          disabled={busy || !dirty || overLimit || empty}
          onClick={save}
        >
          {busy ? "Saving…" : "Save material"}
        </button>
        {dirty && empty && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Material can&apos;t be saved empty.
          </span>
        )}
      </div>
    </Card>
  );
}
