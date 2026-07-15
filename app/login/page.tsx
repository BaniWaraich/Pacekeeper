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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            PaceKeeper
          </span>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Set a goal and a date. We&apos;ll tell you the truth about whether
            you&apos;re on track.
          </p>
        </div>
        <LoginForm callbackUrl={safeCallbackUrl} />
      </div>
    </main>
  );
}
