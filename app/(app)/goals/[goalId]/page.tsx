import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { activeStructureInclude } from "@/lib/ownership";
import { PageHeader, pageClass, linkClass } from "@/app/ui";
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
    <main className={pageClass}>
      <PageHeader
        title={goal.title}
        subtitle={`exam ${goal.examDate.toISOString().slice(0, 10)}`}
        action={
          <span className="flex items-baseline gap-4">
            <Link href={`/goals/${goal.id}/import`} className={linkClass}>
              Build structure from material
            </Link>
            <Link href="/goals" className={linkClass}>
              All goals
            </Link>
          </span>
        }
      />

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
