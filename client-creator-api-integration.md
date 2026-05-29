# Implement Creator Account Management Using External API

Build creator account management in the app using the external API below.

## Goal

Add a creator accounts screen that lets us:

1. See all existing creator accounts
2. Create a new creator account
3. Disable a creator account
4. Enable a creator account

This manages both:
- creator tool access
- mock/app account access

So when an account is disabled, it should be treated as disabled everywhere.

## Authentication

Use this API key as a bearer token on every request:

```txt
Authorization: Bearer b26e8b1e63e81429a1dc31c7d06a2bc09ee33d304de2d0b5b09b7d0ac4d160b3
```

Do not use any Supabase key on the frontend.

Important:
- Do not expose this bearer key in browser code, mobile client code, or any public frontend bundle
- Use this API key only from a trusted backend/server layer controlled by the user
- If the UI is public-facing, the frontend should call the user's own backend, and that backend should call this Supabase edge function

## Base URL

Use this base URL:

```txt
https://idexmwfjpclvdofwenge.supabase.co
```

The external API function path is:

```txt
/functions/v1/client-creator-accounts
```

## API Endpoints

### 1. List creators

`GET /functions/v1/client-creator-accounts`

#### Example request

```bash
curl -X GET https://idexmwfjpclvdofwenge.supabase.co/functions/v1/client-creator-accounts \
  -H "Authorization: Bearer b26e8b1e63e81429a1dc31c7d06a2bc09ee33d304de2d0b5b09b7d0ac4d160b3"
```

#### Expected response

```json
{
  "creators": [
    {
      "id": "uuid",
      "email": "creator@susly.app",
      "toolAccessEnabled": true,
      "appAccessEnabled": true,
      "appLoginCompleted": true,
      "appLoginCompletedAt": "2026-05-19T10:00:00.000Z",
      "creatorToolLoginCompleted": true,
      "creatorToolLoginCompletedAt": "2026-05-19T10:00:00.000Z",
      "loginFlags": {
        "application": true,
        "creatorTool": true
      },
      "appUserId": "uuid",
      "mockAccountId": "uuid",
      "createdAt": "2026-05-19T10:00:00.000Z",
      "updatedAt": "2026-05-19T10:00:00.000Z"
    }
  ]
}
```

#### Login flags

Each creator includes two login-completion flags:
- `loginFlags.application`: true when the creator has successfully logged in to the app mock account
- `loginFlags.creatorTool`: true when the creator has successfully logged in to the creator tool

The same values are also exposed as top-level fields for compatibility:
- `appLoginCompleted`
- `creatorToolLoginCompleted`

### 2. Create creator

`POST /functions/v1/client-creator-accounts`

UI note:
- The user should enter only the username portion
- The frontend should automatically append `@susly.app`
- The backend request must still send the full email address, for example `creator@susly.app`

#### Request body

```json
{
  "email": "creator@susly.app"
}
```

#### Example request

```bash
curl -X POST https://idexmwfjpclvdofwenge.supabase.co/functions/v1/client-creator-accounts \
  -H "Authorization: Bearer b26e8b1e63e81429a1dc31c7d06a2bc09ee33d304de2d0b5b09b7d0ac4d160b3" \
  -H "Content-Type: application/json" \
  -d '{"email":"creator@susly.app"}'
```

#### Expected response

```json
{
  "success": true,
  "mode": "created",
  "creator": {
    "email": "creator@susly.app",
    "appUserId": "uuid",
    "mockAccountId": "uuid",
    "appPassword": "222333",
    "toolAccessCode": "123456"
  }
}
```

#### Important UX requirement

After creation, show the returned credentials in a clean result card with:
- Email
- App password
- Tool access code
- Copy all button

### 3. Enable / disable creator

`PATCH /functions/v1/client-creator-accounts`

#### Request body

```json
{
  "id": "creator-id",
  "enabled": false
}
```

Important:
- Use the creator `id` returned by `GET /functions/v1/client-creator-accounts`
- Do not use `appUserId`

#### Example request

```bash
curl -X PATCH https://idexmwfjpclvdofwenge.supabase.co/functions/v1/client-creator-accounts \
  -H "Authorization: Bearer b26e8b1e63e81429a1dc31c7d06a2bc09ee33d304de2d0b5b09b7d0ac4d160b3" \
  -H "Content-Type: application/json" \
  -d '{"id":"creator-id","enabled":false}'
```

#### Expected response

```json
{
  "success": true,
  "id": "creator-id",
  "enabled": false
}
```

#### Behavior

- `enabled: false` disables both tool access and app/mock access
- `enabled: true` enables both again

### 4. Mark creator tool login completed

`PATCH /functions/v1/client-creator-accounts`

Call this after a creator successfully logs in with the creator tool credentials.

#### Request body

```json
{
  "id": "creator-id",
  "creatorToolLoginCompleted": true
}
```

#### Expected response

```json
{
  "success": true,
  "id": "creator-id",
  "creatorToolLoginCompleted": true
}
```

### 5. Mark app mock account login completed

`PATCH /functions/v1/client-creator-accounts`

Call this after a creator successfully logs in to the app mock account with the app credentials.

#### Request body

```json
{
  "id": "creator-id",
  "appLoginCompleted": true
}
```

#### Expected response

```json
{
  "success": true,
  "id": "creator-id",
  "appLoginCompleted": true
}
```

## UI Requirements

Build a creators management view with:

### A. Creator list

Each row/card should show:
- email
- tool access status
- app access status
- app login completed status
- creator tool login completed status
- created date
- updated date
- enable/disable button

### B. Create creator form

- username input
- create button

The frontend can append `@susly.app` for display or form handling, but the authenticated request should be sent from the backend with the full email in the API payload.

### C. Provisioning result box

After a successful create:
- show Email
- show App password
- show Tool access code
- show Copy all button

### D. Refresh behavior

After create / enable / disable:
- refresh the creators list automatically

## Error Handling

Handle non-200 responses properly.

If API returns:

```json
{ "error": "..." }
```

Show that message in the UI.

## Implementation Notes

- Do not use Supabase directly beyond calling this edge function URL
- Do not ask for a Supabase service key
- Only use the HTTP API above
- Use the bearer token on every request from the backend/server layer only
- Keep the create / list / toggle logic modular
- Prefer a clean admin-style UI, not a consumer app UI

## Deliverable

Implement a working creators management page in the app that:
- lists creators
- creates creators
- enables creators
- disables creators
- displays returned credentials after creation
- supports copying credentials in one click
