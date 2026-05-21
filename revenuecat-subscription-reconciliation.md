# RevenueCat Subscription Reconciliation Notes

Date documented: 2026-05-21

This document captures the RevenueCat/Supabase subscription drift investigation, what was changed, and what still needs to be resolved. No Supabase subscription rows were backfilled or modified during this investigation.

## Summary

The dashboard was showing a much higher number of active subscriptions than RevenueCat. The main cause appears to be stale Supabase subscription state, likely caused by the RevenueCat webhook being scoped to the wrong RevenueCat app.

RevenueCat currently reports `116` active subscriptions. Supabase currently has `432` raw `active` users. Of those Supabase active users, `340` have `subscription_expires_at` in the past, which strongly suggests missed expiration/cancellation updates.

The RevenueCat webhook integration has been fixed going forward by making it project-wide.

## Systems Involved

RevenueCat project:

- Project name: `Ickcheck`
- Project ID: `proj3f095801`

RevenueCat apps:

- `app3216bc6c4e`: `Ickcheck (App Store)`, type `app_store`, bundle `com.MWLifestyle.Ickcheck`
- `app593e49b9db`: `Test Store`, type `test_store`
- `appcb17d56253`: `Ickcheck (Web Billing)`, type `rc_billing`

Supabase project:

- Project ref: `idexmwfjpclvdofwenge`
- RevenueCat webhook URL: `https://idexmwfjpclvdofwenge.supabase.co/functions/v1/revenuecat-webhook`
- Edge Function slug: `revenuecat-webhook`
- Edge Function version observed: `37`
- Edge Function JWT verification: disabled, because the function validates the RevenueCat `Authorization` header itself.

## Original Webhook Problem

The existing RevenueCat webhook integration was:

- ID: `whintgr4dfe529f02`
- Name: `SUPABASE SECRET WEBHOOK`
- URL: `https://idexmwfjpclvdofwenge.supabase.co/functions/v1/revenuecat-webhook`
- Environment: `null`, meaning not restricted to sandbox or production
- Events: `initial_purchase`, `renewal`, `product_change`, `cancellation`, `billing_issue`, `expiration`
- App scope: `app593e49b9db`

The problem was the app scope. `app593e49b9db` is the RevenueCat Test Store app, not the live App Store app and not the Web Billing app.

Because the webhook was scoped to Test Store, RevenueCat events from the real App Store app (`app3216bc6c4e`) and Web Billing app (`appcb17d56253`) were not covered by that webhook. The `environment: null` setting did not solve this, because `app_id` still constrained which app could trigger the webhook.

This explains why Supabase could keep showing users as active after their RevenueCat subscriptions had expired or changed state.

## Webhook Fix Applied

The existing RevenueCat webhook integration was updated through the RevenueCat MCP.

First change:

- Set `app_id` to `null`
- This makes the webhook project-wide across all RevenueCat apps in `proj3f095801`.

Second change:

- Added `uncancellation` and `transfer` to the event list.
- The deployed Supabase Edge Function already has handlers for `UNCANCELLATION` and `TRANSFER`, but the RevenueCat webhook was not configured to send those events.

Final verified webhook state:

- ID: `whintgr4dfe529f02`
- Project ID: `proj3f095801`
- Name: `SUPABASE SECRET WEBHOOK`
- URL: `https://idexmwfjpclvdofwenge.supabase.co/functions/v1/revenuecat-webhook`
- Environment: `null`
- App scope: `null`
- Events: `initial_purchase`, `renewal`, `product_change`, `cancellation`, `billing_issue`, `uncancellation`, `transfer`, `expiration`

No webhook URL or authorization secret was changed.

## Edge Function Behavior Observed

The deployed `revenuecat-webhook` function is store-agnostic. It does not branch on a specific RevenueCat app or store ID. It processes RevenueCat events by:

- validating the `Authorization` header against `REVENUECAT_WEBHOOK_SECRET`
- reading `event.app_user_id`
- finding a Supabase user by `revenuecat_user_id`, then by `id`
- mapping `product_id` into one of `weekly`, `annual`, or `exclusive_annual`
- writing `subscription_status`, `subscription_tier`, `subscription_expires_at`, `tracking_quota`, and `updated_at`

Observed event behavior:

- `INITIAL_PURCHASE`: sets status to `trial` or `active`, sets tier, expiry, RevenueCat ID, and paid quota
- `RENEWAL`: sets status to `active`, updates tier, expiry, and paid quota
- `UNCANCELLATION`: sets status to `active`, updates tier, expiry, and paid quota
- `CANCELLATION`: only logs; access remains active until expiration
- `EXPIRATION`: sets status to `expired`, clears tier and expiry, sets quota to `0`
- `BILLING_ISSUE`: sets status to `expired`, clears tier and expiry, sets quota to `0`
- `PRODUCT_CHANGE`: updates tier, expiry, and quota
- `TRANSFER`: revokes the source user and grants active access to the destination user

The function appears compatible with a project-wide webhook. No Edge Function code change was made during this investigation.

## Dashboard Change Applied

The dashboard had temporarily been changed to treat `active` or `trial` rows with a past `subscription_expires_at` as effectively `expired`.

That dashboard-side normalization has been removed. The dashboard now reads raw Supabase state again:

- Users tab reads raw `users.subscription_status`
- Overview active/trial count reads raw `users.subscription_status`
- `src/lib/subscriptions.ts` was deleted

This means the dashboard now intentionally shows the actual Supabase subscription state, even if that state is stale relative to RevenueCat.

## Current Aggregate Diff

Data pulled read-only on 2026-05-21 local time.

RevenueCat overview:

