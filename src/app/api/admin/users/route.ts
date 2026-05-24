import { NextResponse, type NextRequest } from "next/server";

import { jsonError, requireAdmin } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase";
import type { AdminUser } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const supabase = getAdminSupabase();
    const url = new URL(request.url);
    const offsetValue = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
    const limitValue = Number.parseInt(url.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);
    const offset = Number.isFinite(offsetValue) && offsetValue > 0 ? offsetValue : 0;
    const limit =
      Number.isFinite(limitValue) && limitValue > 0
        ? Math.min(limitValue, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;
    const to = offset + limit - 1;

    const { data, error } = await supabase
      .from("users")
      .select(
        "id, email, created_at, subscription_status, subscription_tier, tracking_count, tracking_quota",
      )
      .order("created_at", { ascending: false })
      .range(offset, to);

    if (error) {
      throw error;
    }

    const users: AdminUser[] = (data ?? []).map((user) => ({
      ...user,
      country: null,
      is_disabled: false,
    }));

    return NextResponse.json({
      users,
      nextOffset: offset + users.length,
      hasMore: users.length === limit,
    });
  } catch (error) {
    return jsonError(error);
  }
}
