import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, pageClass, linkClass } from "@/app/ui";
import { QuestionEditor, type QuestionRow } from "./question-editor";
import { TopicAuthoring } from "./topic-authoring";

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
    <main className={pageClass}>
      <PageHeader
        title={topic.title}
        action={
          <span className="flex items-baseline gap-4">
            {questions.length > 0 && (
              <Link
                href={`/goals/${goalId}/topics/${topicId}/session`}
                className={linkClass}
              >
                Start session
              </Link>
            )}
            <Link href={`/goals/${goalId}`} className={linkClass}>
              Back to structure
            </Link>
          </span>
        }
      />

      <TopicAuthoring
        goalId={goalId}
        topicId={topic.id}
        initialMaterial={topic.material ?? ""}
      />

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
