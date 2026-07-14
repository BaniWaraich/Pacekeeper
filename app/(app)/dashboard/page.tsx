import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardView } from "./dashboard-view";

/** The decision surface (SPEC 6.6): per-goal readiness + regime, computed on
 *  read through GET /api/goals/:id/dashboard?tz= — never stored (invariant #3). */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
      </header>
      <DashboardView />
    </main>
  );
}
