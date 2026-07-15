import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader, pageClass } from "@/app/ui";
import { DashboardView } from "./dashboard-view";

/** The decision surface (SPEC 6.6): per-goal readiness + regime, computed on
 *  read through GET /api/goals/:id/dashboard?tz= — never stored (invariant #3). */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className={pageClass}>
      <PageHeader
        title="Dashboard"
        subtitle="Where every goal stands against its exam date — the honest version."
      />
      <DashboardView />
    </main>
  );
}
