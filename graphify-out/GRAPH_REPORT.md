# Graph Report - .  (2026-05-25)

## Corpus Check
- Corpus is ~11,392 words - fits in a single context window. You may not need a graph.

## Summary
- 239 nodes · 383 edges · 18 communities (11 shown, 7 thin omitted)
- Extraction: 97% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Admin Creator APIs|Admin Creator APIs]]
- [[_COMMUNITY_Repo Guidance|Repo Guidance]]
- [[_COMMUNITY_Creator Account Provisioning|Creator Account Provisioning]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Dashboard UI Components|Dashboard UI Components]]
- [[_COMMUNITY_Dashboard Data Aggregation|Dashboard Data Aggregation]]
- [[_COMMUNITY_TypeScript Configuration|TypeScript Configuration]]
- [[_COMMUNITY_RevenueCat Subscriptions|RevenueCat Subscriptions]]
- [[_COMMUNITY_Next.js Pages|Next.js Pages]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Supabase Project Link|Supabase Project Link]]
- [[_COMMUNITY_Supabase Function Imports|Supabase Function Imports]]
- [[_COMMUNITY_Supabase Function Config|Supabase Function Config]]
- [[_COMMUNITY_Server API Environment|Server API Environment]]
- [[_COMMUNITY_Public Icon Assets|Public Icon Assets]]
- [[_COMMUNITY_ESLint Configuration|ESLint Configuration]]
- [[_COMMUNITY_Next Configuration|Next Configuration]]
- [[_COMMUNITY_PostCSS Configuration|PostCSS Configuration]]

## God Nodes (most connected - your core abstractions)
1. `requireAdmin()` - 17 edges
2. `compilerOptions` - 16 edges
3. `getAdminSupabase()` - 16 edges
4. `jsonError()` - 15 edges
5. `getEnvStatus()` - 9 edges
6. `buildOverviewData()` - 7 edges
7. `client-creator-accounts Edge Function` - 7 edges
8. `provisionCreatorAccount()` - 6 edges
9. `getDashboardStartDate()` - 6 edges
10. `requireEnv()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Globe Icon Asset` --conceptually_related_to--> `Internal Vercel Dashboard`  [AMBIGUOUS]
  public/globe.svg → README.md
- `Susly Dashboard` --semantically_similar_to--> `Susly Dashboard Repo Guide`  [INFERRED] [semantically similar]
  README.md → AGENTS.md
- `Vercel Logo Asset` --conceptually_related_to--> `Internal Vercel Dashboard`  [INFERRED]
  public/vercel.svg → README.md
- `Creator Mock Accounts` --semantically_similar_to--> `Creator Account Management`  [INFERRED] [semantically similar]
  README.md → client-creator-api-integration.md
- `Next.js Logo Asset` --conceptually_related_to--> `Next.js Agent Rules`  [INFERRED]
  public/next.svg → AGENTS.md

## Hyperedges (group relationships)
- **RevenueCat Supabase Webhook Drift Pattern** — revenuecat-subscription-reconciliation_revenuecat_webhook, revenuecat-subscription-reconciliation_test_store_app_scope_problem, revenuecat-subscription-reconciliation_subscription_drift, revenuecat-subscription-reconciliation_stale_supabase_active_rows [EXTRACTED 1.00]
- **Creator Account API Flow** — client-creator-api-integration_creator_accounts_screen, client-creator-api-integration_client_creator_accounts_edge_function, client-creator-api-integration_list_creators_endpoint, client-creator-api-integration_create_creator_endpoint, client-creator-api-integration_enable_disable_creator_endpoint [EXTRACTED 1.00]
- **Dashboard Operational Caution** — AGENTS_susly_ickcheck_product_family, AGENTS_live_connected_work_caution, AGENTS_ask_first_policy, README_supabase_service_role_key [INFERRED 0.78]

## Communities (18 total, 7 thin omitted)

### Community 0 - "Admin Creator APIs"
Cohesion: 0.13
Nodes (26): CreatorUpdateInput, GET(), PATCH(), POST(), AdminAuthError, AdminContext, jsonError(), requireAdmin() (+18 more)

### Community 1 - "Repo Guidance"
Cohesion: 0.09
Nodes (27): Ask-First Policy, Live-Connected Work Caution, Next.js Agent Rules, Susly Dashboard Repo Guide, Susly/Ickcheck Product Family, AGENTS.md Reference, ADMIN_EMAILS Allowlist, Creator Mock Accounts (+19 more)

### Community 2 - "Creator Account Provisioning"
Cohesion: 0.15
Nodes (21): email, supabase, email, supabase, bytesToHex(), createAdminSupabaseClient(), CreatorAccountsError, creatorCorsHeaders (+13 more)

### Community 3 - "Project Dependencies"
Cohesion: 0.08
Nodes (25): dependencies, clsx, lucide-react, next, react, react-dom, recharts, @supabase/supabase-js (+17 more)

### Community 4 - "Dashboard UI Components"
Cohesion: 0.10
Nodes (14): ApiState, CreatorProvisionResult, CreatorsTab(), emptyApiState, LoginPanel(), navItems, OverviewTab(), Tab (+6 more)

### Community 5 - "Dashboard Data Aggregation"
Cohesion: 0.19
Nodes (18): breakdown(), buildEmptyTrend(), CountFilter, countRows(), fetchAllRows(), getDashboardStartDate(), incrementTrend(), AdminUser (+10 more)

### Community 6 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 7 - "RevenueCat Subscriptions"
Cohesion: 0.14
Nodes (18): Susly/IckCheck Analytics, Paid Access Risk, Backfill Guidance, Dashboard Raw Subscription State, Ickcheck RevenueCat Project, Project-Wide Webhook Fix, RevenueCat, RevenueCat MCP (+10 more)

### Community 8 - "Next.js Pages"
Cohesion: 0.29
Nodes (8): Home(), DashboardApp(), CreatorsPage(), EnvStatus, getEnvStatus(), requiredServerEnv, OnboardingPage(), UsersPage()

### Community 9 - "Root Layout"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 10 - "Supabase Project Link"
Cohesion: 0.40
Nodes (4): name, organization_id, organization_slug, ref

## Ambiguous Edges - Review These
- `Internal Vercel Dashboard` → `Globe Icon Asset`  [AMBIGUOUS]
  public/globe.svg · relation: conceptually_related_to

## Knowledge Gaps
- **87 isolated node(s):** `config`, `name`, `version`, `private`, `dev` (+82 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Internal Vercel Dashboard` and `Globe Icon Asset`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Susly Dashboard` connect `Repo Guidance` to `RevenueCat Subscriptions`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Susly/IckCheck Analytics` connect `RevenueCat Subscriptions` to `Repo Guidance`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `config`, `name`, `version` to the rest of the system?**
  _87 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Creator APIs` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Repo Guidance` be split into smaller, more focused modules?**
  _Cohesion score 0.08547008547008547 - nodes in this community are weakly interconnected._
- **Should `Creator Account Provisioning` be split into smaller, more focused modules?**
  _Cohesion score 0.1476923076923077 - nodes in this community are weakly interconnected._