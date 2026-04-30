import { NextResponse, type NextRequest } from "next/server";

import { jsonError, requireAdmin } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase";
import type { AdminUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { data, error } = await getAdminSupabase()
      .from("users")
      .select("id, email, created_at, subscription_status, subscription_tier, tracking_count, tracking_quota")
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) {
      throw error;
    }

    const users: AdminUser[] = (data ?? []).map((user) => ({
      ...user,
      country: null,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    return jsonError(error);
  }
}
