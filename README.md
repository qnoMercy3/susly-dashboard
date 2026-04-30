# Susly Dashboard

Internal Vercel dashboard for Susly/IckCheck analytics, creator mock accounts, and Instagram clone mock profile management.

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAILS=admin@susly.app
```

`ADMIN_EMAILS` is a comma-separated allowlist. The service-role key is only used in server API routes.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
