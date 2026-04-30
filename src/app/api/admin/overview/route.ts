import { NextResponse, type NextRequest } from "next/server";

import { jsonError, requireAdmin } from "@/lib/admin-auth";
import { normalizeDateKey } from "@/lib/format";
import { getAdminSupabase } from "@/lib/supabase";
import type { BreakdownPoint, OverviewData, TrendPoint } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAYS = 30;

function getStartDate() {
  const start = new Date();
  start.setDate(start.getDate() - (DAYS - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildEmptyTrend(): TrendPoint[] {
  const start = getStartDate();

  return Array.from({ length: DAYS }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date: date.toISOString().slice(0, 10),
      downloads: 0,
      users: 0,
      onboarding: 0,
    };
  });
}

function incrementTrend(
  trends: TrendPoint[],
  rows: Array<{ created_at?: string | null }>,
  key: "downloads" | "users" | "onboarding",
) {
  const byDate = new Map(trends.map((point) => [point.date, point]));

  rows.forEach((row) => {
    if (!row.created_at) {
      return;
    }

    const point = byDate.get(normalizeDateKey(row.created_at));

    if (point) {
      point[key] += 1;
    }
  });
}

function breakdown(
  rows: Array<Record<string, unknown>>,
  key: string,
  fallback = "Unknown",
): BreakdownPoint[] {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const raw = row[key];
    const label = typeof raw === "string" && raw ? raw : fallback;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

type CountFilter =
  | { kind: "eq"; column: string; value: string | boolean }
  | { kind: "in"; column: string; value: string[] };

async function countRows(table: string, filter?: CountFilter) {
  const supabase = getAdminSupabase();
  let request = supabase.from(table).select("*", { count: "exact", head: true });

  if (filter?.kind === "eq") {
    request = request.eq(filter.column, filter.value);
  }

  if (filter?.kind === "in") {
    request = request.in(filter.column, filter.value);
  }

  const { count, error } = await request;

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const supabase = getAdminSupabase();
    const startIso = getStartDate().toISOString();

    const [
      downloads,
      users,
      onboardingCompletions,
      activeOrTrialUsers,
      trackedProfiles,
      activeTrackingRelationships,
      mockAccounts,
      mockProfiles,
      pendingScrapes,
      failedScrapes,
      downloadsTrend,
      usersTrend,
      onboardingRows,
      subscriptions,
      scrapeStatuses,
    ] = await Promise.all([
      countRows("app_analytics", { kind: "eq", column: "event_type", value: "download" }),
      countRows("users"),
      countRows("onboarding_answers"),
      countRows("users", { kind: "in", column: "subscription_status", value: ["active", "trial"] }),
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
      supabase
        .from("app_analytics")
        .select("created_at")
        .eq("event_type", "download")
        .gte("created_at", startIso)
        .order("created_at", { ascending: true }),
      supabase
        .from("users")
        .select("created_at")
        .gte("created_at", startIso)
        .order("created_at", { ascending: true }),
      supabase
        .from("onboarding_answers")
        .select(
          "created_at, identity_answer, watch_relationship_answer, why_answer, worry_answer, betrayal_history_answer",
        )
        .gte("created_at", startIso)
        .order("created_at", { ascending: true }),
      supabase.from("users").select("subscription_status"),
      supabase.from("tracking_requests").select("status"),
    ]);

    const trends = buildEmptyTrend();
    incrementTrend(trends, downloadsTrend.data ?? [], "downloads");
    incrementTrend(trends, usersTrend.data ?? [], "users");
    incrementTrend(trends, onboardingRows.data ?? [], "onboarding");

    const onboardingData = (onboardingRows.data ?? []) as Array<Record<string, unknown>>;
    const subscriptionData = (subscriptions.data ?? []) as Array<Record<string, unknown>>;
    const scrapeData = (scrapeStatuses.data ?? []) as Array<Record<string, unknown>>;

    const data: OverviewData = {
      generatedAt: new Date().toISOString(),
      stats: {
        downloads,
        users,
        onboardingCompletions,
        completionRate: downloads > 0 ? (onboardingCompletions / downloads) * 100 : 0,
        activeOrTrialUsers,
        trackedProfiles,
        activeTrackingRelationships,
        mockAccounts,
        mockProfiles,
        pendingScrapes,
        failedScrapes,
      },
      trends,
      onboardingBreakdowns: {
        identity: breakdown(onboardingData, "identity_answer"),
        relationship: breakdown(onboardingData, "watch_relationship_answer"),
        reason: breakdown(onboardingData, "why_answer"),
        worry: breakdown(onboardingData, "worry_answer"),
        history: breakdown(onboardingData, "betrayal_history_answer"),
      },
      subscriptionBreakdown: breakdown(subscriptionData, "subscription_status"),
      scrapeStatusBreakdown: breakdown(scrapeData, "status"),
    };

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
