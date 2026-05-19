import { requireEnv } from "@/lib/env";

type CreatorProvisionInput = {
  email?: string;
};

export type CreatorProvisionResponse = {
  success?: boolean;
  mode?: "created" | "updated";
  email?: string;
  userId?: string;
  mockAccountId?: string;
  appPassword?: string;
  generatedAccessCode?: string;
  error?: string;
};

export async function invokeCreatorProvisionFunction(
  input: CreatorProvisionInput,
  authorizationHeader: string,
): Promise<CreatorProvisionResponse> {
  const response = await fetch(
    `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/functions/v1/admin-create-creator`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorizationHeader,
      },
      body: JSON.stringify(input),
    },
  );

  const payload = (await response.json()) as CreatorProvisionResponse;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? "Failed to provision creator.");
  }

  return payload;
}
