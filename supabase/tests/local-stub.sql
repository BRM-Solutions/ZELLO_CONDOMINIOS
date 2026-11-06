-- Substitutos do que o Supabase hospedado já traz (auth, storage e papéis padrão).
-- Usado só pelo banco de teste local (scripts/test-db.mjs) e espelha o stub de apps/api/src/test/migrations.pglite.test.ts.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, aud text, role text, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text
);
alter table storage.objects enable row level security;

grant usage on schema auth, storage to authenticated;
grant execute on function auth.uid() to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
