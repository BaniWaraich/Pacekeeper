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
  type TodayNewTopicItem,
  type TodayResponse,
  type TodayReviewItem,
} from "@/lib/engine-io";

type Params = { params: Promise<{ goalId: string }> };

/**
 * GET /api/goals/:id/today?tz= (§6.2, §5.4) — the daily accountability unit:
 * due reviews + planned new topics, computed on read. Read-only: this route
 * (like everything in step 11) has no write path; the regime's proposals are
 * served by POST …/recalibrate (step 14), never here.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();

    const tz = resolveTimeZone(request.nextUrl.searchParams.get("tz"));
    if (!tz) return badRequest("Missing or invalid timezone", "INVALID_TZ");

    const { goalId } = await params;
    const state = await loadGoalEngineState(userId, goalId, tz);
    if (!state) return notFound();

    const { result, todayLocal, topicMeta, questionMeta, currentPlanDates } =
      state;

    const reviews: TodayReviewItem[] = result.today.reviews.flatMap((r) => {
      const question = questionMeta.get(r.questionId);
      const topic = question && topicMeta.get(question.topicId);
      if (!question || !topic) return [];
      return [
        {
          questionId: r.questionId,
          topicId: question.topicId,
          topicTitle: topic.title,
          prompt: question.prompt,
          type: question.type,
          // A due review always has a dueDate (it has attempts); the
          // fallback is unreachable but keeps the wire type non-null.
          dueDate: r.dueDate ?? todayLocal,
          strength: r.strength,
        },
      ];
    });

    const newTopics: TodayNewTopicItem[] = result.today.newTopicIds.flatMap(
      (topicId) => {
        const meta = topicMeta.get(topicId);
        const plannedDate = currentPlanDates.get(topicId);
        if (!meta || !plannedDate) return [];
        return [
          {
            topicId,
            title: meta.title,
            moduleTitle: meta.moduleTitle,
            plannedDate,
          },
        ];
      },
    );

    const body: TodayResponse = state.planned
      ? {
          planned: true,
          todayLocal,
          regime: result.regime.regime,
          reviews,
          newTopics,
        }
      : { planned: false, todayLocal, regime: null, reviews, newTopics: [] };
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
