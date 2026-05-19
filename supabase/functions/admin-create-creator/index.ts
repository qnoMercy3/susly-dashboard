import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const subscriptionStatus = "active";
const subscriptionTier = "exclusive_annual";
const trackingQuota = 3;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeEmail(value: unknown) {
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
      throw new Error(`Unable to inspect auth users: ${error.message}`);
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const mockUserPassword = Deno.env.get("MOCK_USER_PASSWORD");
  const accessCodePepper =
    Deno.env.get("CREATOR_ACCESS_CODE_PEPPER") ?? "susly-creator-access-v1";

  if (!serviceRoleKey || !supabaseUrl) {
    return json({ error: "Creator provisioning is not configured." }, 500);
  }

  if (!mockUserPassword) {
    return json({ error: "MOCK_USER_PASSWORD is not configured." }, 500);
  }

  let input: { email?: unknown };
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const email = normalizeEmail(input.email);

  if (!email) {
    return json({ error: "Creator email is required." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const adminEmails = (Deno.env.get("ADMIN_EMAILS") ?? "admin@susly.app")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    return json({ error: "Missing admin session." }, 401);
  }

  const { data: authUserData, error: authUserError } = await supabase.auth.getUser(token);

  if (authUserError || !authUserData.user?.email) {
    return json({ error: "Invalid or expired admin session." }, 401);
  }

  if (!adminEmails.includes(authUserData.user.email.trim().toLowerCase())) {
    return json({ error: "This account is not allowed to provision creators." }, 403);
  }

  try {
    const existingCreatorAccessResponse = await supabase
      .from("creator_tool_access")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingCreatorAccessResponse.error) {
      throw new Error(`Unable to load creator access: ${existingCreatorAccessResponse.error.message}`);
    }

    const existingCreatorAccessId = existingCreatorAccessResponse.data?.id ?? null;

    const authUser =
      (await findAuthUserByEmail(supabase, email)) ||
      null;

    let userId = authUser?.id ?? null;
    let mode: "created" | "updated" = existingCreatorAccessId ? "updated" : "created";

    if (authUser) {
      const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
        email,
        password: mockUserPassword,
        email_confirm: true,
        user_metadata: {
          ...authUser.user_metadata,
          role: "creator",
        },
      });

      if (error) {
        throw new Error(`Unable to update auth user: ${error.message}`);
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
        throw new Error(error?.message ?? "Unable to create auth user.");
      }

      userId = data.user.id;
    }

    if (!userId) {
      throw new Error("Unable to resolve auth user ID.");
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
      throw new Error(`Unable to upsert app user: ${userError.message}`);
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
      throw new Error(mockAccountError?.message ?? "Unable to create mock account.");
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
        throw new Error(`Unable to update creator access: ${error.message}`);
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
        throw new Error(`Unable to create creator access: ${error.message}`);
      }
    }

    return json({
      success: true,
      mode,
      email,
      userId,
      mockAccountId: mockAccount.id,
      appPassword: mockUserPassword,
      generatedAccessCode: accessCode,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to provision creator." },
      500,
    );
  }
});