- Active subscriptions: `116`
- Active trials: `0`
- MRR: `$2235`
- Revenue, last 28 days: `$3174`
- New customers, last 28 days: `4664`
- Active users, last 28 days: `7219`

RevenueCat subscription status chart:

- Total active subscriptions: `116`
- Set to renew: `42`
- Set to cancel: `74`
- Billing issue: `0`
- Active trials: `0`

RevenueCat active subscriptions by product:

- `Ickcheck Annual Exclusive`: `42`
- `Ickcheck Annual`: `41`
- `Ickcheck Weekly`: `33`

RevenueCat active subscriptions by app/store:

- All `116` active subscriptions were reported under `Ickcheck (App Store)` / App Store at the time of the query.

Supabase raw state:

- Total users: `1740`
- RevenueCat-linked users: `1517`
- Raw `active`: `432`
- Raw `active` with `revenuecat_user_id`: `427`
- Raw `trial`: `0`
- Raw `free`: `1307`
- Raw `expired`: `1`

Raw Supabase active rows by tier:

- `weekly`: `350`
- `exclusive_annual`: `44`
- `annual`: `38`

Raw Supabase active rows with RevenueCat ID by tier:

- `weekly`: `350`
- `exclusive_annual`: `39`
- `annual`: `38`

Raw Supabase active rows by expiry bucket:

- Past expiry: `340`
- Future expiry: `87`
- No expiry: `5`

Raw Supabase active rows with RevenueCat ID by expiry bucket:

- Past expiry: `340`
- Future expiry: `87`

Raw Supabase active rows by tier and expiry:

- `weekly:past_expiry`: `340`
- `exclusive_annual:future_expiry`: `39`
- `annual:future_expiry`: `38`
- `weekly:future_expiry`: `10`
- `exclusive_annual:no_expiry`: `5`

## Diff Interpretation

The main gap:

- Supabase raw active users: `432`
- RevenueCat active subscriptions: `116`
- Difference including internal/manual active users: `316`
- Difference only among RevenueCat-linked active users: `311`

The most important finding is that `340` Supabase active rows have `subscription_expires_at` in the past. All `340` are RevenueCat-linked weekly rows.

That pattern is consistent with missed webhook events. Weekly subscriptions are most exposed to webhook drift because they renew or expire more frequently than annual products.

The five active users without RevenueCat IDs are likely internal/manual/test users:

- `mike@susly.app`
- `claudia@susly.app`
- `aaliyah@susly.app`
- `test123@susly.app`
- `test-w3f5@susly.app`

## Access Risk

There is a real risk that stale active Supabase rows are giving users paid access without an active RevenueCat subscription.

The risk depends on how the client app gates access:

- If the app checks `subscription_status = active`, stale rows can keep paid access.
- If the app checks `tracking_quota = 3`, stale rows can keep paid access because quota is only cleared when webhook expiration/billing events are received.
- If the app checks `subscription_expires_at > now()`, stale past-expiry rows may not get access despite raw status.
- If the app checks RevenueCat SDK entitlement state directly at runtime, client access may be safer than the Supabase dashboard suggests.

The mobile/client access path should be inspected before assuming all stale rows are actively using paid features for free.

## Known Limitations Of This Diff

The RevenueCat MCP currently exposed aggregate chart data and per-customer reads, but not a bulk customer export/list endpoint.

Because of that, this document contains a complete aggregate diff, but not a complete row-by-row RevenueCat-vs-Supabase diff for all `1517` RevenueCat-linked Supabase users.

To produce a complete row-level diff, one of these is needed:

- a RevenueCat customer export/API key with access to a bulk customer endpoint
- a CSV export from RevenueCat
- a RevenueCat MCP bulk customer/list tool
- a scripted process that calls RevenueCat per-customer APIs for all `1517` linked users

The aggregate data is still enough to establish that Supabase is currently stale relative to RevenueCat.

## Backfill Guidance

Do not run a blind overwrite.

A safer backfill should be staged as:

1. Export all Supabase users with `revenuecat_user_id`.
2. Fetch current RevenueCat state for each customer.
3. Compute intended Supabase fields without writing:
   - `subscription_status`
   - `subscription_tier`
   - `subscription_expires_at`
   - `tracking_quota`
4. Produce a diff report.
5. Review risky cases manually.
6. Apply low-risk updates in batches.

Recommended first write pass, if/when backfill is approved:

- Update only RevenueCat-linked rows.
- Do not touch internal/manual users without `revenuecat_user_id`.
- Downgrade stale Supabase active rows only when RevenueCat clearly has no active entitlement.
- Upgrade/free-to-active rows only when RevenueCat clearly has exactly one active entitlement.
- Keep a pre-change export of every row that would be touched.

High-risk cases for manual review:

- missing `revenuecat_user_id`
- customer not found in RevenueCat
- RevenueCat aliases/transfers where ownership is unclear
- multiple active entitlements
- unknown product IDs
- Supabase active but RevenueCat has no active entitlement
- RevenueCat active but Supabase user row is missing or free

## Suggested Follow-Up Checks

Inspect client-side access logic:

- Does the app use Supabase `subscription_status`?
- Does it use `tracking_quota`?
- Does it compare `subscription_expires_at` to current time?
- Does it use RevenueCat SDK entitlement state directly?

Inspect webhook logs after the scope fix:

- Confirm new App Store events are reaching `revenuecat-webhook`.
- Confirm new Web Billing events are reaching `revenuecat-webhook`.
- Confirm `renewal`, `expiration`, `transfer`, and `uncancellation` events update expected Supabase users.

Create a read-only row-level reconciliation report before any backfill writes.
