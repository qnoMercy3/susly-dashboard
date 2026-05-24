import { NextResponse, type NextRequest } from "next/server";

import {
  breakdown,
  DASHBOARD_CACHE_TTL_MS,
  fetchAllRows,
  getDashboardStartDate,
} from "@/lib/admin-dashboard-data";
import { jsonError, requireAdmin } from "@/lib/admin-auth";
import type { OnboardingData } from "@/lib/types";

export const dynamic = "force-dynamic";

let onboardingCache: { expiresAt: number; data: OnboardingData } | null = null;

async function buildOnboardingData(): Promise<OnboardingData> {
  const rows = await fetchAllRows<Record<string, unknown>>(
    "onboarding_answers",
    "identity_answer, watch_relationship_answer, why_answer, worry_answer, betrayal_history_answer, created_at",
    {
      gte: { column: "created_at", value: getDashboardStartDate().toISOString() },
      order: { column: "created_at", ascending: true },
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    onboardingBreakdowns: {
      identity: breakdown(rows, "identity_answer"),
      relationship: breakdown(rows, "watch_relationship_answer"),
      reason: breakdown(rows, "why_answer"),
      worry: breakdown(rows, "worry_answer"),
      history: breakdown(rows, "betrayal_history_answer"),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    if (onboardingCache && onboardingCache.expiresAt > Date.now()) {
      return NextResponse.json(onboardingCache.data);
    }

    const data = await buildOnboardingData();
    onboardingCache = {
      data,
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    };

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
