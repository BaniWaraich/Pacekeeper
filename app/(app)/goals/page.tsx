import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 bg-zinc-50 px-6 py-10 dark:bg-black">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Goals
        </h1>
        <Link
          href="/today"
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Today
        </Link>
      </header>

      <ul className="flex flex-col gap-2">
        {goals.map((goal) => (
          <li key={goal.id}>
            <Link
              href={`/goals/${goal.id}`}
              className="flex items-baseline justify-between rounded border border-zinc-300 px-4 py-3 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {goal.title}
              </span>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                exam {goal.examDate.toISOString().slice(0, 10)} ·{" "}
                {goal.modules.length} modules ·{" "}
                {goal.modules.reduce((n, m) => n + m.topics.length, 0)} topics
              </span>
            </Link>
          </li>
        ))}
        {goals.length === 0 && (
          <li className="text-sm text-zinc-600 dark:text-zinc-400">
            No goals yet — create one below.
          </li>
        )}
      </ul>

      <GoalForm />
    </main>
  );
}
