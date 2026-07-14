/**
 * AI route wiring tests — the handler contract each envelope depends on.
 *
 * `@/auth` (session), `@/lib/ai/gate` (the adapter) and `@/lib/ownership` (DB
 * read) are mocked, so these run without a live API or database and assert the
 * exact status + envelope each route returns:
 *   - 401 when unauthenticated
 *   - 200 drafts pass-through on success
 *   - 503 { code: "AI_UNAVAILABLE" } when the adapter fails — with NO draft in body
 *   - 400 { code: "NO_MATERIAL" } for a topic with no material
 */
import type { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai/gate", () => ({
  proposeStructure: vi.fn(),
  proposeQuestions: vi.fn(),
}));
vi.mock("@/lib/ownership", () => ({ getOwnedTopic: vi.fn() }));

import { auth } from "@/auth";
import { proposeStructure, proposeQuestions } from "@/lib/ai/gate";
import { getOwnedTopic } from "@/lib/ownership";
import { AiUnavailableError } from "@/lib/ai/errors";
import { POST as structurePOST } from "@/app/api/ai/structure/route";
import { POST as questionsPOST } from "@/app/api/ai/questions/route";

const mockAuth = vi.mocked(auth);
const mockStructure = vi.mocked(proposeStructure);
const mockQuestions = vi.mocked(proposeQuestions);
const mockGetOwnedTopic = vi.mocked(getOwnedTopic);

function post(url: string, body: unknown): NextRequest {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function signedIn() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/ai/structure", () => {
  it("401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await structurePOST(post("http://t/api/ai/structure", { material: "x" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized", code: "UNAUTHORIZED" });
    expect(mockStructure).not.toHaveBeenCalled();
  });

  it("400 on invalid body", async () => {
    signedIn();
    const res = await structurePOST(post("http://t/api/ai/structure", { material: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION");
    expect(mockStructure).not.toHaveBeenCalled();
  });

  it("200 passes gated drafts through", async () => {
    signedIn();
    const modules = { modules: [{ title: "M", topics: [{ title: "T" }] }] };
    mockStructure.mockResolvedValue(modules);
    const res = await structurePOST(post("http://t/api/ai/structure", { material: "abc" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(modules);
  });

  it("503 AI_UNAVAILABLE with no draft in the body when the adapter fails", async () => {
    signedIn();
    mockStructure.mockRejectedValue(new AiUnavailableError());
    const res = await structurePOST(post("http://t/api/ai/structure", { material: "abc" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "AI service unavailable", code: "AI_UNAVAILABLE" });
    expect(body).not.toHaveProperty("modules");
    expect(body).not.toHaveProperty("drafts");
  });
});

describe("POST /api/ai/questions", () => {
  it("401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await questionsPOST(
      post("http://t/api/ai/questions", { topicId: "t1", count: 3 }),
    );
    expect(res.status).toBe(401);
    expect(mockQuestions).not.toHaveBeenCalled();
  });

  it("404 when the topic is not owned", async () => {
    signedIn();
    mockGetOwnedTopic.mockResolvedValue(null);
    const res = await questionsPOST(
      post("http://t/api/ai/questions", { topicId: "nope", count: 3 }),
    );
    expect(res.status).toBe(404);
    expect(mockQuestions).not.toHaveBeenCalled();
  });

  it("400 NO_MATERIAL when the topic has no material", async () => {
    signedIn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetOwnedTopic.mockResolvedValue({ id: "t1", material: null } as any);
    const res = await questionsPOST(
      post("http://t/api/ai/questions", { topicId: "t1", count: 3 }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NO_MATERIAL");
    expect(mockQuestions).not.toHaveBeenCalled();
  });

  it("400 NO_MATERIAL when material is whitespace-only (the check trims)", async () => {
    signedIn();
    // `min(1)` lets "   " pass content validation, so the route must trim it
    // to reach NO_MATERIAL rather than send blank material to Gemini.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetOwnedTopic.mockResolvedValue({ id: "t1", material: "   \n\t " } as any);
    const res = await questionsPOST(
      post("http://t/api/ai/questions", { topicId: "t1", count: 3 }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NO_MATERIAL");
    expect(mockQuestions).not.toHaveBeenCalled();
  });

  it("200 passes gated drafts through", async () => {
    signedIn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetOwnedTopic.mockResolvedValue({ id: "t1", material: "real material" } as any);
    const drafts = { drafts: [{ type: "FLASHCARD", prompt: "p", back: "b" }] as const };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockQuestions.mockResolvedValue(drafts as any);
    const res = await questionsPOST(
      post("http://t/api/ai/questions", { topicId: "t1", count: 1 }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).drafts).toHaveLength(1);
    expect(mockQuestions).toHaveBeenCalledWith("real material", 1);
  });
});
