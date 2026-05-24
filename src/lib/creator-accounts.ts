import { getAdminSupabase } from "@/lib/supabase";
import type { CreatorToolAccess } from "@/lib/types";

const CREATOR_ACCOUNT_BAN_DURATION = "876000h";

function isBanned(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

async function loadCreatorAccessRows(supabase: ReturnType<typeof getAdminSupabase>) {
  const columns =
    "id, email, mock_account_id, is_active, creator_tool_login_completed_at, created_at, updated_at";
  const response = await supabase
    .from("creator_tool_access")
    .select(columns)
    .order("created_at", { ascending: false });

  if (!response.error) {
    return response.data ?? [];
  }

  if (!response.error.message.includes("creator_tool_login_completed_at")) {
    throw response.error;
  }

  const fallbackResponse = await supabase
    .from("creator_tool_access")
    .select("id, email, mock_account_id, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (fallbackResponse.error) {
    throw fallbackResponse.error;
  }

  return fallbackResponse.data ?? [];
}

export async function listCreatorAccounts(): Promise<CreatorToolAccess[]> {
  const supabase = getAdminSupabase();
  const creators = (await loadCreatorAccessRows(supabase)) as Array<Record<string, unknown>>;
  const mockAccountIds = creators
    .map((row) => (typeof row.mock_account_id === "string" ? row.mock_account_id : null))
    .filter((value): value is string => Boolean(value));

  const mockAccountsById = new Map<
    string,
    { user_id: string | null; app_login_completed_at: string | null }
  >();
  const usersById = new Map<
    string,
    {
      subscription_status: string | null;
      subscription_tier: string | null;
      tracking_quota: number | null;
    }
  >();
  const appAccessByUserId = new Map<string, boolean>();

  if (mockAccountIds.length > 0) {
    const { data: mockAccountRows, error: mockAccountError } = await supabase
      .from("mock_accounts")
      .select("id, user_id, app_login_completed_at")
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
        app_login_completed_at:
          typeof row.app_login_completed_at === "string" ? row.app_login_completed_at : null,
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

      await Promise.all(
        [...new Set(userIds)].map(async (userId) => {
          const { data, error } = await supabase.auth.admin.getUserById(userId);

          if (error) {
            throw error;
          }

          appAccessByUserId.set(userId, !isBanned(data.user?.banned_until));
        }),
      );
    }
  }

  return creators.map((row) => {
    const mockAccountId = String(row.mock_account_id);
    const mockAccount = mockAccountsById.get(mockAccountId);
    const appUserId = mockAccount?.user_id ?? null;
    const appUser = appUserId ? usersById.get(appUserId) : null;
    const appLoginCompletedAt = mockAccount?.app_login_completed_at ?? null;
    const creatorToolLoginCompletedAt =
      typeof row.creator_tool_login_completed_at === "string"
        ? row.creator_tool_login_completed_at
        : null;

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
      app_access_enabled: appUserId ? (appAccessByUserId.get(appUserId) ?? null) : null,
      app_login_completed: Boolean(appLoginCompletedAt),
      app_login_completed_at: appLoginCompletedAt,
      creator_tool_login_completed: Boolean(creatorToolLoginCompletedAt),
      creator_tool_login_completed_at: creatorToolLoginCompletedAt,
    };
  });
}

export async function markCreatorAppLoginCompleted(id: string) {
  const supabase = getAdminSupabase();
  const { data: creatorAccess, error: creatorLookupError } = await supabase
    .from("creator_tool_access")
    .select("mock_account_id")
    .eq("id", id)
    .maybeSingle();

  if (creatorLookupError) {
    throw creatorLookupError;
  }

  const mockAccountId = creatorAccess?.mock_account_id ?? id;

  const { error } = await supabase
    .from("mock_accounts")
    .update({
      app_login_completed_at: new Date().toISOString(),
    })
    .eq("id", mockAccountId);

  if (error) {
    throw error;
  }
}

export async function markCreatorToolLoginCompleted(id: string) {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("creator_tool_access")
    .update({
      creator_tool_login_completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function setCreatorAccountEnabledState(id: string, enabled: boolean) {
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
    throw new Error("Creator record not found.");
  }

  const { data: mockAccount, error: mockAccountError } = await supabase
    .from("mock_accounts")
    .select("user_id")
    .eq("id", creatorAccess.mock_account_id)
    .maybeSingle();

  if (mockAccountError) {
    throw mockAccountError;
  }

  const { error: creatorUpdateError } = await supabase
    .from("creator_tool_access")
    .update({ is_active: enabled })
    .eq("id", id);

  if (creatorUpdateError) {
    throw creatorUpdateError;
  }

  if (mockAccount?.user_id) {
    const { error: authError } = await supabase.auth.admin.updateUserById(mockAccount.user_id, {
      ban_duration: enabled ? "none" : CREATOR_ACCOUNT_BAN_DURATION,
    });

    if (authError) {
      throw authError;
    }
  }
}
