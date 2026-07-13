import { LoginForm } from "./login-form";

export const metadata = { title: "Log in — PaceKeeper" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // Only follow same-origin paths — signIn(..., { redirect: false })
  // bypasses NextAuth's own callback-url validation, so an absolute or
  // protocol-relative URL here would be an open redirect.
  // v1: only relative paths accepted; NextAuth's absolute
  // callbackUrls are intentionally rejected in favor of /today.
  // If deep-link restore is ever needed, extend to accept
  // same-origin absolute URLs.
  const safeCallbackUrl =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/today";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Log in to PaceKeeper
        </h1>
        <LoginForm callbackUrl={safeCallbackUrl} />
      </div>
    </main>
  );
}
