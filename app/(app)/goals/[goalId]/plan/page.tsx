import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, pageClass, linkClass } from "@/app/ui";
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
    <main className={pageClass}>
      <PageHeader
        title="Study plan"
        subtitle={`${goal.title} — the engine proposes, you confirm.`}
        action={
          <Link href="/dashboard" className={linkClass}>
            Back to dashboard
          </Link>
        }
      />

      <PlanReview goalId={goal.id} />
    </main>
  );
}
