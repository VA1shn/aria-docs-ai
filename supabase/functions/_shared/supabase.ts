/**
 * Supabase client helpers for Edge Functions.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type AuthedContext = {
  /** User-scoped client (respects RLS) */
  supabase: SupabaseClient;
  /** Service-role client (bypasses RLS; use carefully after auth) */
  admin: SupabaseClient;
  userId: string;
  email: string | undefined;
};

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getAnonClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) {
    throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is missing");
  }
  return createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Verify Bearer JWT and return authenticated clients + user id.
 */
export async function requireAuth(req: Request): Promise<AuthedContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header");
  }

  const supabase = getAnonClient(authHeader);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError(error?.message ?? "Unauthorized");
  }

  // Ensure profile row exists (covers users created before trigger / OAuth)
  const admin = getServiceClient();
  await admin.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      name:
        (user.user_metadata?.name as string | undefined) ??
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "User",
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    },
    { onConflict: "id" },
  );

  return {
    supabase,
    admin,
    userId: user.id,
    email: user.email,
  };
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
