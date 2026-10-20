import OverviewPageClient from "./OverviewPageClient";

// Phase 3 (audit O-01 / S-01): /dashboard is the Overview screen.
// Endpoint & Key keeps living at /dashboard/endpoint (its own page.js
// supplies the machineId EndpointPageClient expects).
export default function DashboardPage() {
  return <OverviewPageClient />;
}
