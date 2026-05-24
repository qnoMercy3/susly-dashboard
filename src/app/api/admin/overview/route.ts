import { NextResponse, type NextRequest } from "next/server";

import {
  buildEmptyTrend,
  countRows,
  DASHBOARD_CACHE_TTL_MS,
  fetchAllRows,
  getDashboardStartDate,
  incrementTrend,
} from "@/lib/admin-dashboard-data";
import { jsonError, requireAdmin } from "@/lib/admin-auth";
import type { OverviewData } from "@/lib/types";

export const dynamic = "force-dynamic";

let overviewCache: { expiresAt: number; data: OverviewData } | null = null;

async function buildOverviewData(): Promise<OverviewData> {
  const startIso = getDashboardStartDate().toISOString();

  const [
    downloads,
    users,
    onboardingCompletions,
    activeUsers,
    trialUsers,
    trackedProfiles,
    activeTrackingRelationships,
    mockAccounts,
    mockProfiles,
    pendingScrapes,
    failedScrapes,
    downloadsTrend,
    usersTrend,
    onboardingTrend,
  ] = await Promise.all([
    countRows("app_analytics", { kind: "eq", column: "event_type", value: "download" }),
    countRows("users"),
    countRows("onboarding_answers"),
    countRows("users", { kind: "eq", column: "subscription_status", value: "active" }),
    countRows("users", { kind: "eq", column: "subscription_status", value: "trial" }),
    countRows("profiles"),
    countRows("user_profiles", { kind: "eq", column: "tracking_enabled", value: true }),
    countRows("mock_accounts"),
    countRows("mock_target_data"),
    countRows("tracking_requests", {
      kind: "in",
      column: "status",
      value: ["pending", "processing", "in_progress"],
    }),
    countRows("tracking_requests", { kind: "eq", column: "status", value: "failed" }),
    fetchAllRows<{ created_at?: string | null }>("app_analytics", "created_at", {
      filter: { kind: "eq", column: "event_type", value: "download" },
      gte: { column: "created_at", value: startIso },
      order: { column: "created_at", ascending: true },
    }),
    fetchAllRows<{ created_at?: string | null }>("users", "created_at", {
      gte: { column: "created_at", value: startIso },
      order: { column: "created_at", ascending: true },
    }),
    fetchAllRows<{ created_at?: string | null }>("onboarding_answers", "created_at", {
      gte: { column: "created_at", value: startIso },
      order: { column: "created_at", ascending: true },
    }),
  ]);

  const trends = buildEmptyTrend();
  incrementTrend(trends, downloadsTrend, "downloads");
  incrementTrend(trends, usersTrend, "users");
  incrementTrend(trends, onboardingTrend, "onboarding");

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      downloads,
      users,
      onboardingCompletions,
      completionRate: downloads > 0 ? (onboardingCompletions / downloads) * 100 : 0,
      activeOrTrialUsers: activeUsers + trialUsers,
      trackedProfiles,
      activeTrackingRelationships,
      mockAccounts,
      mockProfiles,
      pendingScrapes,
      failedScrapes,
    },
    trends,
    onboardingBreakdowns: {
      identity: [],
      relationship: [],
      reason: [],
      worry: [],
      history: [],
    },
    subscriptionBreakdown: [],
    scrapeStatusBreakdown: [],
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    if (overviewCache && overviewCache.expiresAt > Date.now()) {
      return NextResponse.json(overviewCache.data);
    }

    const data = await buildOverviewData();
    overviewCache = {
      data,
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    };

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
