import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { badRequest, notFound } from "@/lib/api-errors";
import { resolveTimeZone } from "@/lib/dates";
import {
  loadGoalEngineState,
  type GoalEngineState,
  type ProposedEntryItem,
  type RecalibrateResponse,
  type TriagedTopicItem,
} from "@/lib/engine-io";
import type { ProposedPlanEntry, TriagedTopic } from "@/lib/engine/types";

type Params = { params: Promise<{ goalId: string }> };

function toEntryItems(
  entries: ProposedPlanEntry[],
  state: GoalEngineState,
): ProposedEntryItem[] {
  return entries.flatMap((e) => {
    const meta = state.topicMeta.get(e.topicId);
    if (!meta) return [];
    return [
      {
        topicId: e.topicId,
        title: meta.title,
        moduleTitle: meta.moduleTitle,
        plannedDate: e.plannedDate,
      },
    ];
  });
}

function toTriagedItems(
  triaged: TriagedTopic[],
  state: GoalEngineState,
): TriagedTopicItem[] {
  return triaged.flatMap((t) => {
    const meta = state.topicMeta.get(t.topicId);
    if (!meta) return [];
    return [
      {
        topicId: t.topicId,
        title: meta.title,
        moduleTitle: meta.moduleTitle,
        readiness: t.readiness,
      },
    ];
  });
}

/**
 * POST /api/goals/:id/recalibrate?tz= (§6.2) — the proposal read: pure,
 * computed fresh, **no write** (§3.4: engine proposes, user confirms via
 * PUT …/plan). Also serves the initial-planning flow (step-14 ruling): for an
 * unplanned goal the regime path can't propose — a feasible goal misreports
 * ON_PACE off the floored baseline — so INITIAL carries the §5.6 spread from
 * `state.initialProposal`, and INITIAL_TRIAGE relays the engine's
 * baseline-independent TRIAGE split. `basePlanVersion` (null when unplanned)
 * is echoed by the client into the confirm for the staleness check.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();

    const tz = resolveTimeZone(request.nextUrl.searchParams.get("tz"));
    if (!tz) return badRequest("Missing or invalid timezone", "INVALID_TZ");

    const { goalId } = await params;
    const state = await loadGoalEngineState(userId, goalId, tz);
    if (!state) return notFound();

    const { result } = state;
    const base = {
      goalId: state.goal.id,
      title: state.goal.title,
      examDate: state.goal.examDate,
      todayLocal: state.todayLocal,
      dailyNewTopicCap: state.goal.dailyNewTopicCap,
      daysUsable: result.regime.metrics.daysUsable,
    };

    let body: RecalibrateResponse;
    if (!state.planned) {
      body =
        result.regime.regime === "TRIAGE"
          ? {
              ...base,
              planned: false,
              mode: "INITIAL_TRIAGE",
              basePlanVersion: null,
              kept: toTriagedItems(result.regime.kept, state),
              deferred: toTriagedItems(result.regime.deferred, state),
              proposedEntries: toEntryItems(result.regime.proposedEntries, state),
            }
          : {
              ...base,
              planned: false,
              mode: "INITIAL",
              basePlanVersion: null,
              proposedEntries: toEntryItems(state.initialProposal ?? [], state),
            };
    } else if (result.regime.regime === "ON_PACE") {
      body = {
        ...base,
        planned: true,
        mode: "ON_PACE",
        basePlanVersion: state.goal.currentPlanVersion,
        metrics: result.regime.metrics,
      };
    } else if (result.regime.regime === "SLIPPING") {
      body = {
        ...base,
        planned: true,
        mode: "SLIPPING",
        basePlanVersion: state.goal.currentPlanVersion,
        metrics: result.regime.metrics,
        proposedEntries: toEntryItems(result.regime.proposedEntries, state),
      };
    } else {
      body = {
        ...base,
        planned: true,
        mode: "TRIAGE",
        basePlanVersion: state.goal.currentPlanVersion,
        metrics: result.regime.metrics,
        kept: toTriagedItems(result.regime.kept, state),
        deferred: toTriagedItems(result.regime.deferred, state),
        proposedEntries: toEntryItems(result.regime.proposedEntries, state),
      };
    }
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
