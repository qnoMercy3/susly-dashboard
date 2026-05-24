"use client";

import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Filter,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Session } from "@supabase/supabase-js";

import { compactNumber, formatDate, percent } from "@/lib/format";
import { getBrowserSupabase } from "@/lib/supabase";
import type { AdminUser, CreatorToolAccess, OnboardingData, OverviewData } from "@/lib/types";

export type Tab = "overview" | "onboarding" | "users" | "creators";

type ApiState = {
  onboarding: OnboardingData | null;
  overview: OverviewData | null;
  creators: CreatorToolAccess[];
};

type CreatorProvisionResult = {
  title: string;
  rows: Array<{ label: string; value: string }>;
  copyText: string;
};

type UsersPagePayload = {
  users: AdminUser[];
  nextOffset: number;
  hasMore: boolean;
};

const emptyApiState: ApiState = {
  onboarding: null,
  overview: null,
  creators: [],
};

const navItems: Array<{ id: Tab; href: string; icon: LucideIcon; label: string }> = [
  { id: "overview", href: "/", icon: BarChart3, label: "Overview" },
  { id: "onboarding", href: "/onboarding", icon: CheckCircle2, label: "Onboarding" },
  { id: "users", href: "/users", icon: Users, label: "Users" },
  { id: "creators", href: "/creators", icon: Lock, label: "Creators" },
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

function LoginFlag({
  completed,
  label,
}: {
  completed: boolean;
  label: string;
}) {
  return (
    <span className={completed ? "login-flag complete" : "login-flag"}>
      {completed ? "Completed" : "Pending"} {label}
    </span>
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
      <section className="stats-grid downloads-stats">
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

      <section className="overview-grid">
        <div className="panel">
          <SectionHeader eyebrow="Last 30 days" title="Growth trend" />
          <div className="chart">
            <ResponsiveContainer height={360} width="100%">
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
                <XAxis
                  dataKey="date"
                  minTickGap={24}
                  stroke="#7d6172"
                  tickFormatter={formatDate}
                  tickLine={false}
                />
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
      </section>
    </div>
  );
}

function BreakdownChart({
  title,
  data,
  mode,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  mode: "bar" | "pie";
}) {
  const chartData = data.slice(0, 8);
  const pieColors = ["#E76CAE", "#FB86C5", "#E773E6", "#F8A8D8", "#D95EA0", "#C955D8", "#F4B4D0", "#B84C87"];
  const yAxisWidth = Math.min(
    196,
    Math.max(
      112,
      chartData.reduce((maxWidth, entry) => Math.max(maxWidth, cleanLabel(entry.label).length * 7), 0),
    ),
  );

  return (
    <div className="panel">
      <SectionHeader eyebrow="Breakdown" title={title} />
      {data.length > 0 ? (
        mode === "bar" ? (
          <ResponsiveContainer height={250} width="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke="rgba(231,108,174,0.12)" horizontal={false} />
              <XAxis allowDecimals={false} stroke="#7d6172" type="number" />
              <YAxis
                dataKey="label"
                interval={0}
                stroke="#7d6172"
                tickFormatter={cleanLabel}
                tickLine={false}
                type="category"
                width={yAxisWidth}
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
          <div className="pie-breakdown">
            <div className="pie-breakdown-chart">
              <ResponsiveContainer height={250} width="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Tooltip
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(231,108,174,0.18)",
                      borderRadius: "16px",
                      color: "#210A16",
                    }}
                    formatter={(value) => [value, "Count"]}
                    labelFormatter={(value) => cleanLabel(String(value))}
                  />
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={chartData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={48}
                    outerRadius={82}
                    paddingAngle={3}
                    stroke="rgba(255,255,255,0.88)"
                    strokeWidth={2}
                  >
                    {chartData.map((entry, index) => (
                      <Cell fill={pieColors[index % pieColors.length]} key={entry.label} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="pie-breakdown-legend">
              {chartData.map((entry, index) => (
                <div className="pie-legend-item" key={entry.label}>
                  <span
                    className="pie-legend-swatch"
                    style={{ backgroundColor: pieColors[index % pieColors.length] }}
                  />
                  <div className="pie-legend-copy">
                    <strong>{cleanLabel(entry.label)}</strong>
                    <small>{entry.value}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <p className="empty">No data yet.</p>
      )}
    </div>
  );
}

function OnboardingTab({ onboarding }: { onboarding: OnboardingData }) {
  const [chartMode, setChartMode] = useState<"bar" | "pie">("bar");

  return (
    <div className="tab-panel">
      <div className="toolbar">
        <div className="view-toggle">
          <button
            className={chartMode === "bar" ? "active" : ""}
            onClick={() => setChartMode("bar")}
            type="button"
          >
            Bar
          </button>
          <button
            className={chartMode === "pie" ? "active" : ""}
            onClick={() => setChartMode("pie")}
            type="button"
          >
            Pie
          </button>
        </div>
      </div>
      <section className={`workspace-grid two${chartMode === "pie" ? " pie-mode" : ""}`}>
        <BreakdownChart data={onboarding.onboardingBreakdowns.identity} mode={chartMode} title="Identity" />
        <BreakdownChart
          data={onboarding.onboardingBreakdowns.relationship}
          mode={chartMode}
          title="Watched relationship"
        />
        <BreakdownChart data={onboarding.onboardingBreakdowns.reason} mode={chartMode} title="Reason" />
        <BreakdownChart data={onboarding.onboardingBreakdowns.worry} mode={chartMode} title="Main worry" />
        <BreakdownChart data={onboarding.onboardingBreakdowns.history} mode={chartMode} title="Betrayal history" />
      </section>
    </div>
  );
}

function UsersTab({
  session,
  refreshToken,
}: {
  session: Session;
  refreshToken: number;
}) {
  const PAGE_SIZE = 100;
  const [query, setQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "email">("newest");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [tierFilters, setTierFilters] = useState<string[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingPageRef = useRef(false);
  const hasMoreRef = useRef(true);
  const nextOffsetRef = useRef(0);
  const requestSerialRef = useRef(0);

  const loadUsersPage = useCallback(
    async (mode: "reset" | "append") => {
      if (mode === "append" && loadingPageRef.current) {
        return;
      }

      if (mode === "append" && !hasMoreRef.current) {
        return;
      }

      const offset = mode === "reset" ? 0 : nextOffsetRef.current;
      const requestSerial = requestSerialRef.current + 1;
      requestSerialRef.current = requestSerial;
      loadingPageRef.current = true;
      setLoadingPage(true);
      setUsersError(null);

      try {
        const payload = await apiFetch<UsersPagePayload>(
          `/api/admin/users?offset=${offset}&limit=${PAGE_SIZE}`,
          session,
        );

        if (requestSerial !== requestSerialRef.current) {
          return;
        }

        setUsers((current) => {
          if (mode === "reset") {
            return payload.users;
          }

          const existingIds = new Set(current.map((user) => user.id));
          return [
            ...current,
            ...payload.users.filter((user) => !existingIds.has(user.id)),
          ];
        });
        nextOffsetRef.current = payload.nextOffset;
        hasMoreRef.current = payload.hasMore;
        setHasMore(payload.hasMore);
      } catch (error) {
        if (requestSerial === requestSerialRef.current) {
          setUsersError(error instanceof Error ? error.message : "Failed to load users");
        }
      } finally {
        if (requestSerial === requestSerialRef.current) {
          loadingPageRef.current = false;
          setLoadingPage(false);
        }
      }
    },
    [session],
  );

  useEffect(() => {
    setUsers([]);
    nextOffsetRef.current = 0;
    hasMoreRef.current = true;
    setHasMore(true);
    void loadUsersPage("reset");
  }, [loadUsersPage, refreshToken]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadUsersPage("append");
        }
      },
      { rootMargin: "320px" },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [loadUsersPage]);

  const baseUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = (user: AdminUser) =>
      !needle || user.email?.toLowerCase().includes(needle);
    const matchesTier = (user: AdminUser) =>
      tierFilters.length === 0 || tierFilters.includes(user.subscription_tier ?? "none");

    return users.filter((user) => matchesQuery(user) && matchesTier(user));
  }, [query, tierFilters, users]);

  const statusPills = useMemo(() => {
    const counts = baseUsers.reduce<Record<string, number>>((accumulator, user) => {
      const key = user.subscription_status ?? "free";
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {});

    const statusesToShow = statusFilters.length > 0 ? statusFilters : ["active", "free"];
    return statusesToShow.map((status) => ({
      status,
      count: counts[status] ?? 0,
    }));
  }, [baseUsers, statusFilters]);

  const filteredUsers = useMemo(() => {
    const matchesStatus = (user: AdminUser) =>
      statusFilters.length === 0 || statusFilters.includes(user.subscription_status ?? "free");

    const nextUsers = baseUsers.filter((user) => matchesStatus(user)).slice();

    nextUsers.sort((left, right) => {
      if (sortBy === "email") {
        return (left.email ?? "").localeCompare(right.email ?? "");
      }

      const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
      const rightTime = right.created_at ? Date.parse(right.created_at) : 0;

      return sortBy === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });

    return nextUsers;
  }, [baseUsers, sortBy, statusFilters]);

  const toggleStatusFilter = (value: string) => {
    setStatusFilters((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
    );
  };

  const toggleTierFilter = (value: string) => {
    setTierFilters((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
    );
  };

  return (
    <div className="tab-panel">
      <div className="toolbar">
        <div className="toolbar-group">
          <div className="dropdown-shell">
            <button
              className={`toolbar-button${sortOpen ? " active" : ""}`}
              onClick={() => {
                setSortOpen((current) => !current);
                setFilterOpen(false);
              }}
              type="button"
            >
              <SlidersHorizontal size={16} />
              Sort
            </button>
            {sortOpen ? (
              <div className="dropdown-panel">
                {[
                  { id: "newest", label: "Newest first" },
                  { id: "oldest", label: "Oldest first" },
                  { id: "email", label: "Email A-Z" },
                ].map((option) => (
                  <button
                    className={`dropdown-option${sortBy === option.id ? " selected" : ""}`}
                    key={option.id}
                    onClick={() => {
                      setSortBy(option.id as "newest" | "oldest" | "email");
                      setSortOpen(false);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="dropdown-shell">
            <button
              className={`toolbar-button${filterOpen ? " active" : ""}`}
              onClick={() => {
                setFilterOpen((current) => !current);
                setSortOpen(false);
              }}
              type="button"
            >
              <Filter size={16} />
              Filter
            </button>
            {filterOpen ? (
              <div className="dropdown-panel wide">
                <div className="dropdown-section">
                  <span>Status</span>
                  {["free", "active"].map((value) => (
                    <label className="check-row" key={value}>
                      <input
                        checked={statusFilters.includes(value)}
                        onChange={() => toggleStatusFilter(value)}
                        type="checkbox"
                      />
                      {cleanLabel(value)}
                    </label>
                  ))}
                </div>
                <div className="dropdown-section">
                  <span>Tier</span>
                  {["weekly", "annual", "exclusive_annual"].map((value) => (
                    <label className="check-row" key={value}>
                      <input
                        checked={tierFilters.includes(value)}
                        onChange={() => toggleTierFilter(value)}
                        type="checkbox"
                      />
                      {cleanLabel(value)}
                    </label>
                  ))}
                </div>
                <button
                  className="dropdown-reset"
                  onClick={() => {
                    setStatusFilters([]);
                    setTierFilters([]);
                  }}
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>

          {statusPills.map((pill) => (
            <div className="count-pill" key={pill.status}>
              <span>{cleanLabel(pill.status)}</span>
              <strong>{pill.count}</strong>
            </div>
          ))}
        </div>
        <div className="searchbox">
          <Search size={16} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search email"
            value={query}
          />
        </div>
      </div>
      {usersError ? <div className="notice error">{usersError}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Created</th>
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
      <div className="load-more-sentinel" ref={sentinelRef}>
        {loadingPage ? (
          <Loader2 className="spin" size={18} />
        ) : hasMore ? (
          <button className="secondary" onClick={() => loadUsersPage("append")} type="button">
            Load more users
          </button>
        ) : (
          <span>All loaded</span>
        )}
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
  const [creatorEmail, setCreatorEmail] = useState("");
  const [creatorResult, setCreatorResult] = useState<CreatorProvisionResult | null>(null);
  const [creatorNotice, setCreatorNotice] = useState<string | null>(null);
  const [copiedProvisioningResult, setCopiedProvisioningResult] = useState(false);
  const [expandedCreatorIds, setExpandedCreatorIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const filteredCreators = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return creators;
    }

    return creators.filter((creator) => {
      const emailMatches = creator.email.toLowerCase().includes(needle);
      const appUserMatches = creator.app_user_id?.toLowerCase().includes(needle) ?? false;
      const mockAccountMatches = creator.mock_account_id.toLowerCase().includes(needle);
      return emailMatches || appUserMatches || mockAccountMatches;
    });
  }, [creators, query]);

  const createCreator = async () => {
    setBusy(true);
    setCreatorResult(null);
    setCreatorNotice(null);
    setCopiedProvisioningResult(false);

    try {
      const result = await apiFetch<{
        appPassword?: string | null;
        generatedAccessCode?: string | null;
        mode?: string;
      }>("/api/admin/creators", session, {
        method: "POST",
        body: JSON.stringify({
          email: creatorEmail,
        }),
      });

      const normalizedEmail = creatorEmail.trim().toLowerCase();
      setCreatorEmail("");
      const rows = [
        { label: "Email", value: normalizedEmail },
        { label: "App password", value: result.appPassword ?? "Not returned" },
        { label: "Tool access code", value: result.generatedAccessCode ?? "Not returned" },
      ];

      setCreatorResult({
        title: result.mode === "updated" ? "Creator reprovisioned" : "Creator created",
        rows,
        copyText: rows.map((row) => `${row.label}: ${row.value}`).join("\n"),
      });
      await onRefresh();
    } catch (error) {
      setCreatorNotice(error instanceof Error ? error.message : "Creator creation failed");
    } finally {
      setBusy(false);
    }
  };

  const setCreatorActiveState = async (id: string, isActive: boolean) => {
    setBusy(true);
    setCreatorResult(null);
    setCreatorNotice(null);

    try {
      await apiFetch("/api/admin/creators", session, {
        method: "PATCH",
        body: JSON.stringify({ id, isActive }),
      });
      setCreatorNotice(isActive ? "Creator access enabled." : "Creator access disabled.");
      await onRefresh();
    } catch (error) {
      setCreatorNotice(error instanceof Error ? error.message : "Failed to update creator access");
    } finally {
      setBusy(false);
    }
  };

  const copyProvisioningResult = async () => {
    if (!creatorResult) {
      return;
    }

    try {
      await navigator.clipboard.writeText(creatorResult.copyText);
      setCopiedProvisioningResult(true);
    } catch {
      setCreatorNotice("Copy failed. Please copy the details manually.");
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedCreatorIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
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
              <span>App-linked creators</span>
              <strong>
                {compactNumber(creators.filter((creator) => Boolean(creator.app_user_id)).length)}
              </strong>
            </div>
            <div>
              <span>App logins</span>
              <strong>
                {compactNumber(creators.filter((creator) => creator.app_login_completed).length)}
              </strong>
            </div>
            <div>
              <span>Tool logins</span>
              <strong>
                {compactNumber(
                  creators.filter((creator) => creator.creator_tool_login_completed).length,
                )}
              </strong>
            </div>
          </div>
          <p className="muted-copy">
            This dashboard now manages creator access only. Mock profiles stay in the separate
            creator tool.
          </p>
        </div>

        <div className="panel">
          <SectionHeader eyebrow="Provisioning" title="Create creator account" />
          <div className="form-grid">
            <label>
              Email
              <input
                onChange={(event) => setCreatorEmail(event.target.value)}
                placeholder="creator@susly.app"
                type="email"
                value={creatorEmail}
              />
            </label>
            <button disabled={busy || !creatorEmail} onClick={createCreator}>
              <Plus size={16} />
              Create creator
            </button>
            {creatorNotice ? <p className="form-message">{creatorNotice}</p> : null}
            {creatorResult ? (
              <div className="provisioning-result">
                <div className="provisioning-result-header">
                  <div className="provisioning-result-title">
                    <strong>{creatorResult.title}</strong>
                    <span>Credentials ready</span>
                  </div>
                  <button className="secondary" onClick={copyProvisioningResult} type="button">
                    <Copy size={15} />
                    {copiedProvisioningResult ? "Copied" : "Copy all"}
                  </button>
                </div>
                <div className="provisioning-result-rows">
                  {creatorResult.rows.map((row) => (
                    <div className="provisioning-result-row" key={row.label}>
                      <span className="provisioning-result-label">{row.label}</span>
                      <strong className="provisioning-result-value">{row.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="toolbar">
        <div className="searchbox">
          <Search size={16} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search creator, app user, or mock account"
            value={query}
          />
        </div>
      </div>

      <div className="creator-stack">
        {filteredCreators.map((creator) => (
          <section className="panel" key={creator.id}>
            <button
              className="creator-toggle"
              onClick={() => toggleExpanded(creator.id)}
              type="button"
            >
              <div className="creator-meta">
                <div>
                  <h3>{creator.email}</h3>
                </div>
                <span>{creator.is_active ? "Access enabled" : "Access disabled"}</span>
                <LoginFlag completed={creator.app_login_completed} label="app login" />
                <LoginFlag completed={creator.creator_tool_login_completed} label="tool login" />
                <span>{formatDate(creator.updated_at ?? creator.created_at)}</span>
              </div>
              {expandedCreatorIds.includes(creator.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {expandedCreatorIds.includes(creator.id) ? (
              <div className="creator-details">
                <div className="detail-grid">
                  <div>
                    <span>Email</span>
                    <strong>{creator.email}</strong>
                  </div>
                  <div>
                    <span>Tool access</span>
                    <strong>{creator.is_active ? "Enabled" : "Disabled"}</strong>
                  </div>
                  <div>
                    <span>App login</span>
                    <strong>
                      {creator.app_login_completed
                        ? formatDate(creator.app_login_completed_at)
                        : "Not completed"}
                    </strong>
                  </div>
                  <div>
                    <span>Creator tool login</span>
                    <strong>
                      {creator.creator_tool_login_completed
                        ? formatDate(creator.creator_tool_login_completed_at)
                        : "Not completed"}
                    </strong>
                  </div>
                  <div>
                    <span>App user ID</span>
                    <strong>{creator.app_user_id ?? "Not linked"}</strong>
                  </div>
                  <div>
                    <span>Mock account ID</span>
                    <strong>{creator.mock_account_id}</strong>
                  </div>
                  <div>
                    <span>Subscription</span>
                    <strong>{creator.subscription_status ?? "Unknown"}</strong>
                  </div>
                </div>
                <div className="creator-actions">
                  <button
                    className={creator.is_active ? "secondary" : ""}
                    disabled={busy}
                    onClick={() => setCreatorActiveState(creator.id, !creator.is_active)}
                    type="button"
                  >
                    {creator.is_active ? "Disable tool access" : "Enable tool access"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}

export function DashboardApp({
  configured,
  currentTab,
  missing,
}: {
  configured: boolean;
  currentTab: Tab;
  missing: string[];
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(configured);
  const [data, setData] = useState<ApiState>(emptyApiState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersRefreshToken, setUsersRefreshToken] = useState(0);

  const loadData = useCallback(async (activeSession: Session | null, tab: Tab = currentTab) => {
    if (!activeSession) {
      return;
    }

    if (tab === "users") {
      setUsersRefreshToken((current) => current + 1);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (tab === "creators") {
        const creatorsPayload = await apiFetch<{ creators: CreatorToolAccess[] }>(
          "/api/admin/creators",
          activeSession,
        );

        setData((current) => ({
          ...current,
          creators: creatorsPayload.creators,
        }));
        return;
      }

      if (tab === "onboarding") {
        const onboarding = await apiFetch<OnboardingData>("/api/admin/onboarding", activeSession);
        setData((current) => ({
          ...current,
          onboarding,
        }));
        return;
      }

      const overview = await apiFetch<OverviewData>("/api/admin/overview", activeSession);
      setData((current) => ({
        ...current,
        overview,
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [currentTab]);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = getBrowserSupabase();

    supabase.auth.getSession().then(({ data: sessionData }) => {
      setSession(sessionData.session);
      setAuthLoading(false);
      if (sessionData.session) {
        void loadData(sessionData.session, currentTab);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void loadData(nextSession, currentTab);
      } else {
        setData(emptyApiState);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [configured, currentTab, loadData]);

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

  const onboarding = data.onboarding;
  const overview = data.overview;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">Susly</div>
          <p>Internal dashboard</p>
        </div>
        <nav>
          {navItems.map(({ href, id, icon: Icon, label }) => (
            <Link
              className={currentTab === id ? "active" : ""}
              href={href}
              key={id}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <button className="signout" onClick={() => getBrowserSupabase().auth.signOut()}>
          Sign out
        </button>
      </aside>

      <section className="main-surface">
        <header className="topbar">
          <div>
            <h1>Susly Statistics</h1>
          </div>
          <button disabled={loading} onClick={() => loadData(session, currentTab)}>
            {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </header>

        {error ? <div className="notice error">{error}</div> : null}

        {currentTab === "overview" && !overview ? (
          <div className="loading-shell in-app">
            <Loader2 className="spin" />
          </div>
        ) : currentTab === "onboarding" && !onboarding ? (
          <div className="loading-shell in-app">
            <Loader2 className="spin" />
          </div>
        ) : currentTab === "creators" && loading && data.creators.length === 0 ? (
          <div className="loading-shell in-app">
            <Loader2 className="spin" />
          </div>
        ) : (
          <>
            {currentTab === "overview" && overview ? <OverviewTab overview={overview} /> : null}
            {currentTab === "onboarding" && onboarding ? <OnboardingTab onboarding={onboarding} /> : null}
            {currentTab === "users" ? (
              <UsersTab refreshToken={usersRefreshToken} session={session} />
            ) : null}
            {currentTab === "creators" ? (
              <CreatorsTab
                creators={data.creators}
                onRefresh={() => loadData(session, "creators")}
                session={session}
              />
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
