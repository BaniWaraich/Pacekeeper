import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader, pageClass } from "@/app/ui";
import { TodayView } from "./today-view";

/** The Today view (§5.4, §6.2) — the daily accountability unit. Data loads
 *  client-side through GET /api/goals/:id/today?tz= (§6 defines the route;
 *  the browser is the only place the user's timezone is knowable). */
export default async function TodayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className={pageClass}>
      <PageHeader
        title="Today"
        subtitle="Your reviews and new topics for the day — one place, in order."
      />
      <TodayView />
    </main>
  );
}
