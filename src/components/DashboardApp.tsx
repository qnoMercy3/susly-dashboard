"use client";

import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Session } from "@supabase/supabase-js";

import { compactNumber, formatDate, percent } from "@/lib/format";
import { getBrowserSupabase } from "@/lib/supabase";
import type { AdminUser, CreatorToolAccess, OverviewData } from "@/lib/types";

type Tab = "overview" | "onboarding" | "users" | "creators";

type ApiState = {
  overview: OverviewData | null;
  users: AdminUser[];
  creators: CreatorToolAccess[];
};

const emptyApiState: ApiState = {
  overview: null,
  users: [],
  creators: [],
};

const navItems: Array<{ id: Tab; icon: LucideIcon; label: string }> = [
  { id: "overview", icon: BarChart3, label: "Overview" },
  { id: "onboarding", icon: CheckCircle2, label: "Onboarding" },
  { id: "users", icon: Users, label: "Users" },
  { id: "creators", icon: Lock, label: "Creators" },
];

function cleanLabel(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

async function apiFetch<T>(path: string, session: Session, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload as T;
}

function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signInWithPassword = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const { error } = await getBrowserSupabase().auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const sendMagicLink = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const { error } = await getBrowserSupabase().auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: false,
        },
      });

      if (error) {
        throw error;
      }

      setStatus("Magic link sent. Open it from the same browser to continue.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Magic link failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-panel">
        <div className="mark">
          <Lock size={18} />
          Internal only
        </div>
        <h1>Susly dashboard</h1>
        <p>
          Admin analytics and mock account control for IckCheck and the Instagram clone.
        </p>

        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@susly.app"
            type="email"
            value={email}
          />
        </label>

        <label>
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Optional if using magic link"
            type="password"
            value={password}
          />
        </label>

        <div className="login-actions">
          <button disabled={loading || !email || !password} onClick={signInWithPassword}>
            {loading ? <Loader2 className="spin" size={16} /> : null}
            Sign in
          </button>
          <button className="secondary" disabled={loading || !email} onClick={sendMagicLink}>
            Send magic link
          </button>
        </div>

        {status ? <p className="form-message">{status}</p> : null}
      </div>
    </main>
  );
}

function SetupPanel({ missing }: { missing: string[] }) {
  return (
    <main className="login-shell">
      <div className="login-panel wide">
        <div className="mark warn">
          <AlertCircle size={18} />
          Setup required
        </div>
        <h1>Connect Supabase</h1>
        <p>
          Add these environment variables locally and in Vercel before using the dashboard.
        </p>
        <pre>{missing.join("\n")}</pre>
      </div>
    </main>
  );
}

