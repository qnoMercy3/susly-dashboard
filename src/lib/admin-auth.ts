import { NextResponse, type NextRequest } from "next/server";

import { getAdminEmails } from "./env";
import { getAnonServerSupabase } from "./supabase";

export type AdminContext = {
  userId: string;
  email: string;
};

export class AdminAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function requireAdmin(request: NextRequest): Promise<AdminContext> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    throw new AdminAuthError(401, "Missing bearer token.");
  }

  const { data, error } = await getAnonServerSupabase().auth.getUser(token);

  if (error || !data.user?.email) {
    throw new AdminAuthError(401, "Invalid or expired session.");
  }

  const email = data.user.email.toLowerCase();
  const allowedEmails = getAdminEmails();

  if (!allowedEmails.includes(email)) {
    throw new AdminAuthError(403, "This account is not allowed to access the dashboard.");
  }

  return {
    userId: data.user.id,
    email,
  };
}
