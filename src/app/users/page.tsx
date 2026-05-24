import { DashboardApp } from "@/components/DashboardApp";
import { getEnvStatus } from "@/lib/env";

export default function UsersPage() {
  const env = getEnvStatus();

  return <DashboardApp configured={env.configured} currentTab="users" missing={env.missing} />;
}
