import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, pageClass, linkClass } from "@/app/ui";
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
    <main className={pageClass}>
      <PageHeader
        title="Build structure from your material"
        subtitle={`${goal.title} — paste your course material and AI proposes the modules and topics. You review and confirm before anything is saved.`}
        action={
          <Link href={`/goals/${goal.id}`} className={linkClass}>
            Back to structure
          </Link>
        }
      />

      <ImportView goalId={goal.id} nextModuleIndex={nextModuleIndex} />
    </main>
  );
}
