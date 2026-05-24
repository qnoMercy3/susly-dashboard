import { DashboardApp } from "@/components/DashboardApp";
import { getEnvStatus } from "@/lib/env";

export default function OnboardingPage() {
  const env = getEnvStatus();

  return <DashboardApp configured={env.configured} currentTab="onboarding" missing={env.missing} />;
}
