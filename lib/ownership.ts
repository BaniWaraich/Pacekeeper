import { prisma } from "@/lib/prisma";

/**
 * lib/ownership.ts — THE ownership pattern for content models (§6 invariant:
 * every query scoped by the session userId; cross-tenant reads/writes are 404).
 *
 * Convention: no handler ever queries Goal/Module/Topic/Question by bare id.
 * Every entity-ID access resolves through a `getOwned*` helper whose `where`
 * joins up the FK tree to `goal.userId` AND requires `archivedAt: null` at
 * every level of the chain — so archived rows (or rows under an archived
 * ancestor) are indistinguishable from missing ones. `null` means 404.
 *
 * Archiving never cascades writes: setting `archivedAt` on one row makes its
 * whole subtree unreachable through these chains.
 */

export function getOwnedGoal(userId: string, id: string) {
  return prisma.goal.findFirst({
    where: { id, userId, archivedAt: null },
  });
}

export function getOwnedModule(userId: string, id: string) {
  return prisma.module.findFirst({
    where: {
      id,
      archivedAt: null,
      goal: { userId, archivedAt: null },
    },
  });
}

export function getOwnedTopic(userId: string, id: string) {
  return prisma.topic.findFirst({
    where: {
      id,
      archivedAt: null,
      module: {
        archivedAt: null,
        goal: { userId, archivedAt: null },
      },
    },
  });
}

export function getOwnedQuestion(userId: string, id: string) {
  return prisma.question.findFirst({
    where: {
      id,
      archivedAt: null,
      topic: {
        archivedAt: null,
        module: {
          archivedAt: null,
          goal: { userId, archivedAt: null },
        },
      },
    },
  });
}

/** Shared nested include for goal reads: active modules → active topics,
 *  syllabus order (§6.1 "goal(s) with modules/topics; archived filtered out"). */
export const activeStructureInclude = {
  modules: {
    where: { archivedAt: null },
    orderBy: { orderIndex: "asc" },
    include: {
      topics: {
        where: { archivedAt: null },
        orderBy: { orderIndex: "asc" },
      },
    },
  },
} as const;
