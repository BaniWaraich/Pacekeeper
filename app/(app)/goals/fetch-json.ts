/** Client-side error carrying the §6 `{ error, code, fields }` envelope: the
 *  message stays human-readable (existing `err instanceof Error` catches keep
 *  working); `status`/`code` let screens branch on e.g. `AI_UNAVAILABLE`. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toApiError(status: number, data: unknown): ApiError {
  const envelope = data as { error?: string; code?: string; fields?: Record<string, string[]> } | null;
  const fields = envelope?.fields
    ? " — " +
      Object.entries(envelope.fields)
        .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
        .join("; ")
    : "";
  return new ApiError(
    (envelope?.error ?? `Request failed (${status})`) + fields,
    status,
    envelope?.code,
  );
}

/** Tiny client-side fetch wrapper for the §6 API: throws an `ApiError` whose
 *  message surfaces the `{ error, code, fields }` envelope. */
export async function fetchJson<T = unknown>(
  url: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw toApiError(res.status, await res.json().catch(() => null));
  }
  return res.json() as Promise<T>;
}

/** Multipart variant for POST /api/ingest/pdf — same envelope handling as
 *  `fetchJson`, but the browser sets the multipart boundary header itself. */
export async function uploadFile<T = unknown>(
  url: string,
  formData: FormData,
): Promise<T> {
  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) {
    throw toApiError(res.status, await res.json().catch(() => null));
  }
  return res.json() as Promise<T>;
}
