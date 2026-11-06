-- Base multi-tenant: organizations, workspaces, memberships, audit_log, outbox, inbound_events,
-- idempotency_keys, helpers, RLS e papeis.
-- Tabelas ficam no schema `app` (nao exposto pela Data API). Forward-only: nunca editar depois de aplicada.
-- Detalhes e racional: docs/02-banco-de-dados.md

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Papeis da aplicacao. LOGIN e senha NAO ficam no repo: defina uma vez por ambiente, fora do git:
--   alter role app_api    with login password '<gerada>';
--   alter role app_worker with login password '<gerada>';
-- Nenhum papel tem BYPASSRLS. Via pooler do Supabase o usuario e `app_api.<project-ref>`.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_api') then
    create role app_api nologin nobypassrls noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_worker') then
    create role app_worker nologin nobypassrls noinherit;
  end if;
end
$$;

alter role app_api set statement_timeout = '10s';
alter role app_api set idle_in_transaction_session_timeout = '15s';
alter role app_worker set idle_in_transaction_session_timeout = '30s';

create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to app_api, app_worker;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create or replace function app.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create table if not exists app.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- workspace = subdivisao opcional da organizacao. cnpj/city/state sao campos de exemplo: ajuste na primeira spec (docs/11-dominio.md).
create table if not exists app.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  cnpj text check (cnpj is null or cnpj ~ '^[0-9A-Z]{14}$'),
  city text check (city is null or char_length(city) between 1 and 120),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index if not exists workspaces_organization_id_idx on app.workspaces (organization_id);

create table if not exists app.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references app.organizations (id) on delete cascade,
  workspace_id uuid,
  role text not null check (role in ('owner', 'admin', 'manager', 'staff', 'member')),
  status text not null default 'active' check (status in ('invited', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, workspace_id)
    references app.workspaces (organization_id, id) on delete cascade,
  constraint memberships_scope_check check (
    (role in ('owner', 'admin') and workspace_id is null)
    or (role in ('manager', 'staff', 'member') and workspace_id is not null)
  ),
  unique nulls not distinct (user_id, organization_id, workspace_id)
);
create index if not exists memberships_user_id_idx on app.memberships (user_id) where status = 'active';
create index if not exists memberships_organization_id_idx on app.memberships (organization_id, workspace_id);

-- metadata: ids e campos alterados, nunca valores pessoais (LGPD).
-- Cascade a partir de organizations: uma linha apaga o tenant inteiro (usado pela limpeza de testes).
-- DECIDIR: em producao, se a auditoria precisar sobreviver a exclusao da organizacao, troque por set null.
create table if not exists app.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('user', 'worker', 'system')),
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null,
  entity_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_org_created_idx on app.audit_log (organization_id, created_at desc);
create index if not exists audit_log_entity_idx on app.audit_log (entity_type, entity_id);

-- Saida transacional: o produtor grava na mesma transacao da mudanca de negocio; o worker entrega.
create table if not exists app.outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  event_type text not null check (char_length(event_type) between 3 and 100),
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'retry', 'failed', 'unknown')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, aggregate_id)
);
create index if not exists outbox_claim_idx on app.outbox (next_attempt_at) where status in ('pending', 'retry');
create index if not exists outbox_processing_idx on app.outbox (updated_at) where status = 'processing';
create index if not exists outbox_organization_id_idx on app.outbox (organization_id);

-- Entrada idempotente de webhooks: UNIQUE (provider, provider_event_id) + on conflict do nothing.
create table if not exists app.inbound_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(provider) between 2 and 60),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 200),
  organization_id uuid references app.organizations (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);
create index if not exists inbound_events_unprocessed_idx on app.inbound_events (received_at) where processed_at is null;
create index if not exists inbound_events_organization_id_idx on app.inbound_events (organization_id);

-- Idempotency-Key de POSTs com efeito externo ou dinheiro, escopada por ator.
create table if not exists app.idempotency_keys (
  organization_id uuid not null references app.organizations (id) on delete cascade,
  actor_id uuid not null,
  endpoint text not null check (char_length(endpoint) between 1 and 200),
  key text not null check (char_length(key) between 8 and 200),
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  primary key (organization_id, actor_id, endpoint, key)
);
create index if not exists idempotency_keys_expires_at_idx on app.idempotency_keys (expires_at);

drop trigger if exists organizations_updated_at on app.organizations;
create trigger organizations_updated_at before update on app.organizations
  for each row execute function app.set_updated_at();
drop trigger if exists workspaces_updated_at on app.workspaces;
create trigger workspaces_updated_at before update on app.workspaces
  for each row execute function app.set_updated_at();
drop trigger if exists memberships_updated_at on app.memberships;
create trigger memberships_updated_at before update on app.memberships
  for each row execute function app.set_updated_at();
