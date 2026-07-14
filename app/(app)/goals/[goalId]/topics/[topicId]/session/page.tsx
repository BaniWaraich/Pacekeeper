import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuizSession, type SessionQuestion } from "./quiz-session";

/**
 * Study session for a topic (step 10). The Today view (step 11) is the eventual
 * launch point; until then a session starts from the topic page. Question
 * selection is deliberately thin — the topic's active questions in authoring
 * order (`createdAt asc`); ordering sophistication belongs to the engine.
 *
 * The MCQ answer key (`correctIndex`) never leaves the server: only options are
 * projected to the client, and grading happens server-side in POST /api/attempts.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ goalId: string; topicId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const { goalId, topicId } = await params;

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

  const sessionQuestions: SessionQuestion[] = questions.map((q) => {
    const payload = q.payload as {
      options?: string[];
      correctIndex?: number;
      back?: string;
    };
    return q.type === "MCQ"
      ? {
          id: q.id,
          type: "MCQ",
          prompt: q.prompt,
          options: payload.options ?? [],
        }
      : {
          id: q.id,
          type: "FLASHCARD",
          prompt: q.prompt,
          back: payload.back ?? "",
        };
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-zinc-50 px-6 py-10 dark:bg-black">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Study: {topic.title}
        </h1>
        <Link
          href={`/goals/${goalId}/topics/${topicId}`}
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back to topic
        </Link>
      </header>

      <QuizSession
        goalId={goalId}
        topicId={topicId}
        questions={sessionQuestions}
      />
    </main>
  );
}