function OverviewTab({ overview }: { overview: OverviewData }) {
  const stats = overview.stats;

  return (
    <div className="tab-panel">
      <section className="stats-grid">
        <StatTile label="Downloads" note="First opens already tracked" value={compactNumber(stats.downloads)} />
        <StatTile label="Users" note="Registered accounts" value={compactNumber(stats.users)} />
        <StatTile
          label="Onboarding"
          note="Completions / downloads"
          value={percent(stats.completionRate)}
        />
        <StatTile
          label="Active users"
          note="Trial or paid status"
          value={compactNumber(stats.activeOrTrialUsers)}
        />
        <StatTile
          label="Mock accounts"
          note="Free creator/demo access"
          value={compactNumber(stats.mockAccounts)}
        />
        <StatTile
          label="Mock profiles"
          note="Instagram clone data"
          value={compactNumber(stats.mockProfiles)}
        />
      </section>

      <section className="workspace-grid">
        <div className="panel span-2">
          <SectionHeader eyebrow="Last 30 days" title="Growth trend" />
          <div className="chart">
            <ResponsiveContainer height={320} width="100%">
              <AreaChart data={overview.trends}>
                <defs>
                  <linearGradient id="downloads" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#FB86C5" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#FB86C5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="onboarding" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#E773E6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#E773E6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(231,108,174,0.12)" vertical={false} />
                <XAxis dataKey="date" minTickGap={24} stroke="#7d6172" tickLine={false} />
                <YAxis allowDecimals={false} stroke="#7d6172" tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(231,108,174,0.18)",
                    borderRadius: "16px",
                    color: "#210A16",
                  }}
                />
                <Area dataKey="downloads" fill="url(#downloads)" stroke="#FB86C5" strokeWidth={2} />
                <Area dataKey="users" fill="transparent" stroke="#E76CAE" strokeWidth={2} />
                <Area dataKey="onboarding" fill="url(#onboarding)" stroke="#E773E6" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <SectionHeader eyebrow="Operations" title="Scrape status" />
          <div className="status-stack">
            <div>
              <span>Pending / running</span>
              <strong>{compactNumber(stats.pendingScrapes)}</strong>
            </div>
            <div>
              <span>Failed</span>
              <strong>{compactNumber(stats.failedScrapes)}</strong>
            </div>
            <div>
              <span>Tracked profiles</span>
              <strong>{compactNumber(stats.trackedProfiles)}</strong>
            </div>
            <div>
              <span>Active relationships</span>
              <strong>{compactNumber(stats.activeTrackingRelationships)}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function BreakdownChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="panel">
      <SectionHeader eyebrow="Breakdown" title={title} />
      {data.length > 0 ? (
        <ResponsiveContainer height={250} width="100%">
          <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid stroke="rgba(231,108,174,0.12)" horizontal={false} />
            <XAxis allowDecimals={false} stroke="#7d6172" type="number" />
            <YAxis
              dataKey="label"
              stroke="#7d6172"
              tickFormatter={cleanLabel}
              tickLine={false}
              type="category"
              width={112}
            />
            <Tooltip
              contentStyle={{
                background: "#FFFFFF",
                border: "1px solid rgba(231,108,174,0.18)",
                borderRadius: "16px",
                color: "#210A16",
              }}
            />
            <Bar dataKey="value" fill="#E76CAE" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="empty">No data yet.</p>
      )}
    </div>
  );
}

function OnboardingTab({ overview }: { overview: OverviewData }) {
  return (
    <div className="tab-panel">
      <div className="notice">
        <CheckCircle2 size={18} />
        V1 uses existing data only. Exact step-level drop-off is not available until the app records step events.
      </div>
      <section className="workspace-grid two">
        <BreakdownChart data={overview.onboardingBreakdowns.identity} title="Identity" />
        <BreakdownChart data={overview.onboardingBreakdowns.relationship} title="Watched relationship" />
        <BreakdownChart data={overview.onboardingBreakdowns.reason} title="Reason" />
        <BreakdownChart data={overview.onboardingBreakdowns.worry} title="Main worry" />
        <BreakdownChart data={overview.onboardingBreakdowns.history} title="Betrayal history" />
        <BreakdownChart data={overview.subscriptionBreakdown} title="Subscription status" />
      </section>
    </div>
  );
}

