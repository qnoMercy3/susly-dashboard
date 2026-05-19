type SubscriptionLike = {
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
};

const EXPIRING_STATUSES = new Set(["active", "trial"]);

export function getEffectiveSubscriptionStatus<T extends SubscriptionLike>(subscription: T): string | null {
  const status = subscription.subscription_status ?? null;

  if (!status || !EXPIRING_STATUSES.has(status)) {
    return status;
  }

  const expiresAt = subscription.subscription_expires_at;

  if (!expiresAt) {
    return status;
  }

  const expiresAtMs = Date.parse(expiresAt);

  if (Number.isNaN(expiresAtMs)) {
    return status;
  }

  return expiresAtMs <= Date.now() ? "expired" : status;
}
