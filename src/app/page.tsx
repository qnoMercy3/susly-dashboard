import { DashboardApp } from "@/components/DashboardApp";
import { getEnvStatus } from "@/lib/env";

export default function Home() {
  const env = getEnvStatus();

  return <DashboardApp configured={env.configured} missing={env.missing} />;
}
