import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { activeStructureInclude } from "@/lib/ownership";
import { StructureBuilder } from "./structure-builder";

export default async function GoalStructurePage({
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
    include: activeStructureInclude,
  });
  if (!goal) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-zinc-50 px-6 py-10 dark:bg-black">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {goal.title}
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            exam {goal.examDate.toISOString().slice(0, 10)}
          </p>
        </div>
        <Link
          href="/goals"
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          All goals
        </Link>
      </header>

      <StructureBuilder
        goal={{
          id: goal.id,
          modules: goal.modules.map((m) => ({
            id: m.id,
            title: m.title,
            orderIndex: m.orderIndex,
            topics: m.topics.map((t) => ({
              id: t.id,
              title: t.title,
              orderIndex: t.orderIndex,
            })),
          })),
        }}
      />
    </main>
  );
}
