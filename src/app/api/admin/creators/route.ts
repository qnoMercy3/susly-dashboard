import { NextResponse, type NextRequest } from "next/server";

import { jsonError, requireAdmin } from "@/lib/admin-auth";
import {
  listCreatorAccounts,
  markCreatorToolLoginCompleted,
  setCreatorAccountEnabledState,
} from "@/lib/creator-accounts";
import { invokeCreatorProvisionFunction } from "@/lib/creator-provisioning";

type CreatorUpdateInput = {
  id?: string;
  isActive?: boolean;
  creatorToolLoginCompleted?: boolean;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ creators: await listCreatorAccounts() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = (await request.json()) as { email?: string };
    const authorizationHeader = request.headers.get("authorization") ?? "";
    const result = await invokeCreatorProvisionFunction(body, authorizationHeader);

    return NextResponse.json({
      success: true,
      mode: result.mode,
      email: result.email,
      userId: result.userId,
      mockAccountId: result.mockAccountId,
      appPassword: result.appPassword,
      generatedAccessCode: result.generatedAccessCode,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = (await request.json()) as CreatorUpdateInput;
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return NextResponse.json({ error: "Creator ID is required." }, { status: 400 });
    }

    if (body.creatorToolLoginCompleted === true) {
      await markCreatorToolLoginCompleted(id);
      return NextResponse.json({ success: true });
    }

    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "Creator active state is required." }, { status: 400 });
    }

    await setCreatorAccountEnabledState(id, body.isActive);

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
