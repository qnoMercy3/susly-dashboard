import {
  CreatorAccountsError,
  createAdminSupabaseClient,
  creatorCorsHeaders,
  creatorJson,
  listCreatorAccounts,
  normalizeEmail,
  provisionCreatorAccount,
  requireClientApiKey,
  setCreatorAccountEnabledState,
} from "../_shared/creatorAccounts.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: creatorCorsHeaders });
  }

  try {
    await requireClientApiKey(request.headers.get("authorization") ?? "");
    const supabase = createAdminSupabaseClient();

    if (request.method === "GET") {
      return creatorJson({
        creators: await listCreatorAccounts(supabase),
      });
    }

    if (request.method === "POST") {
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

      const result = await provisionCreatorAccount(supabase, email);

      return creatorJson({
        success: true,
        mode: result.mode,
        creator: {
          email: result.email ?? null,
          appUserId: result.userId ?? null,
          mockAccountId: result.mockAccountId ?? null,
          appPassword: result.appPassword ?? null,
          toolAccessCode: result.generatedAccessCode ?? null,
        },
      });
    }

    if (request.method === "PATCH") {
      let input: { id?: unknown; enabled?: unknown };
      try {
        input = await request.json();
      } catch {
        return creatorJson({ error: "Invalid request body." }, 400);
      }

      const id = typeof input.id === "string" ? input.id.trim() : "";
      const enabled = typeof input.enabled === "boolean" ? input.enabled : null;

      if (!id || enabled === null) {
        return creatorJson({ error: "Creator ID and enabled state are required." }, 400);
      }

      await setCreatorAccountEnabledState(supabase, id, enabled);

      return creatorJson({
        success: true,
        id,
        enabled,
      });
    }

    return creatorJson({ error: "Method not allowed." }, 405);
  } catch (error) {
    return creatorJson(
      { error: error instanceof Error ? error.message : "Unable to manage creator accounts." },
      error instanceof CreatorAccountsError ? error.status : 500,
    );
  }
});
