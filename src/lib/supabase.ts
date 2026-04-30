import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireEnv } from "./env";

let browserClient: SupabaseClient | null = null;
let anonServerClient: SupabaseClient | null = null;
let adminServerClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  browserClient ??= createClient(url, anonKey);
  return browserClient;
}

export function getAnonServerSupabase(): SupabaseClient {
  anonServerClient ??= createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return anonServerClient;
}

export function getAdminSupabase(): SupabaseClient {
  adminServerClient ??= createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return adminServerClient;
}
