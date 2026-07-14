import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { badRequest } from "@/lib/api-errors";

/**
 * POST /api/ingest/pdf (§6.3) — server-side text extraction from an uploaded PDF.
 * Returns `{ text }` for the client to paste into the structure flow. Gemini
 * NEVER receives files — only the extracted plain text, later, as data.
 *
 * This route does NOT call Gemini, so it has no `GEMINI_API_KEY` dependency and
 * survives the key-pull: pulling the key breaks exactly the two AI buttons
 * (structure, questions), not PDF ingest (§8 #1). Its only failure surface is a
 * clean 400 — no 503.
 *
 * Caps are enforced with 400s, never silent truncation (route-layer, per the
 * validations.ts contract): file bytes ≤ 10 MB (§6.3) and extracted text length
 * ≤ 100k (mirrors the §6.3 `material` bound the structure endpoint accepts).
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (§6.3)
const MAX_TEXT_LENGTH = 100_000; // matches MATERIAL_MAX / §6.3 material bound

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return badRequest("Expected multipart/form-data with a file", "BAD_UPLOAD");
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return badRequest("Missing 'file' field", "BAD_UPLOAD");
    }
    if (file.size > MAX_FILE_BYTES) {
      return badRequest("PDF exceeds 10 MB", "FILE_TOO_LARGE");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Guard against a mismatched/streamed size after reading, too.
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return badRequest("PDF exceeds 10 MB", "FILE_TOO_LARGE");
    }

    let text: string;
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      text = result.text?.trim() ?? "";
    } catch {
      return badRequest("Could not read PDF", "PDF_PARSE_FAILED");
    } finally {
      await parser.destroy();
    }

    if (text.length === 0) {
      // No extractable text (e.g. a scanned/image-only PDF).
      return badRequest("No extractable text in PDF", "PDF_PARSE_FAILED");
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return badRequest("Extracted text is too long", "TEXT_TOO_LONG");
    }

    return NextResponse.json({ text }, { status: 200 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
