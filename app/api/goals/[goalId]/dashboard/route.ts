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
  type DashboardRegime,
  type DashboardResponse,
  type DashboardTopicReadiness,
} from "@/lib/engine-io";

type Params = { params: Promise<{ goalId: string }> };

/**
 * GET /api/goals/:id/dashboard?tz= (§6.2) — per-goal readiness + regime,
 * computed on read. Unplanned goals (no v0 entries yet) return
 * `regime: null` with plan-derived fields omitted: the engine's ON_PACE
 * floor for them must never cross this boundary. `proposedEntries` are
 * likewise never exposed here — they belong to POST …/recalibrate (step 14).
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();

    const tz = resolveTimeZone(request.nextUrl.searchParams.get("tz"));
    if (!tz) return badRequest("Missing or invalid timezone", "INVALID_TZ");

    const { goalId } = await params;
    const state = await loadGoalEngineState(userId, goalId, tz);
    if (!state) return notFound();

    const base = {
      goalId: state.goal.id,
      title: state.goal.title,
      examDate: state.goal.examDate,
      todayLocal: state.todayLocal,
    };

    if (!state.planned) {
      const body: DashboardResponse = { ...base, planned: false, regime: null };
      return NextResponse.json(body);
    }

    const { result, topicMeta } = state;

    // Weakest-first (SPEC 6.6); the stable sort keeps ties in syllabus order.
    const topicReadiness: DashboardTopicReadiness[] = [...result.topicReadiness]
      .sort((a, b) => a.readiness - b.readiness)
      .flatMap((tr) => {
        const meta = topicMeta.get(tr.topicId);
        if (!meta) return [];
        return [
          {
            topicId: tr.topicId,
            title: meta.title,
            moduleTitle: meta.moduleTitle,
            readiness: tr.readiness,
            introduced: tr.introduced,
            notYetReady: tr.notYetReady,
          },
        ];
      });

    const regime: DashboardRegime = {
      regime: result.regime.regime,
      metrics: result.regime.metrics,
    };
    if (result.regime.regime === "TRIAGE") {
      regime.keptCount = result.regime.kept.length;
      regime.deferred = result.regime.deferred.flatMap((d) => {
        const meta = topicMeta.get(d.topicId);
        return meta
          ? [{ topicId: d.topicId, title: meta.title, readiness: d.readiness }]
          : [];
      });
    }

    const metrics = result.regime.metrics;
    const body: DashboardResponse = {
      ...base,
      planned: true,
      dailyNewTopicCap: state.goal.dailyNewTopicCap,
      goalReadiness: result.goalReadiness,
      topicReadiness,
      regime,
      planProgress: {
        totalActiveTopics: metrics.totalActiveTopics,
        introducedTopics: metrics.totalActiveTopics - metrics.remainingTopics,
        remainingTopics: metrics.remainingTopics,
        daysUsable: metrics.daysUsable,
        requiredRate: metrics.requiredRate,
        baselineRate: metrics.baselineRate,
        planVersion: state.goal.currentPlanVersion,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
