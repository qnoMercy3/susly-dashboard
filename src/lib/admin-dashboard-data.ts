import { normalizeDateKey } from "@/lib/format";
import { getAdminSupabase } from "@/lib/supabase";
import type { BreakdownPoint, TrendPoint } from "@/lib/types";

export const DASHBOARD_CACHE_TTL_MS = 60_000;
export const DASHBOARD_DAYS = 30;
const PAGE_SIZE = 1000;

export type CountFilter =
  | { kind: "eq"; column: string; value: string | boolean }
  | { kind: "in"; column: string; value: string[] };

export function getDashboardStartDate() {
  const start = new Date();
  start.setDate(start.getDate() - (DASHBOARD_DAYS - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function buildEmptyTrend(): TrendPoint[] {
  const start = getDashboardStartDate();

  return Array.from({ length: DASHBOARD_DAYS }, (_, index) => {
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

export function incrementTrend(
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

export function breakdown(
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

export async function countRows(table: string, filter?: CountFilter) {
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

export async function fetchAllRows<T extends Record<string, unknown>>(
  table: string,
  columns: string,
  options?: {
    filter?: CountFilter;
    gte?: { column: string; value: string };
    order?: { column: string; ascending: boolean };
  },
) {
  const supabase = getAdminSupabase();
  const rows: T[] = [];
  let from = 0;

  while (true) {
    let request = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);

    if (options?.filter?.kind === "eq") {
      request = request.eq(options.filter.column, options.filter.value);
    }

    if (options?.filter?.kind === "in") {
      request = request.in(options.filter.column, options.filter.value);
    }

    if (options?.gte) {
      request = request.gte(options.gte.column, options.gte.value);
    }

    if (options?.order) {
      request = request.order(options.order.column, { ascending: options.order.ascending });
    }

    const { data, error } = await request;

    if (error) {
      throw error;
    }

    const page = (data ?? []) as unknown as T[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}
