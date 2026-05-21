import { NextResponse, type NextRequest } from "next/server";

import { jsonError, requireAdmin } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase";
import type { AdminUser } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const AUTH_PAGE_SIZE = 200;

type UserUpdateInput = {
  id?: string;
  isDisabled?: boolean;
};

function isDisabledFromBannedUntil(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const supabase = getAdminSupabase();
    const rows: AdminUser[] = [];
    const disabledByUserId = new Map<string, boolean>();
    let from = 0;
    let authPage = 1;

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: authPage,
        perPage: AUTH_PAGE_SIZE,
      });

      if (error) {
        throw error;
      }

      for (const user of data.users) {
        disabledByUserId.set(user.id, isDisabledFromBannedUntil(user.banned_until));
      }

      if (data.users.length < AUTH_PAGE_SIZE) {
        break;
      }

      authPage += 1;
    }

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("users")
        .select(
          "id, email, created_at, subscription_status, subscription_tier, tracking_count, tracking_quota",
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      const page = (data ?? []).map((user) => ({
        ...user,
        country: null,
        is_disabled: disabledByUserId.get(user.id) ?? false,
      }));

      rows.push(...page);

      if ((data ?? []).length < PAGE_SIZE) {
        break;
      }

      from += PAGE_SIZE;
    }

    return NextResponse.json({ users: rows });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = (await request.json()) as UserUpdateInput;
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id || typeof body.isDisabled !== "boolean") {
      return NextResponse.json({ error: "User ID and disabled state are required." }, { status: 400 });
    }

    const { error } = await getAdminSupabase().auth.admin.updateUserById(id, {
      ban_duration: body.isDisabled ? "876000h" : "none",
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
