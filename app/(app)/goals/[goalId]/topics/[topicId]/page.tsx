import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuestionEditor, type QuestionRow } from "./question-editor";

export default async function TopicQuestionsPage({
  params,
}: {
  params: Promise<{ goalId: string; topicId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const { goalId, topicId } = await params;

  // Ownership chain plus the URL's goalId, so a topic can't be read under
  // someone else's (or another goal's) path.
  const topic = await prisma.topic.findFirst({
    where: {
      id: topicId,
      archivedAt: null,
      module: {
        archivedAt: null,
        goalId,
        goal: { userId, archivedAt: null },
      },
    },
  });
  if (!topic) notFound();

  const questions = await prisma.question.findMany({
    where: { topicId: topic.id, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-zinc-50 px-6 py-10 dark:bg-black">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {topic.title}
        </h1>
        <span className="flex items-baseline gap-4">
          {questions.length > 0 && (
            <Link
              href={`/goals/${goalId}/topics/${topicId}/session`}
              className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Start session
            </Link>
          )}
          <Link
            href={`/goals/${goalId}`}
            className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Back to structure
          </Link>
        </span>
      </header>

      <QuestionEditor
        topicId={topic.id}
        questions={questions.map(
          (q): QuestionRow => ({
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            payload: q.payload as QuestionRow["payload"],
          }),
        )}
      />
    </main>
  );
}