function UsersTab({ users }: { users: AdminUser[] }) {
  const [query, setQuery] = useState("");
  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return users;
    }

    return users.filter((user) => user.email?.toLowerCase().includes(needle));
  }, [query, users]);

  return (
    <div className="tab-panel">
      <div className="toolbar">
        <div className="searchbox">
          <Search size={16} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search email"
            value={query}
          />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Created</th>
              <th>Country</th>
              <th>Status</th>
              <th>Tier</th>
              <th>Profiles</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.email ?? "Unknown"}</td>
                <td>{formatDate(user.created_at)}</td>
                <td>{user.country ?? "Unknown"}</td>
                <td>{user.subscription_status ?? "free"}</td>
                <td>{user.subscription_tier ?? "none"}</td>
                <td>
                  {user.tracking_count ?? 0}/{user.tracking_quota ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreatorsTab({
  session,
  creators,
  onRefresh,
}: {
  session: Session;
  creators: CreatorToolAccess[];
  onRefresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [profileResult, setProfileResult] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    ownerMockAccountId: "",
    targetUsername: "",
    sourceProfileId: "",
    fullName: "",
    avatarUrl: "",
    followerCount: "",
    followingCount: "",
    postCount: "",
  });
  const [busy, setBusy] = useState(false);
  const selectedOwnerMockAccountId = profileForm.ownerMockAccountId || creators[0]?.mock_account_id || "";

  const filteredCreators = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return creators;
    }

    return creators
      .map((creator) => {
        const emailMatches = creator.email.toLowerCase().includes(needle);
        const matchingProfiles = creator.profiles.filter((profile) => {
          const username = profile.target_username.toLowerCase();
          const name = profile.profile_data?.fullName?.toLowerCase() ?? "";
          return username.includes(needle) || name.includes(needle);
        });

        if (emailMatches) {
          return creator;
        }

        if (matchingProfiles.length === 0) {
          return null;
        }

        return {
          ...creator,
          profiles: matchingProfiles,
        };
      })
      .filter((creator): creator is CreatorToolAccess => Boolean(creator));
  }, [creators, query]);

  const saveMockProfile = async () => {
    setBusy(true);
    setProfileResult(null);

    try {
      await apiFetch("/api/admin/mock-profiles", session, {
        method: "POST",
        body: JSON.stringify({
          ...profileForm,
          ownerMockAccountId: selectedOwnerMockAccountId,
          followerCount: Number(profileForm.followerCount || 0),
          followingCount: Number(profileForm.followingCount || 0),
          postCount: Number(profileForm.postCount || 0),
        }),
      });

      setProfileForm({
        ownerMockAccountId: selectedOwnerMockAccountId,
        targetUsername: "",
        sourceProfileId: "",
        fullName: "",
        avatarUrl: "",
        followerCount: "",
        followingCount: "",
        postCount: "",
      });
      setProfileResult("Profile saved.");
      await onRefresh();
    } catch (error) {
      setProfileResult(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setBusy(false);
    }
  };

  const deleteMockProfile = async (id: string) => {
    setBusy(true);
    setProfileResult(null);

    try {
      await apiFetch("/api/admin/mock-profiles", session, {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      setProfileResult("Profile deleted.");
      await onRefresh();
    } catch (error) {
      setProfileResult(error instanceof Error ? error.message : "Failed to delete profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tab-panel">
      <section className="workspace-grid two">
        <div className="panel">
          <SectionHeader eyebrow="Access" title="Creator tool access" />
          <div className="status-stack">
            <div>
              <span>Creator records</span>
              <strong>{compactNumber(creators.length)}</strong>
            </div>
            <div>
              <span>Active creators</span>
              <strong>{compactNumber(creators.filter((creator) => creator.is_active).length)}</strong>
            </div>
            <div>
              <span>Assigned mock profiles</span>
              <strong>
                {compactNumber(
                  creators.reduce((total, creator) => total + creator.profiles.length, 0),
                )}
              </strong>
            </div>
          </div>
          <p className="muted-copy">
            Profiles in this tab are now grouped from `creator_tool_access` through each
            creator&apos;s `mock_account_id`.
          </p>
        </div>

        <div className="panel">
          <SectionHeader eyebrow="Mock data" title="Add profile to creator" />
          <div className="form-grid">
            <label>
              Creator
              <select
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    ownerMockAccountId: event.target.value,
                  }))
                }
                value={selectedOwnerMockAccountId}
              >
                <option value="">Select creator</option>
                {creators.map((creator) => (
                  <option key={creator.id} value={creator.mock_account_id}>
                    {creator.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid compact">
            {Object.entries(profileForm).map(([key, value]) => (
              key === "ownerMockAccountId" ? null : (
              <label key={key}>
                {cleanLabel(key)}
                <input
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  value={value}
                />
              </label>
              )
            ))}
              <button
                disabled={busy || !selectedOwnerMockAccountId || !profileForm.targetUsername}
                onClick={saveMockProfile}
              >
                <Plus size={16} />
                Save profile
              </button>
            </div>
            {profileResult ? <p className="form-message">{profileResult}</p> : null}
          </div>
        </div>
      </section>

      <div className="toolbar">
        <div className="searchbox">
          <Search size={16} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search creator or profile"
            value={query}
          />
        </div>
      </div>

      <div className="creator-stack">
        {filteredCreators.map((creator) => (
          <section className="panel" key={creator.id}>
            <SectionHeader
              eyebrow={creator.is_active ? "Active creator" : "Inactive creator"}
              title={creator.email}
            >
              <div className="creator-meta">
                <span>{compactNumber(creator.profiles.length)} profiles</span>
                <span>{formatDate(creator.updated_at ?? creator.created_at)}</span>
              </div>
            </SectionHeader>

            {creator.profiles.length > 0 ? (
              <div className="table-wrap inner">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Name</th>
                      <th>Source ID</th>
                      <th>Following</th>
                      <th>Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {creator.profiles.map((profile) => (
                      <tr key={profile.id}>
                        <td>@{profile.target_username}</td>
                        <td>{profile.profile_data?.fullName ?? "Unknown"}</td>
                        <td>{profile.source_profile_id ?? "None"}</td>
                        <td>{profile.following_count}</td>
                        <td>{formatDate(profile.updated_at)}</td>
                        <td>
                          <button
                            className="icon-button"
                            disabled={busy}
                            onClick={() => deleteMockProfile(profile.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty inline">No mock profiles assigned to this creator yet.</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export function DashboardApp({ configured, missing }: { configured: boolean; missing: string[] }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(configured);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<ApiState>(emptyApiState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [overview, usersPayload, mockPayload] = await Promise.all([
        apiFetch<OverviewData>("/api/admin/overview", activeSession),
        apiFetch<{ users: AdminUser[] }>("/api/admin/users", activeSession),
        apiFetch<{ creators: CreatorToolAccess[] }>("/api/admin/creators", activeSession),
      ]);

      setData({
        overview,
        users: usersPayload.users,
        creators: mockPayload.creators,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = getBrowserSupabase();

    supabase.auth.getSession().then(({ data: sessionData }) => {
      setSession(sessionData.session);
      setAuthLoading(false);
      if (sessionData.session) {
        void loadData(sessionData.session);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void loadData(nextSession);
      } else {
        setData(emptyApiState);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [configured, loadData]);

  if (!configured) {
    return <SetupPanel missing={missing} />;
  }

  if (authLoading) {
    return (
      <main className="loading-shell">
        <Loader2 className="spin" />
      </main>
    );
  }

  if (!session) {
    return <LoginPanel />;
  }

  const overview = data.overview;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">Susly</div>
          <p>Internal dashboard</p>
        </div>
        <nav>
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => setTab(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <button className="signout" onClick={() => getBrowserSupabase().auth.signOut()}>
          Sign out
        </button>
      </aside>

      <section className="main-surface">
        <header className="topbar">
          <div>
            <p>Dashboard</p>
            <h1>Clarity + control</h1>
          </div>
            <button disabled={loading} onClick={() => loadData(session)}>
            {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </header>

        {error ? <div className="notice error">{error}</div> : null}

        {!overview ? (
          <div className="loading-shell in-app">
            <Loader2 className="spin" />
          </div>
        ) : (
          <>
            {tab === "overview" ? <OverviewTab overview={overview} /> : null}
            {tab === "onboarding" ? <OnboardingTab overview={overview} /> : null}
            {tab === "users" ? <UsersTab users={data.users} /> : null}
            {tab === "creators" ? (
              <CreatorsTab creators={data.creators} onRefresh={() => loadData(session)} session={session} />
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