drop trigger if exists outbox_updated_at on app.outbox;
create trigger outbox_updated_at before update on app.outbox
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers de contexto. A API injeta usuario e organizacao por transacao (withTenantTx).
-- Nao usamos auth.uid(): papel customizado nao tem acesso ao schema auth no Supabase hospedado.
-- security definer + search_path vazio: lemos memberships sem recursao de RLS e sem sequestro de nome.
-- ---------------------------------------------------------------------------
create or replace function app.current_user_id() returns uuid
language sql stable set search_path = '' as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

create or replace function app.current_org_id() returns uuid
language sql stable set search_path = '' as $$
  select nullif(current_setting('app.org_id', true), '')::uuid
$$;

create or replace function app.has_org_role(p_roles text[] default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app.memberships m
    where m.user_id = app.current_user_id()
      and m.organization_id = app.current_org_id()
      and m.status = 'active'
      and (p_roles is null or m.role = any (p_roles))
  )
$$;

create or replace function app.workspace_ids(p_roles text[] default null) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select w.id
  from app.workspaces w
  join app.memberships m
    on m.organization_id = w.organization_id
   and (m.workspace_id is null or m.workspace_id = w.id)
  where w.organization_id = app.current_org_id()
    and m.user_id = app.current_user_id()
    and m.status = 'active'
    and (p_roles is null or m.role = any (p_roles))
$$;

revoke execute on function app.has_org_role(text[]), app.workspace_ids(text[]) from public, anon, authenticated;
grant execute on function
  app.current_user_id(), app.current_org_id(), app.has_org_role(text[]), app.workspace_ids(text[])
  to app_api, app_worker;

-- ---------------------------------------------------------------------------
-- RLS deny-by-default. Sem FORCE: o dono (postgres) precisa ler memberships dentro dos helpers.
-- Sem policy = negado. Uma policy por operacao; UPDATE sempre com using e with check.
-- Criar organizacao e o primeiro owner e fluxo de onboarding (fora do scaffold): nenhum papel da
-- aplicacao tem INSERT em organizations.
-- ---------------------------------------------------------------------------
alter table app.organizations enable row level security;
alter table app.workspaces enable row level security;
alter table app.memberships enable row level security;
alter table app.audit_log enable row level security;
alter table app.outbox enable row level security;
alter table app.inbound_events enable row level security;
alter table app.idempotency_keys enable row level security;

revoke all on
  app.organizations, app.workspaces, app.memberships, app.audit_log,
  app.outbox, app.inbound_events, app.idempotency_keys
  from public, anon, authenticated;

grant select, update on app.organizations to app_api;
grant select, insert, update, delete on app.workspaces to app_api;
grant select, insert, update, delete on app.memberships to app_api;
grant select, insert on app.audit_log to app_api;

grant select on app.organizations, app.workspaces, app.memberships to app_worker;
grant insert on app.audit_log to app_worker;

grant insert on app.outbox, app.inbound_events to app_api;
grant select, insert, update on app.idempotency_keys to app_api;

grant select, update on app.outbox to app_worker;
grant select, update on app.inbound_events to app_worker;
grant select, delete on app.idempotency_keys to app_worker;

-- organizations
drop policy if exists organizations_select on app.organizations;
create policy organizations_select on app.organizations for select to app_api
  using (id = (select app.current_org_id()) and (select app.has_org_role()));

drop policy if exists organizations_update on app.organizations;
create policy organizations_update on app.organizations for update to app_api
  using (id = (select app.current_org_id()) and (select app.has_org_role(array['owner', 'admin'])))
  with check (id = (select app.current_org_id()) and (select app.has_org_role(array['owner', 'admin'])));

drop policy if exists organizations_select_worker on app.organizations;
create policy organizations_select_worker on app.organizations for select to app_worker
  using (id = (select app.current_org_id()));

-- workspaces: owner/admin enxergam todos da organizacao; os demais papeis, so os seus.
drop policy if exists workspaces_select on app.workspaces;
create policy workspaces_select on app.workspaces for select to app_api
  using (organization_id = (select app.current_org_id())
     and id in (select app.workspace_ids()));

drop policy if exists workspaces_insert on app.workspaces;
create policy workspaces_insert on app.workspaces for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and (select app.has_org_role(array['owner', 'admin'])));

drop policy if exists workspaces_update on app.workspaces;
create policy workspaces_update on app.workspaces for update to app_api
  using (organization_id = (select app.current_org_id())
     and id in (select app.workspace_ids(array['owner', 'admin', 'manager'])))
  with check (organization_id = (select app.current_org_id())
          and id in (select app.workspace_ids(array['owner', 'admin', 'manager'])));

drop policy if exists workspaces_delete on app.workspaces;
create policy workspaces_delete on app.workspaces for delete to app_api
  using (organization_id = (select app.current_org_id())
     and (select app.has_org_role(array['owner', 'admin'])));

drop policy if exists workspaces_select_worker on app.workspaces;
create policy workspaces_select_worker on app.workspaces for select to app_worker
  using (organization_id = (select app.current_org_id()));

