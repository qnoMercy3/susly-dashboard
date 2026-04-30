import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { jsonError, requireAdmin } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase";
import type { CreatorToolAccess, MockProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

type CreatorInput = {
  email?: string;
  password?: string;
};

function mapMockProfile(row: Record<string, unknown>): MockProfile {
  const followingData = Array.isArray(row.following_data) ? row.following_data : [];

  return {
    id: String(row.id),
    target_username: String(row.target_username),
    source_profile_id: typeof row.source_profile_id === "string" ? row.source_profile_id : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    owner_mock_account_id:
      typeof row.owner_mock_account_id === "string" ? row.owner_mock_account_id : null,
    profile_data:
      row.profile_data && typeof row.profile_data === "object"
        ? (row.profile_data as MockProfile["profile_data"])
        : null,
    following_count: followingData.length,
  };
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

    let profilesByOwner = new Map<string, MockProfile[]>();

    if (mockAccountIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("mock_target_data")
        .select(
          "id, target_username, source_profile_id, profile_data, following_data, created_at, updated_at, owner_mock_account_id",
        )
        .in("owner_mock_account_id", mockAccountIds)
        .order("updated_at", { ascending: false });

      if (profileError) {
        throw profileError;
      }

      profilesByOwner = (profileRows ?? []).reduce<Map<string, MockProfile[]>>((accumulator, row) => {
        const profile = mapMockProfile(row);
        const ownerId = profile.owner_mock_account_id;

        if (!ownerId) {
          return accumulator;
        }

        const profiles = accumulator.get(ownerId) ?? [];
        profiles.push(profile);
        accumulator.set(ownerId, profiles);
        return accumulator;
      }, new Map());
    }

    const payload: CreatorToolAccess[] = creators.map((row) => {
      const mockAccountId = String(row.mock_account_id);

      return {
        id: String(row.id),
        email: String(row.email),
        mock_account_id: mockAccountId,
        is_active: Boolean(row.is_active),
        created_at: typeof row.created_at === "string" ? row.created_at : null,
        updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
        profiles: profilesByOwner.get(mockAccountId) ?? [],
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

    const body = (await request.json()) as CreatorInput;
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim() || `${randomUUID()}A1!`;

    if (!email) {
      return NextResponse.json({ error: "Creator email is required." }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "creator",
      },
    });

    if (authError) {
      throw authError;
    }

    const userId = authData.user.id;

    const { error: userError } = await supabase.from("users").upsert({
      id: userId,
      email,
      subscription_status: "active",
      subscription_tier: "exclusive_annual",
      tracking_quota: 3,
      updated_at: new Date().toISOString(),
    });

    if (userError) {
      throw userError;
    }

    const { error: mockError } = await supabase.from("mock_accounts").upsert({
      user_id: userId,
    });

    if (mockError) {
      throw mockError;
    }

    return NextResponse.json({
      success: true,
      userId,
      email,
      generatedPassword: body.password ? null : password,
    });
  } catch (error) {
    return jsonError(error);
  }
}
