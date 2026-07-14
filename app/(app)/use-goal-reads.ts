"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "./goals/fetch-json";

/**
 * Shared fetch state for the two §6.2 read screens (/today, /dashboard).
 * §6 defines only per-goal read routes, so both screens aggregate the same
 * way: GET /api/goals, then the per-goal read for each goal in parallel,
 * with the browser's IANA zone as `?tz=` — the client is the only place the
 * user's timezone is knowable (§6 convention; no User.timezone column).
 */

type GoalListItem = { id: string; title: string };

export type GoalRead<T> = { goalId: string; title: string; data: T };

export type GoalReadsState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; reads: GoalRead<T>[] };

export function useGoalReads<T>(endpoint: "today" | "dashboard"): {
  state: GoalReadsState<T>;
  retry: () => void;
} {
  const [state, setState] = useState<GoalReadsState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    (async () => {
      const goals = await fetchJson<GoalListItem[]>("/api/goals", "GET");
      const reads = await Promise.all(
        goals.map(async (goal) => ({
          goalId: goal.id,
          title: goal.title,
          data: await fetchJson<T>(
            `/api/goals/${goal.id}/${endpoint}?tz=${encodeURIComponent(tz)}`,
            "GET",
          ),
        })),
      );
      if (!cancelled) setState({ status: "ready", reads });
    })().catch((e: unknown) => {
      if (!cancelled) {
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Request failed",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [endpoint, attempt]);

  const retry = useCallback(() => {
    // Reset here (an event handler) rather than in the effect — the initial
    // state already covers the first load.
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
