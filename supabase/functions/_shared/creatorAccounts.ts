import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

export const creatorCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

const subscriptionStatus = "active";
const subscriptionTier = "exclusive_annual";
const trackingQuota = 3;
const creatorAccountBanDuration = "876000h";

export class CreatorAccountsError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function creatorJson(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...creatorCorsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function createAdminSupabaseClient() {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!serviceRoleKey || !supabaseUrl) {
    throw new CreatorAccountsError(500, "Creator management is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function generateAccessCode() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return bytesToHex(signature);
}

function isBanned(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

async function loadCreatorAccessRows(supabase: ReturnType<typeof createClient>) {
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
    throw new CreatorAccountsError(500, `Unable to load creators: ${response.error.message}`);
  }

  const fallbackResponse = await supabase
    .from("creator_tool_access")
    .select("id, email, mock_account_id, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (fallbackResponse.error) {
    throw new CreatorAccountsError(500, `Unable to load creators: ${fallbackResponse.error.message}`);
  }

  return fallbackResponse.data ?? [];
}

async function findAuthUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new CreatorAccountsError(500, `Unable to inspect auth users: ${error.message}`);
    }

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) {
      return match;
    }

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return null;
}

export async function requireAdminSession(
  supabase: ReturnType<typeof createClient>,
  authorizationHeader: string,
) {
  const adminEmails = (Deno.env.get("ADMIN_EMAILS") ?? "admin@susly.app")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const token = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7)
    : "";

  if (!token) {
    throw new CreatorAccountsError(401, "Missing admin session.");
  }

  const { data: authUserData, error: authUserError } = await supabase.auth.getUser(token);

  if (authUserError || !authUserData.user?.email) {
    throw new CreatorAccountsError(401, "Invalid or expired admin session.");
  }

  if (!adminEmails.includes(authUserData.user.email.trim().toLowerCase())) {
    throw new CreatorAccountsError(403, "This account is not allowed to provision creators.");
  }
}

export async function requireClientApiKey(authorizationHeader: string) {
  const token = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";
  const expected = Deno.env.get("CLIENT_CREATORS_API_KEY")?.trim() ?? "";

  if (!token) {
    throw new CreatorAccountsError(401, "Missing bearer token.");
  }

  if (!expected || token !== expected) {
    throw new CreatorAccountsError(401, "Invalid API key.");
  }
}

