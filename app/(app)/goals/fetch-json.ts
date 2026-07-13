/** Tiny client-side fetch wrapper for the §6 API: throws an Error whose
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
    const data = await res.json().catch(() => null);
    const fields = data?.fields
      ? " — " +
        Object.entries(data.fields as Record<string, string[]>)
          .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
          .join("; ")
      : "";
    throw new Error((data?.error ?? `Request failed (${res.status})`) + fields);
  }
  return res.json() as Promise<T>;
}
