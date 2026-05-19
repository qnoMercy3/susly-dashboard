import { NextResponse, type NextRequest } from "next/server";

import { jsonError, requireAdmin } from "@/lib/admin-auth";
import { requireEnv } from "@/lib/env";
import { getAdminSupabase } from "@/lib/supabase";
import type { CreatorToolAccess } from "@/lib/types";

export const dynamic = "force-dynamic";

type CreatorProvisionInput = {
  email?: string;
};

type CreatorUpdateInput = {
  id?: string;
  isActive?: boolean;
};

type ProvisionResponse = {
  success?: boolean;
  mode?: "created" | "updated";
  email?: string;
  userId?: string;
  mockAccountId?: string;
  appPassword?: string;
  generatedAccessCode?: string;
  error?: string;
};

async function invokeProvisionFunction(
  input: CreatorProvisionInput,
  authorizationHeader: string,
): Promise<ProvisionResponse> {
  const response = await fetch(`${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/functions/v1/admin-create-creator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorizationHeader,
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as ProvisionResponse;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? "Failed to provision creator.");
  }

  return payload;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const supabase = getAdminSupabase();
    const { data: creatorRows, error: creatorError } = await supabase
      .from("creator_tool_access")
      .select("id, email, mock_account_id, is_active, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (creatorError) {
      throw creatorError;
    }

    const creators = (creatorRows ?? []) as Array<Record<string, unknown>>;
    const mockAccountIds = creators
      .map((row) => (typeof row.mock_account_id === "string" ? row.mock_account_id : null))
      .filter((value): value is string => Boolean(value));

    const mockAccountsById = new Map<string, { user_id: string | null }>();
    const usersById = new Map<
      string,
      {
        subscription_status: string | null;
        subscription_tier: string | null;
        tracking_quota: number | null;
      }
    >();

    if (mockAccountIds.length > 0) {
      const { data: mockAccountRows, error: mockAccountError } = await supabase
        .from("mock_accounts")
        .select("id, user_id")
        .in("id", mockAccountIds);

      if (mockAccountError) {
        throw mockAccountError;
      }

      const userIds = (mockAccountRows ?? [])
        .map((row) => (typeof row.user_id === "string" ? row.user_id : null))
        .filter((value): value is string => Boolean(value));

      (mockAccountRows ?? []).forEach((row) => {
        mockAccountsById.set(String(row.id), {
          user_id: typeof row.user_id === "string" ? row.user_id : null,
        });
      });

      if (userIds.length > 0) {
        const { data: userRows, error: userError } = await supabase
          .from("users")
          .select("id, subscription_status, subscription_tier, tracking_quota")
          .in("id", userIds);

        if (userError) {
          throw userError;
        }

        (userRows ?? []).forEach((row) => {
          usersById.set(String(row.id), {
            subscription_status:
              typeof row.subscription_status === "string" ? row.subscription_status : null,
            subscription_tier:
              typeof row.subscription_tier === "string" ? row.subscription_tier : null,
            tracking_quota: typeof row.tracking_quota === "number" ? row.tracking_quota : null,
          });
        });
      }
    }

    const payload: CreatorToolAccess[] = creators.map((row) => {
      const mockAccountId = String(row.mock_account_id);
      const mockAccount = mockAccountsById.get(mockAccountId);
      const appUserId = mockAccount?.user_id ?? null;
      const appUser = appUserId ? usersById.get(appUserId) : null;

      return {
        id: String(row.id),
        email: String(row.email),
        mock_account_id: mockAccountId,
        app_user_id: appUserId,
        is_active: Boolean(row.is_active),
        created_at: typeof row.created_at === "string" ? row.created_at : null,
        updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
        subscription_status: appUser?.subscription_status ?? null,
        subscription_tier: appUser?.subscription_tier ?? null,
        tracking_quota: appUser?.tracking_quota ?? null,
      };
    });

    return NextResponse.json({ creators: payload });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = (await request.json()) as CreatorProvisionInput;
    const authorizationHeader = request.headers.get("authorization") ?? "";
    const result = await invokeProvisionFunction(body, authorizationHeader);

    return NextResponse.json({
      success: true,
      mode: result.mode,
      email: result.email,
      userId: result.userId,
      mockAccountId: result.mockAccountId,
      appPassword: result.appPassword,
      generatedAccessCode: result.generatedAccessCode,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = (await request.json()) as CreatorUpdateInput;
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id || typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "Creator ID and active state are required." }, { status: 400 });
    }

    const supabase = getAdminSupabase();

    const { data: creatorAccess, error: creatorLookupError } = await supabase
      .from("creator_tool_access")
      .select("mock_account_id")
      .eq("id", id)
      .maybeSingle();

    if (creatorLookupError) {
      throw creatorLookupError;
    }

    if (!creatorAccess?.mock_account_id) {
      return NextResponse.json({ error: "Creator record not found." }, { status: 404 });
    }

    const { data: mockAccount, error: mockAccountError } = await supabase
      .from("mock_accounts")
      .select("user_id")
      .eq("id", creatorAccess.mock_account_id)
      .maybeSingle();

    if (mockAccountError) {
      throw mockAccountError;
    }

    const { error } = await supabase
      .from("creator_tool_access")
      .update({ is_active: body.isActive })
      .eq("id", id);

    if (error) {
      throw error;
    }

    if (mockAccount?.user_id) {
      const { error: authError } = await supabase.auth.admin.updateUserById(mockAccount.user_id, {
        ban_duration: body.isActive ? "none" : "876000h",
      });

      if (authError) {
        throw authError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
