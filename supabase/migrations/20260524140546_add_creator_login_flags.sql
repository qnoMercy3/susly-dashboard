alter table public.creator_tool_access
  add column if not exists creator_tool_login_completed_at timestamp with time zone;

comment on column public.creator_tool_access.creator_tool_login_completed_at
  is 'Set when the creator successfully logs in to the creator tool with the provided creator access credentials.';
