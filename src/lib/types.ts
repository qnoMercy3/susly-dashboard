export type TrendPoint = {
  date: string;
  downloads: number;
  users: number;
  onboarding: number;
};

export type BreakdownPoint = {
  label: string;
  value: number;
};

export type OverviewData = {
  generatedAt: string;
  stats: {
    downloads: number;
    users: number;
    onboardingCompletions: number;
    completionRate: number;
    activeOrTrialUsers: number;
    trackedProfiles: number;
    activeTrackingRelationships: number;
    mockAccounts: number;
    mockProfiles: number;
    pendingScrapes: number;
    failedScrapes: number;
  };
  trends: TrendPoint[];
  onboardingBreakdowns: {
    identity: BreakdownPoint[];
    relationship: BreakdownPoint[];
    reason: BreakdownPoint[];
    worry: BreakdownPoint[];
    history: BreakdownPoint[];
  };
  subscriptionBreakdown: BreakdownPoint[];
  scrapeStatusBreakdown: BreakdownPoint[];
};

export type AdminUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  tracking_count: number | null;
  tracking_quota: number | null;
  country: string | null;
  is_disabled: boolean;
};

export type MockProfile = {
  id: string;
  target_username: string;
  source_profile_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  owner_mock_account_id: string | null;
  profile_data: {
    fullName?: string;
    avatarUrl?: string | null;
    followerCount?: number;
    followingCount?: number;
    postCount?: number;
  } | null;
  following_count: number;
};

export type CreatorToolAccess = {
  id: string;
  email: string;
  mock_account_id: string;
  app_user_id: string | null;
  is_active: boolean;
  app_access_enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  tracking_quota: number | null;
};
