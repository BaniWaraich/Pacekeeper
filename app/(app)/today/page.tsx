import Link from "next/link";
import { auth, signOut } from "@/auth";

// Placeholder so the (app) route group exists for the proxy to protect.
// Replaced by the real Today view in the study-loop step.
export default async function TodayPage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Today
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as {session?.user?.email} (id: {session?.user?.id})
      </p>
      <Link
        href="/goals"
        className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Goals
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
