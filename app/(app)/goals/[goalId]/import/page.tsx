import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ImportView } from "./import-view";

/**
 * AI structure import (step 13, flow 1): paste notes / upload a PDF, review
 * the proposed module→topic tree, confirm through the step-9 CRUD endpoints.
 * The proposal exists only in ImportView's client state.
 */
export default async function GoalImportPage({
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
    include: {
      modules: {
        where: { archivedAt: null },
        select: { orderIndex: true },
      },
    },
  });
  if (!goal) notFound();

  // New modules append after the existing ones (same nextIndex convention as
  // the structure builder).
  const nextModuleIndex =
    goal.modules.length === 0
      ? 0
      : Math.max(...goal.modules.map((m) => m.orderIndex)) + 1;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-zinc-50 px-6 py-10 dark:bg-black">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Import structure
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {goal.title} — AI proposes, you confirm
          </p>
        </div>
        <Link
          href={`/goals/${goal.id}`}
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back to structure
        </Link>
      </header>

      <ImportView goalId={goal.id} nextModuleIndex={nextModuleIndex} />
    </main>
  );
}
