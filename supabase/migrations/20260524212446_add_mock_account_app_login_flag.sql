alter table public.mock_accounts
  add column if not exists app_login_completed_at timestamp with time zone;

comment on column public.mock_accounts.app_login_completed_at
  is 'Set when a creator successfully logs in to the app mock account with the provided app credentials.';
