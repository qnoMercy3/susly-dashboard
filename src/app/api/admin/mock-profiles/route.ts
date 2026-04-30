import { NextResponse, type NextRequest } from "next/server";

import { jsonError, requireAdmin } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase";
import type { MockProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

type MockProfileInput = {
  id?: string;
  targetUsername?: string;
  sourceProfileId?: string;
  ownerMockAccountId?: string;
  fullName?: string;
  avatarUrl?: string;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
};

function normalizeUsername(value: string | undefined) {
  return (value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

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

    const { data, error } = await getAdminSupabase()
      .from("mock_target_data")
      .select("id, target_username, source_profile_id, profile_data, following_data, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(150);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      profiles: (data ?? []).map((row) => mapMockProfile(row)),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = (await request.json()) as MockProfileInput;
    const username = normalizeUsername(body.targetUsername);
    const ownerMockAccountId = body.ownerMockAccountId?.trim();

    if (!username) {
      return NextResponse.json({ error: "Target username is required." }, { status: 400 });
    }

    if (!ownerMockAccountId) {
      return NextResponse.json({ error: "Creator owner is required." }, { status: 400 });
    }

    const sourceProfileId = body.sourceProfileId?.trim() || `dashboard:${username}`;
    const fullName = body.fullName?.trim() || username;

    const payload = {
      target_username: username,
      source_profile_id: sourceProfileId,
      profile_data: {
        instagramId: `mock:${sourceProfileId}`,
        fullName,
        avatarUrl: body.avatarUrl?.trim() || null,
        verified: false,
        isPrivate: false,
        followerCount: Number(body.followerCount ?? 0),
        followingCount: Number(body.followingCount ?? 0),
        postCount: Number(body.postCount ?? 0),
      },
      following_data: [],
      owner_mock_account_id: ownerMockAccountId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await getAdminSupabase()
      .from("mock_target_data")
      .upsert(payload, { onConflict: "target_username" });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { id } = (await request.json()) as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "Profile ID is required." }, { status: 400 });
    }

    const { error } = await getAdminSupabase().from("mock_target_data").delete().eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
