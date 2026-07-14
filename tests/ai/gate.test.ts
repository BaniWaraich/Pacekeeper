/**
 * lib/ai/gate.ts tests — the reject-not-repair boundary.
 *
 * The Gemini seam (`generateJson`) is mocked, so no live API is touched. The
 * REAL Zod schemas (§6.3) run, so these tests exercise the actual gate:
 *   - valid response → drafts pass
 *   - malformed JSON → exactly ONE retry, then throw
 *   - schema-invalid (7 options / out-of-range correctIndex / unknown type) →
 *     retry then throw, and the invalid draft is never surfaced
 *   - retry recovers → resolves with the corrected value (retry fires once)
 *   - transport/429/timeout (seam throws AiUnavailableError) → ZERO retries
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/gemini", () => ({ generateJson: vi.fn() }));

import { generateJson } from "@/lib/ai/gemini";
import { proposeStructure, proposeQuestions } from "@/lib/ai/gate";
import { AiUnavailableError } from "@/lib/ai/errors";

const mockGenerate = vi.mocked(generateJson);

const VALID_STRUCTURE = JSON.stringify({
  modules: [{ title: "Module 1", topics: [{ title: "Topic 1" }] }],
});
const VALID_QUESTIONS = JSON.stringify({
  drafts: [
    { type: "FLASHCARD", prompt: "What is X?", back: "X is Y." },
    { type: "MCQ", prompt: "Pick A", options: ["A", "B"], correctIndex: 0 },
  ],
});

// A recognisable invalid draft used to prove it never leaks out of the gate.
const SEVEN_OPTIONS = {
  type: "MCQ",
  prompt: "too many",
  options: ["1", "2", "3", "4", "5", "6", "7"],
  correctIndex: 0,
};
const INVALID_QUESTION_PAYLOADS = {
  "7 options": JSON.stringify({ drafts: [SEVEN_OPTIONS] }),
  "out-of-range correctIndex": JSON.stringify({
    drafts: [{ type: "MCQ", prompt: "q", options: ["a", "b"], correctIndex: 5 }],
  }),
  "unknown type": JSON.stringify({
    drafts: [{ type: "TRUEFALSE", prompt: "q" }],
  }),
};

beforeEach(() => {
  mockGenerate.mockReset();
});

describe("proposeStructure", () => {
  it("passes a valid response through the gate", async () => {
    mockGenerate.mockResolvedValueOnce(VALID_STRUCTURE);
    const result = await proposeStructure("some material");
    expect(result).toEqual({
      modules: [{ title: "Module 1", topics: [{ title: "Topic 1" }] }],
    });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});

describe("proposeQuestions", () => {
  it("passes a valid response through the gate", async () => {
    mockGenerate.mockResolvedValueOnce(VALID_QUESTIONS);
    const result = await proposeQuestions("material", 2);
    expect(result.drafts).toHaveLength(2);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("malformed JSON → exactly one retry, then throws AiUnavailableError", async () => {
    mockGenerate
      .mockResolvedValueOnce("not json at all {{{")
      .mockResolvedValueOnce("still not json");
    await expect(proposeQuestions("material", 1)).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it("recovers when the retry returns valid JSON (retry fires once)", async () => {
    mockGenerate
      .mockResolvedValueOnce("garbage")
      .mockResolvedValueOnce(VALID_QUESTIONS);
    const result = await proposeQuestions("material", 2);
    expect(result.drafts).toHaveLength(2);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  for (const [label, payload] of Object.entries(INVALID_QUESTION_PAYLOADS)) {
    it(`schema-invalid (${label}) → retry then throw, invalid draft never surfaced`, async () => {
      mockGenerate.mockResolvedValue(payload); // both attempts return it
      const call = proposeQuestions("material", 1);
      await expect(call).rejects.toBeInstanceOf(AiUnavailableError);
      expect(mockGenerate).toHaveBeenCalledTimes(2);
      // The rejection carries no draft payload — only a field-error summary.
      await call.catch((e: unknown) => {
        expect(e).toBeInstanceOf(AiUnavailableError);
        expect((e as Error).message).not.toContain('"1","2","3"');
      });
    });
  }

  it("transport/429/timeout (seam throws) → ZERO retries, straight to unavailable", async () => {
    mockGenerate.mockRejectedValueOnce(
      new AiUnavailableError("Gemini request failed"),
    );
    await expect(proposeQuestions("material", 1)).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
