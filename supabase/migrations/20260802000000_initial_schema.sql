-- ARIA MVP initial schema
-- Tables: users, projects, sessions, messages, generated_documents

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.project_status as enum (
  'draft',
  'in_progress',
  'documents_ready',
  'approved'
);

create type public.session_status as enum (
  'draft',
  'in_progress',
  'completed',
  'documents_ready'
);

create type public.message_role as enum (
  'user',
  'assistant',
  'system'
);

create type public.doc_type as enum (
  'brd',
  'srs',
  'user_stories',
  'acceptance_criteria',
  'client_summary'
);

-- ---------------------------------------------------------------------------
-- users (profile extending auth.users)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_email_idx on public.users (email);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  client_name text not null,
  project_name text not null,
  industry text not null default '',
  brief text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  status public.project_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);
create index projects_status_idx on public.projects (status);
create index projects_updated_at_idx on public.projects (updated_at desc);

-- ---------------------------------------------------------------------------
-- sessions
-- Structured requirements live here (separate from generated documents).
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status public.session_status not null default 'in_progress',
  -- Structured requirements by section (businessGoals, users, features, ...)
  requirements jsonb not null default '{
    "businessGoals": [],
    "users": [],
    "features": [],
    "workflows": [],
    "businessRules": [],
    "integrations": [],
    "reports": [],
    "nonFunctional": []
  }'::jsonb,
  missing_categories text[] not null default '{}',
  ambiguities jsonb not null default '[]'::jsonb,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  current_section text,
  asked_count jsonb not null default '{
    "businessGoals": 0,
    "users": 0,
    "features": 0,
    "workflows": 0,
    "businessRules": 0,
    "integrations": 0,
    "reports": 0,
    "nonFunctional": 0
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index sessions_project_id_idx on public.sessions (project_id);
create index sessions_user_id_idx on public.sessions (user_id);
create index sessions_status_idx on public.sessions (status);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  role public.message_role not null,
  content text not null,
  section text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index messages_session_id_idx on public.messages (session_id);
create index messages_created_at_idx on public.messages (session_id, created_at);

-- ---------------------------------------------------------------------------
-- generated_documents
-- Stored separately from structured requirements on sessions.
-- ---------------------------------------------------------------------------
create table public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  doc_type public.doc_type not null,
  title text not null,
  content text not null,
  structured_content jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, doc_type, version)
);

create index generated_documents_session_id_idx on public.generated_documents (session_id);
create index generated_documents_project_id_idx on public.generated_documents (project_id);
create index generated_documents_user_id_idx on public.generated_documents (user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

create trigger generated_documents_set_updated_at
  before update on public.generated_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create public.users row when auth.users is created
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(excluded.name, public.users.name),
        avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.generated_documents enable row level security;

-- users
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- projects
create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);

-- sessions
create policy "sessions_select_own"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "sessions_insert_own"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "sessions_update_own"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sessions_delete_own"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- messages (via session ownership)
create policy "messages_select_own"
  on public.messages for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id and s.user_id = auth.uid()
    )
  );

create policy "messages_insert_own"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id and s.user_id = auth.uid()
    )
  );

create policy "messages_update_own"
  on public.messages for update
  using (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id and s.user_id = auth.uid()
    )
  );

create policy "messages_delete_own"
  on public.messages for delete
  using (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id and s.user_id = auth.uid()
    )
  );

-- generated_documents
create policy "generated_documents_select_own"
  on public.generated_documents for select
  using (auth.uid() = user_id);

create policy "generated_documents_insert_own"
  on public.generated_documents for insert
  with check (auth.uid() = user_id);

create policy "generated_documents_update_own"
  on public.generated_documents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "generated_documents_delete_own"
  on public.generated_documents for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Service-role helpers note:
-- Edge Functions using the service role key bypass RLS for server-side writes
-- after verifying the JWT. Client-side access remains scoped by policies above.
-- ---------------------------------------------------------------------------