export async function provisionCreatorAccount(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  const mockUserPassword = Deno.env.get("MOCK_USER_PASSWORD");
  const accessCodePepper =
    Deno.env.get("CREATOR_ACCESS_CODE_PEPPER") ?? "susly-creator-access-v1";

  if (!mockUserPassword) {
    throw new CreatorAccountsError(500, "MOCK_USER_PASSWORD is not configured.");
  }

  const existingCreatorAccessResponse = await supabase
    .from("creator_tool_access")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingCreatorAccessResponse.error) {
    throw new CreatorAccountsError(500, `Unable to load creator access: ${existingCreatorAccessResponse.error.message}`);
  }

  const existingCreatorAccessId = existingCreatorAccessResponse.data?.id ?? null;
  const authUser = (await findAuthUserByEmail(supabase, email)) || null;

  let userId = authUser?.id ?? null;
  let mode: "created" | "updated" = existingCreatorAccessId ? "updated" : "created";

  if (authUser) {
    const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
      email,
      password: mockUserPassword,
      email_confirm: true,
      ban_duration: "none",
      user_metadata: {
        ...authUser.user_metadata,
        role: "creator",
      },
    });

      if (error) {
      throw new CreatorAccountsError(500, `Unable to update auth user: ${error.message}`);
      }
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: mockUserPassword,
      email_confirm: true,
      user_metadata: {
        role: "creator",
      },
    });

    if (error || !data.user) {
      throw new CreatorAccountsError(500, error?.message ?? "Unable to create auth user.");
    }

    userId = data.user.id;
  }

  if (!userId) {
    throw new CreatorAccountsError(500, "Unable to resolve auth user ID.");
  }

  const { error: userError } = await supabase.from("users").upsert({
    id: userId,
    email,
    subscription_status: subscriptionStatus,
    subscription_tier: subscriptionTier,
    tracking_quota: trackingQuota,
    updated_at: new Date().toISOString(),
  });

  if (userError) {
    throw new CreatorAccountsError(500, `Unable to upsert app user: ${userError.message}`);
  }

  const { data: mockAccount, error: mockAccountError } = await supabase
    .from("mock_accounts")
    .upsert(
      {
        user_id: userId,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();

  if (mockAccountError || !mockAccount?.id) {
    throw new CreatorAccountsError(500, mockAccountError?.message ?? "Unable to create mock account.");
  }

  const accessCode = generateAccessCode();
  const accessCodeHash = await hmacSha256Hex(accessCodePepper, accessCode);

  if (existingCreatorAccessId) {
    const { error } = await supabase
      .from("creator_tool_access")
      .update({
        mock_account_id: mockAccount.id,
        access_code_hash: accessCodeHash,
        is_active: true,
      })
      .eq("id", existingCreatorAccessId);

      if (error) {
        throw new CreatorAccountsError(500, `Unable to update creator access: ${error.message}`);
      }

    mode = "updated";
  } else {
    const { error } = await supabase.from("creator_tool_access").insert({
      email,
      access_code_hash: accessCodeHash,
      mock_account_id: mockAccount.id,
      is_active: true,
    });

    if (error) {
      throw new CreatorAccountsError(500, `Unable to create creator access: ${error.message}`);
    }
  }

  return {
    success: true,
    mode,
    email,
    userId,
    mockAccountId: mockAccount.id,
    appPassword: mockUserPassword,
    generatedAccessCode: accessCode,
  };
}

export async function listCreatorAccounts(supabase: ReturnType<typeof createClient>) {
  const creators = (await loadCreatorAccessRows(supabase)) as Array<Record<string, unknown>>;
  const mockAccountIds = creators
    .map((row) => (typeof row.mock_account_id === "string" ? row.mock_account_id : null))
    .filter((value): value is string => Boolean(value));

  const mockAccountsById = new Map<
    string,
    { user_id: string | null; app_login_completed_at: string | null }
  >();
  const appAccessByUserId = new Map<string, boolean>();

  if (mockAccountIds.length > 0) {
    const { data: mockAccountRows, error: mockAccountError } = await supabase
      .from("mock_accounts")
      .select("id, user_id, app_login_completed_at")
      .in("id", mockAccountIds);

    if (mockAccountError) {
      throw new CreatorAccountsError(500, `Unable to load mock accounts: ${mockAccountError.message}`);
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

    await Promise.all(
      [...new Set(userIds)].map(async (userId) => {
        const { data, error } = await supabase.auth.admin.getUserById(userId);

        if (error) {
          throw new CreatorAccountsError(500, `Unable to inspect auth user: ${error.message}`);
        }

        appAccessByUserId.set(userId, !isBanned(data.user?.banned_until));
      }),
    );
  }

  return creators.map((row) => {
    const mockAccountId = String(row.mock_account_id);
    const mockAccount = mockAccountsById.get(mockAccountId);
    const appUserId = mockAccount?.user_id ?? null;
    const appLoginCompletedAt = mockAccount?.app_login_completed_at ?? null;
    const creatorToolLoginCompletedAt =
      typeof row.creator_tool_login_completed_at === "string"
        ? row.creator_tool_login_completed_at
        : null;

    return {
      id: String(row.id),
      email: String(row.email),
      toolAccessEnabled: Boolean(row.is_active),
      appAccessEnabled: appUserId ? (appAccessByUserId.get(appUserId) ?? false) : null,
      appLoginCompleted: Boolean(appLoginCompletedAt),
      appLoginCompletedAt,
      creatorToolLoginCompleted: Boolean(creatorToolLoginCompletedAt),
      creatorToolLoginCompletedAt,
      loginFlags: {
        application: Boolean(appLoginCompletedAt),
        creatorTool: Boolean(creatorToolLoginCompletedAt),
      },
      appUserId,
      mockAccountId,
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    };
  });
}

export async function markCreatorAppLoginCompleted(
  supabase: ReturnType<typeof createClient>,
  id: string,
) {
  const { data: creatorAccess, error: creatorLookupError } = await supabase
    .from("creator_tool_access")
    .select("mock_account_id")
    .eq("id", id)
    .maybeSingle();

  if (creatorLookupError) {
    throw new CreatorAccountsError(500, `Unable to load creator: ${creatorLookupError.message}`);
  }

  const mockAccountId = creatorAccess?.mock_account_id ?? id;

  const { error } = await supabase
    .from("mock_accounts")
    .update({
      app_login_completed_at: new Date().toISOString(),
    })
    .eq("id", mockAccountId);

  if (error) {
    throw new CreatorAccountsError(500, `Unable to update app login flag: ${error.message}`);
  }
}

export async function markCreatorToolLoginCompleted(
  supabase: ReturnType<typeof createClient>,
  id: string,
) {
  const { error } = await supabase
    .from("creator_tool_access")
    .update({
      creator_tool_login_completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new CreatorAccountsError(500, `Unable to update creator login flag: ${error.message}`);
  }
}

export async function setCreatorAccountEnabledState(
  supabase: ReturnType<typeof createClient>,
  id: string,
  enabled: boolean,
) {
  const { data: creatorAccess, error: creatorLookupError } = await supabase
    .from("creator_tool_access")
    .select("mock_account_id")
    .eq("id", id)
    .maybeSingle();

  if (creatorLookupError) {
    throw new CreatorAccountsError(500, `Unable to load creator: ${creatorLookupError.message}`);
  }

  if (!creatorAccess?.mock_account_id) {
    throw new CreatorAccountsError(404, "Creator record not found.");
  }

  const { data: mockAccount, error: mockAccountError } = await supabase
    .from("mock_accounts")
    .select("user_id")
    .eq("id", creatorAccess.mock_account_id)
    .maybeSingle();

  if (mockAccountError) {
    throw new CreatorAccountsError(500, `Unable to load mock account: ${mockAccountError.message}`);
  }

  const { error: creatorUpdateError } = await supabase
    .from("creator_tool_access")
    .update({ is_active: enabled })
    .eq("id", id);

  if (creatorUpdateError) {
    throw new CreatorAccountsError(500, `Unable to update creator access: ${creatorUpdateError.message}`);
  }

  if (mockAccount?.user_id) {
    const { error: authError } = await supabase.auth.admin.updateUserById(mockAccount.user_id, {
      ban_duration: enabled ? "none" : creatorAccountBanDuration,
    });

    if (authError) {
      throw new CreatorAccountsError(500, `Unable to update app access: ${authError.message}`);
    }
  }
}
