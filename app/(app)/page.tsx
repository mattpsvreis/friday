import { DashboardView } from "@/components/dashboard-view";
import { PageHeading } from "@/components/page-heading";

export default function DashboardPage() {
  return (
    <div>
      <PageHeading
        title="Dashboard"
        description="Pick a calendar month for snapshots, predicted spend, card limits, and expected cash."
      />
      <DashboardView />
    </div>
  );
}
