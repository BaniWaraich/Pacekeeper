import Link from "next/link";
import { signOut } from "@/auth";

/** Shared shell for the authenticated group: top nav + sign-out. Pages keep
 *  their own headers; this only stops every screen hand-rolling the links. */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navLink =
    "text-sm text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/today"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
            >
              PaceKeeper
            </Link>
            <div className="flex gap-5">
              <Link href="/today" className={navLink}>
                Today
              </Link>
              <Link href="/dashboard" className={navLink}>
                Dashboard
              </Link>
              <Link href="/goals" className={navLink}>
                Goals
              </Link>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className={navLink}>
              Sign out
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
