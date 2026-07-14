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
    "text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <nav className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
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
