import { NextResponse } from "next/server";
import { auth } from "@/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * Canonical session accessor for API handlers: returns the authenticated
 * user's id (the Prisma User id) or throws UnauthorizedError.
 *
 * Usage in a route handler:
 *   try {
 *     const userId = await requireUser();
 *     ...all queries scoped by userId...
 *   } catch (e) {
 *     if (e instanceof UnauthorizedError) return unauthorizedResponse();
 *     throw e;
 *   }
 */
export async function requireUser(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new UnauthorizedError();
  return userId;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized", code: "UNAUTHORIZED" },
    { status: 401 },
  );
}
