import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, pageClass, cardClass } from "@/app/ui";
import { GoalForm } from "./goal-form";

export default async function GoalsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const goals = await prisma.goal.findMany({
    where: { userId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      modules: {
        where: { archivedAt: null },
        select: { id: true, topics: { where: { archivedAt: null }, select: { id: true } } },
      },
    },
  });

  return (
    <main className={pageClass}>
      <PageHeader
        title="Goals"
        subtitle="Each goal is a subject with an exam date. Pick one to build its structure, or start a new one below."
      />

      <ul className="flex flex-col gap-2">
        {goals.map((goal) => (
          <li key={goal.id}>
            <Link
              href={`/goals/${goal.id}`}
              className={`${cardClass} flex items-baseline justify-between gap-3 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/50`}
            >
              <span className="text-sm font-medium text-slate-900 dark:text-slate-50">
                {goal.title}
              </span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                exam {goal.examDate.toISOString().slice(0, 10)} ·{" "}
                {goal.modules.length} modules ·{" "}
                {goal.modules.reduce((n, m) => n + m.topics.length, 0)} topics
              </span>
            </Link>
          </li>
        ))}
        {goals.length === 0 && (
          <li className="text-sm text-slate-500 dark:text-slate-400">
            No goals yet — create one below.
          </li>
        )}
      </ul>

      <GoalForm />
    </main>
  );
}
