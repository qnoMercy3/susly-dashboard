import {
  CreatorAccountsError,
  createAdminSupabaseClient,
  creatorCorsHeaders,
  creatorJson,
  normalizeEmail,
  provisionCreatorAccount,
  requireAdminSession,
} from "../_shared/creatorAccounts.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: creatorCorsHeaders });
  }

  if (request.method !== "POST") {
    return creatorJson({ error: "Method not allowed." }, 405);
  }

  let input: { email?: unknown };
  try {
    input = await request.json();
  } catch {
    return creatorJson({ error: "Invalid request body." }, 400);
  }

  const email = normalizeEmail(input.email);

  if (!email) {
    return creatorJson({ error: "Creator email is required." }, 400);
  }

  try {
    const supabase = createAdminSupabaseClient();
    await requireAdminSession(supabase, request.headers.get("authorization") ?? "");
    return creatorJson(await provisionCreatorAccount(supabase, email));
  } catch (error) {
    return creatorJson(
      { error: error instanceof Error ? error.message : "Unable to provision creator." },
      error instanceof CreatorAccountsError ? error.status : 500,
    );
  }
});
