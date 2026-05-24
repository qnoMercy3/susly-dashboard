import { DashboardApp } from "@/components/DashboardApp";
import { getEnvStatus } from "@/lib/env";

export default function CreatorsPage() {
  const env = getEnvStatus();

  return <DashboardApp configured={env.configured} currentTab="creators" missing={env.missing} />;
}
