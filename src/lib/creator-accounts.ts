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

export async function listCreatorAccounts(): Promise<CreatorToolAccess[]> {
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
  const appAccessByUserId = new Map<string, boolean>();

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
    };
  });
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
