"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MATERIAL_MAX,
  TITLE_MAX,
  type AiStructureResponse,
} from "@/lib/validations";
import { ApiError, fetchJson, uploadFile } from "../../fetch-json";

const inputClass =
  "rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const buttonClass =
  "rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";
const actionClass =
  "text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-500 dark:hover:text-zinc-100";
const errorClass = "text-xs text-red-600 dark:text-red-400";

type DraftTopic = { key: number; title: string; createdId?: string };
type DraftModule = {
  key: number;
  title: string;
  createdId?: string;
  topics: DraftTopic[];
};

/**
 * The screen's lifecycle. The draft tree lives ONLY in this component's
 * state — leaving the page abandons it, by design (step 13 invariant 1).
 * Once `confirming`/`confirm-failed` is reached, structural edits are locked:
 * created rows already exist server-side, and reordering would desync the
 * position→orderIndex mapping the resume path relies on.
 */
type Phase =
  | { phase: "input"; error?: string }
  | { phase: "proposing" }
  | { phase: "unavailable" }
  | { phase: "reviewing" }
  | { phase: "confirming"; done: number; total: number }
  | { phase: "confirm-failed"; message: string; done: number; total: number };

export function ImportView({
  goalId,
  nextModuleIndex,
}: {
  goalId: string;
  nextModuleIndex: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ phase: "input" });
  const [material, setMaterial] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftModule[]>([]);
  const [editing, setEditing] = useState<number | null>(null); // draft key
  const [editTitle, setEditTitle] = useState("");
  const [newTopic, setNewTopic] = useState<Record<number, string>>({});
  const [newModule, setNewModule] = useState("");
  const keyCounter = useRef(0);
  const nextKey = () => ++keyCounter.current;

  const anythingCreated = drafts.some(
    (m) => m.createdId || m.topics.some((t) => t.createdId),
  );
  const locked =
    phase.phase === "confirming" || phase.phase === "confirm-failed";

  /* ── input: PDF extraction + propose ─────────────────────────────────── */

  async function onPdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-choosing the same file
    if (!file) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { text } = await uploadFile<{ text: string }>(
        "/api/ingest/pdf",
        form,
      );
      setMaterial((prev) => (prev.trim() ? `${prev}\n\n${text}` : text));
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPdfBusy(false);
    }
  }

  async function propose() {
    setPhase({ phase: "proposing" });
    try {
      const result = await fetchJson<AiStructureResponse>(
        "/api/ai/structure",
        "POST",
        { material },
      );
      setDrafts(
        result.modules.map((m) => ({
          key: nextKey(),
          title: m.title,
          topics: m.topics.map((t) => ({ key: nextKey(), title: t.title })),
        })),
      );
      setPhase({ phase: "reviewing" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "AI_UNAVAILABLE") {
        setPhase({ phase: "unavailable" });
      } else {
        setPhase({
          phase: "input",
          error: err instanceof Error ? err.message : "Request failed",
        });
      }
    }
  }

  /* ── reviewing: draft tree edits (client state only) ─────────────────── */

  const patchModule = (key: number, patch: Partial<DraftModule>) =>
    setDrafts((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  const patchTopic = (mKey: number, tKey: number, patch: Partial<DraftTopic>) =>
    setDrafts((ms) =>
      ms.map((m) =>
        m.key === mKey
          ? {
              ...m,
              topics: m.topics.map((t) =>
                t.key === tKey ? { ...t, ...patch } : t,
              ),
            }
          : m,
      ),
    );

  function saveRename(mKey: number, tKey?: number) {
    const title = editTitle.trim();
    if (title) {
      if (tKey === undefined) patchModule(mKey, { title });
      else patchTopic(mKey, tKey, { title });
    }
    setEditing(null);
  }

  const moveInArray = <T,>(list: T[], index: number, delta: -1 | 1): T[] => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    return next;
  };

  /* ── confirm: sequential creates through the step-9 endpoints ────────── */

  const countRemaining = () =>
    drafts.reduce(
      (n, m) =>
        n +
        (m.createdId ? 0 : 1) +
        m.topics.filter((t) => !t.createdId).length,
      0,
    );

  async function confirm() {
    const total = countRemaining();
    let done = 0;
    setPhase({ phase: "confirming", done, total });
    try {
      for (let mi = 0; mi < drafts.length; mi++) {
        const draftModule = drafts[mi];
        let moduleId = draftModule.createdId;
        if (!moduleId) {
          const created = await fetchJson<{ id: string }>(
            "/api/modules",
            "POST",
            {
              goalId,
              title: draftModule.title,
              orderIndex: nextModuleIndex + mi,
            },
          );
          moduleId = created.id;
          patchModule(draftModule.key, { createdId: created.id });
          done += 1;
          setPhase({ phase: "confirming", done, total });
        }
        for (let ti = 0; ti < draftModule.topics.length; ti++) {
          const draftTopic = draftModule.topics[ti];
          if (draftTopic.createdId) continue;
          const created = await fetchJson<{ id: string }>(
            "/api/topics",
            "POST",
            { moduleId, title: draftTopic.title, orderIndex: ti },
          );
          patchTopic(draftModule.key, draftTopic.key, {
            createdId: created.id,
          });
          done += 1;
          setPhase({ phase: "confirming", done, total });
        }
      }
      router.push(`/goals/${goalId}`);
    } catch (err) {
      setPhase({
        phase: "confirm-failed",
        message: err instanceof Error ? err.message : "Request failed",
        done,
        total,
      });
    }
  }

  /* ── render ──────────────────────────────────────────────────────────── */

  if (phase.phase === "unavailable") {
    return (
      <section className="flex flex-col gap-3 rounded border border-zinc-300 p-6 dark:border-zinc-700">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          AI assist is unavailable
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The structure proposal service isn&apos;t reachable right now. You
          can build the structure manually — everything else works without AI.
        </p>
        <div className="flex items-center gap-4">
          <Link href={`/goals/${goalId}`} className={buttonClass}>
            Open the structure builder
          </Link>
          <button
            className={actionClass}
            onClick={() => setPhase({ phase: "input" })}
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (phase.phase === "input" || phase.phase === "proposing") {
    const proposing = phase.phase === "proposing";
    const overLimit = material.length > MATERIAL_MAX;
    return (
      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            Paste your notes, or extract them from a PDF below
          </span>
          <textarea
            className={`${inputClass} min-h-48`}
            placeholder="Lecture notes, a syllabus, a textbook chapter…"
            value={material}
            disabled={proposing}
            onChange={(e) => setMaterial(e.target.value)}
          />
        </label>
        <p
          className={
            overLimit ? errorClass : "text-xs text-zinc-500 dark:text-zinc-500"
          }
        >
          {material.length.toLocaleString()} /{" "}
          {MATERIAL_MAX.toLocaleString()} characters
        </p>

        <div className="flex items-center gap-3">
          <label className={actionClass}>
            {pdfBusy ? "Extracting PDF…" : "Upload a PDF (≤10 MB)"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={proposing || pdfBusy}
              onChange={onPdfChange}
            />
          </label>
          {pdfError && <span className={errorClass}>{pdfError}</span>}
        </div>

        {phase.phase === "input" && phase.error && (
          <p className={errorClass}>{phase.error}</p>
        )}

        <div>
          <button
            className={buttonClass}
            disabled={
              proposing || pdfBusy || material.trim().length === 0 || overLimit
            }
            onClick={propose}
          >
            {proposing ? "Asking the AI…" : "Propose structure"}
          </button>
        </div>
      </section>
    );
  }

  // reviewing / confirming / confirm-failed: the draft tree
  const remaining = countRemaining();
  const moduleCount = drafts.filter((m) => !m.createdId).length;
  const topicCount = drafts.reduce(
    (n, m) => n + m.topics.filter((t) => !t.createdId).length,
    0,
  );

  const createdMark = (createdId?: string) =>
    createdId && (
      <span
        className="text-xs text-green-700 dark:text-green-400"
        title="Already created"
      >
        ✓ created
      </span>
    );

  function titleRow(
    node: { key: number; title: string; createdId?: string },
    mKey: number,
    tKey: number | undefined,
    list: { key: number }[],
    index: number,
    reorder: (delta: -1 | 1) => void,
    remove: () => void,
    strong: boolean,
  ) {
    const editable = !locked && !node.createdId;
    return (
      <div className="flex items-center gap-2">
        {editing === node.key && editable ? (
          <>
            {/* TITLE_MAX enforced at input: an over-limit title would 400
                mid-confirm-sequence, after which edits are locked. */}
            <input
              className={inputClass}
              value={editTitle}
              maxLength={TITLE_MAX}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
            />
            <button
              className={actionClass}
              onClick={() => saveRename(mKey, tKey)}
            >
              Save
            </button>
            <button className={actionClass} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <span
              className={
                strong
                  ? "text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  : "text-sm text-zinc-700 dark:text-zinc-300"
              }
            >
              {node.title}
            </span>
            {createdMark(node.createdId)}
            {editable && (
              <>
                <button
                  className={actionClass}
                  onClick={() => {
                    setEditing(node.key);
                    setEditTitle(node.title);
                  }}
                >
                  Rename
                </button>
                <button
                  className={actionClass}
                  disabled={index === 0}
                  onClick={() => reorder(-1)}
                >
                  ↑
                </button>
                <button
                  className={actionClass}
                  disabled={index === list.length - 1}
                  onClick={() => reorder(1)}
                >
                  ↓
                </button>
                <button className={actionClass} onClick={remove}>
                  Delete
                </button>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        This is a draft — nothing is saved until you confirm. Rename, reorder,
        delete, or add before confirming.
      </p>

      {drafts.map((draftModule, mi) => (
        <div
          key={draftModule.key}
          className="flex flex-col gap-2 rounded border border-zinc-300 p-4 dark:border-zinc-700"
        >
          {titleRow(
            draftModule,
            draftModule.key,
            undefined,
            drafts,
            mi,
            (delta) => setDrafts((ms) => moveInArray(ms, mi, delta)),
            () => setDrafts((ms) => ms.filter((m) => m.key !== draftModule.key)),
            true,
          )}

          <ul className="ml-4 flex flex-col gap-1">
            {draftModule.topics.map((draftTopic, ti) => (
              <li key={draftTopic.key}>
                {titleRow(
                  draftTopic,
                  draftModule.key,
                  draftTopic.key,
                  draftModule.topics,
                  ti,
                  (delta) =>
                    patchModule(draftModule.key, {
                      topics: moveInArray(draftModule.topics, ti, delta),
                    }),
                  () =>
                    patchModule(draftModule.key, {
                      topics: draftModule.topics.filter(
                        (t) => t.key !== draftTopic.key,
                      ),
                    }),
                  false,
                )}
              </li>
            ))}
          </ul>

          {!locked && (
            <form
              className="ml-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const title = (newTopic[draftModule.key] ?? "").trim();
                if (!title) return;
                patchModule(draftModule.key, {
                  topics: [
                    ...draftModule.topics,
                    { key: nextKey(), title },
                  ],
                });
                setNewTopic((s) => ({ ...s, [draftModule.key]: "" }));
              }}
            >
              <input
                className={inputClass}
                placeholder="New topic"
                maxLength={TITLE_MAX}
                value={newTopic[draftModule.key] ?? ""}
                onChange={(e) =>
                  setNewTopic((s) => ({
                    ...s,
                    [draftModule.key]: e.target.value,
                  }))
                }
              />
              <button type="submit" className={actionClass}>
                Add topic
              </button>
            </form>
          )}
        </div>
      ))}

      {!locked && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const title = newModule.trim();
            if (!title) return;
            setDrafts((ms) => [...ms, { key: nextKey(), title, topics: [] }]);
            setNewModule("");
          }}
        >
          <input
            className={inputClass}
            placeholder="New module"
            maxLength={TITLE_MAX}
            value={newModule}
            onChange={(e) => setNewModule(e.target.value)}
          />
          <button type="submit" className={actionClass}>
            Add module
          </button>
        </form>
      )}

      {phase.phase === "confirming" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Creating {Math.min(phase.done + 1, phase.total)}/{phase.total}…
        </p>
      )}

      {phase.phase === "confirm-failed" && (
        <div className="flex flex-col gap-2 rounded border border-red-300 p-4 dark:border-red-900">
          <p className="text-sm text-zinc-900 dark:text-zinc-50">
            Creation stopped partway: {phase.done} of {phase.total} items were
            created (marked ✓ above) and now exist in your structure. The rest
            were not.
          </p>
          <p className={errorClass}>{phase.message}</p>
          <div className="flex items-center gap-4">
            <button className={buttonClass} onClick={confirm}>
              Retry remaining ({remaining})
            </button>
            <Link
              href={`/goals/${goalId}`}
              className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Review the partial structure in the builder
            </Link>
          </div>
        </div>
      )}

      {phase.phase === "reviewing" && (
        <div className="flex items-center gap-4">
          <button
            className={buttonClass}
            disabled={remaining === 0}
            onClick={confirm}
          >
            Confirm — create {moduleCount}{" "}
            {moduleCount === 1 ? "module" : "modules"} & {topicCount}{" "}
            {topicCount === 1 ? "topic" : "topics"}
          </button>
          {!anythingCreated && (
            <button
              className={actionClass}
              onClick={() => {
                setDrafts([]);
                setPhase({ phase: "input" });
              }}
            >
              Start over
            </button>
          )}
        </div>
      )}
    </section>
  );
}
