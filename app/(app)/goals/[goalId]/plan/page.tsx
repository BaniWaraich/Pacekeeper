import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PlanReview } from "./plan-review";

/**
 * Plan review (step 14): the proposal → confirm flow for all recalibration
 * shapes — initial plan, SLIPPING redistribution, TRIAGE cut. The proposal is
 * read from POST …/recalibrate in client state; confirming writes exactly one
 * transaction via PUT …/plan.
 */
export default async function GoalPlanPage({
  params,
}: {
  params: Promise<{ goalId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const { goalId } = await params;

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId, archivedAt: null },
    select: { id: true, title: true },
  });
  if (!goal) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-zinc-50 px-6 py-10 dark:bg-black">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Study plan
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {goal.title} — the engine proposes, you confirm
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back to dashboard
        </Link>
      </header>

      <PlanReview goalId={goal.id} />
    </main>
  );
}
