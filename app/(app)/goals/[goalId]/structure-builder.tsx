"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { actionClass, inputClass, linkClass } from "@/app/ui";
import { fetchJson } from "../fetch-json";

type TopicNode = { id: string; title: string; orderIndex: number };
type ModuleNode = {
  id: string;
  title: string;
  orderIndex: number;
  topics: TopicNode[];
};
type GoalNode = { id: string; modules: ModuleNode[] };

/**
 * Goal → modules → topics builder. All mutations go through the §6 API
 * routes with plain fetch-and-revalidate (router.refresh()) — no optimistic
 * state. Reorder = swap orderIndex with the neighbor (two PATCHes).
 */
export function StructureBuilder({ goal }: { goal: GoalNode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // module/topic id
  const [editTitle, setEditTitle] = useState("");
  const [newModule, setNewModule] = useState("");
  const [newTopic, setNewTopic] = useState<Record<string, string>>({});

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  const rename = (kind: "modules" | "topics", id: string) =>
    run(async () => {
      await fetchJson(`/api/${kind}/${id}`, "PATCH", { title: editTitle });
      setEditing(null);
    });

  const archive = (kind: "modules" | "topics", id: string) =>
    run(() => fetchJson(`/api/${kind}/${id}`, "DELETE"));

  /** Swap orderIndex with the neighbor at position ±1 (list is already
   *  sorted by orderIndex). */
  const move = (
    kind: "modules" | "topics",
    list: { id: string; orderIndex: number }[],
    index: number,
    delta: -1 | 1,
  ) =>
    run(async () => {
      const a = list[index];
      const b = list[index + delta];
      if (!b) return;
      await fetchJson(`/api/${kind}/${a.id}`, "PATCH", {
        orderIndex: b.orderIndex,
      });
      await fetchJson(`/api/${kind}/${b.id}`, "PATCH", {
        orderIndex: a.orderIndex,
      });
    });

  const nextIndex = (list: { orderIndex: number }[]) =>
    list.length === 0 ? 0 : Math.max(...list.map((x) => x.orderIndex)) + 1;

  function titleRow(
    kind: "modules" | "topics",
    node: { id: string; title: string },
    titleNode: React.ReactNode,
    list: { id: string; orderIndex: number }[],
    index: number,
  ) {
    return (
      <div className="flex items-center gap-2">
        {editing === node.id ? (
          <>
            <input
              className={inputClass}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
            />
            <button
              className={actionClass}
              onClick={() => rename(kind, node.id)}
            >
              Save
            </button>
            <button className={actionClass} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {titleNode}
            <button
              className={actionClass}
              onClick={() => {
                setEditing(node.id);
                setEditTitle(node.title);
              }}
            >
              Rename
            </button>
            <button
              className={actionClass}
              disabled={index === 0}
              onClick={() => move(kind, list, index, -1)}
            >
              ↑
            </button>
            <button
              className={actionClass}
              disabled={index === list.length - 1}
              onClick={() => move(kind, list, index, 1)}
            >
              ↓
            </button>
            <button
              className={actionClass}
              onClick={() => archive(kind, node.id)}
            >
              Archive
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {goal.modules.map((module, mi) => (
        <div
          key={module.id}
          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          {titleRow(
            "modules",
            module,
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {module.title}
            </span>,
            goal.modules,
            mi,
          )}

          <ul className="ml-4 flex flex-col gap-1">
            {module.topics.map((topic, ti) => (
              <li key={topic.id}>
                {titleRow(
                  "topics",
                  topic,
                  <Link
                    href={`/goals/${goal.id}/topics/${topic.id}`}
                    className={`text-sm ${linkClass}`}
                  >
                    {topic.title}
                  </Link>,
                  module.topics,
                  ti,
                )}
              </li>
            ))}
          </ul>

          <form
            className="ml-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const title = (newTopic[module.id] ?? "").trim();
              if (!title) return;
              run(async () => {
                await fetchJson("/api/topics", "POST", {
                  moduleId: module.id,
                  title,
                  orderIndex: nextIndex(module.topics),
                });
                setNewTopic((s) => ({ ...s, [module.id]: "" }));
              });
            }}
          >
            <input
              className={inputClass}
              placeholder="New topic"
              value={newTopic[module.id] ?? ""}
              onChange={(e) =>
                setNewTopic((s) => ({ ...s, [module.id]: e.target.value }))
              }
            />
            <button type="submit" className={actionClass}>
              Add topic
            </button>
          </form>
        </div>
      ))}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const title = newModule.trim();
          if (!title) return;
          run(async () => {
            await fetchJson("/api/modules", "POST", {
              goalId: goal.id,
              title,
              orderIndex: nextIndex(goal.modules),
            });
            setNewModule("");
          });
        }}
      >
        <input
          className={inputClass}
          placeholder="New module"
          value={newModule}
          onChange={(e) => setNewModule(e.target.value)}
        />
        <button type="submit" className={actionClass}>
          Add module
        </button>
      </form>
    </section>
  );
}