-- memberships: cada um le as proprias; owner/admin gerenciam as da organizacao.
-- Ninguem altera a propria membership e so owner mexe em owner (sem auto-promocao).
drop policy if exists memberships_select on app.memberships;
create policy memberships_select on app.memberships for select to app_api
  using (user_id = (select app.current_user_id())
      or (organization_id = (select app.current_org_id())
          and (select app.has_org_role(array['owner', 'admin']))));

drop policy if exists memberships_insert on app.memberships;
create policy memberships_insert on app.memberships for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and user_id <> (select app.current_user_id())
          and (select app.has_org_role(array['owner', 'admin']))
          and (role <> 'owner' or (select app.has_org_role(array['owner']))));

drop policy if exists memberships_update on app.memberships;
create policy memberships_update on app.memberships for update to app_api
  using (organization_id = (select app.current_org_id())
     and user_id <> (select app.current_user_id())
     and (select app.has_org_role(array['owner', 'admin']))
     and (role <> 'owner' or (select app.has_org_role(array['owner']))))
  with check (organization_id = (select app.current_org_id())
          and user_id <> (select app.current_user_id())
          and (select app.has_org_role(array['owner', 'admin']))
          and (role <> 'owner' or (select app.has_org_role(array['owner']))));

drop policy if exists memberships_delete on app.memberships;
create policy memberships_delete on app.memberships for delete to app_api
  using (organization_id = (select app.current_org_id())
     and user_id <> (select app.current_user_id())
     and (select app.has_org_role(array['owner', 'admin']))
     and (role <> 'owner' or (select app.has_org_role(array['owner']))));

drop policy if exists memberships_select_worker on app.memberships;
create policy memberships_select_worker on app.memberships for select to app_worker
  using (organization_id = (select app.current_org_id()));

-- audit_log: append-only (sem policy nem grant de update/delete).
drop policy if exists audit_log_select on app.audit_log;
create policy audit_log_select on app.audit_log for select to app_api
  using (organization_id = (select app.current_org_id())
     and (select app.has_org_role(array['owner', 'admin'])));

drop policy if exists audit_log_insert on app.audit_log;
create policy audit_log_insert on app.audit_log for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and actor_kind = 'user'
          and actor_user_id = (select app.current_user_id())
          and (select app.has_org_role()));

drop policy if exists audit_log_insert_worker on app.audit_log;
create policy audit_log_insert_worker on app.audit_log for insert to app_worker
  with check (organization_id = (select app.current_org_id())
          and actor_kind in ('worker', 'system'));

-- outbox: a API so insere (na transacao de negocio); o worker reivindica lotes entre tenants.
-- O worker so enxerga esta tabela sem contexto de organizacao; o trabalho de cada item roda em withWorkerTx(orgId).
drop policy if exists outbox_insert on app.outbox;
create policy outbox_insert on app.outbox for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and (select app.has_org_role()));

drop policy if exists outbox_select_worker on app.outbox;
create policy outbox_select_worker on app.outbox for select to app_worker using (true);

drop policy if exists outbox_update_worker on app.outbox;
create policy outbox_update_worker on app.outbox for update to app_worker using (true) with check (true);

-- inbound_events: rotas de webhook (sem usuario) so inserem; dedupe por UNIQUE + `on conflict do nothing` SEM alvo
-- (um alvo exigiria SELECT na tabela). Leitura e processamento no worker.
drop policy if exists inbound_events_insert on app.inbound_events;
create policy inbound_events_insert on app.inbound_events for insert to app_api with check (true);

drop policy if exists inbound_events_select_worker on app.inbound_events;
create policy inbound_events_select_worker on app.inbound_events for select to app_worker using (true);

drop policy if exists inbound_events_update_worker on app.inbound_events;
create policy inbound_events_update_worker on app.inbound_events for update to app_worker using (true) with check (true);

-- idempotency_keys: cada ator ve e grava so as proprias chaves; o worker limpa as expiradas.
drop policy if exists idempotency_keys_select on app.idempotency_keys;
create policy idempotency_keys_select on app.idempotency_keys for select to app_api
  using (organization_id = (select app.current_org_id())
     and actor_id = (select app.current_user_id()));

drop policy if exists idempotency_keys_insert on app.idempotency_keys;
create policy idempotency_keys_insert on app.idempotency_keys for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and actor_id = (select app.current_user_id())
          and (select app.has_org_role()));

drop policy if exists idempotency_keys_update on app.idempotency_keys;
create policy idempotency_keys_update on app.idempotency_keys for update to app_api
  using (organization_id = (select app.current_org_id())
     and actor_id = (select app.current_user_id()))
  with check (organization_id = (select app.current_org_id())
          and actor_id = (select app.current_user_id()));

drop policy if exists idempotency_keys_select_worker on app.idempotency_keys;
create policy idempotency_keys_select_worker on app.idempotency_keys for select to app_worker using (true);

drop policy if exists idempotency_keys_delete_worker on app.idempotency_keys;
create policy idempotency_keys_delete_worker on app.idempotency_keys for delete to app_worker
  using (expires_at < now());
