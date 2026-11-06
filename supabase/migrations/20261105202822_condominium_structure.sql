-- Migration: 20261105202822_condominium_structure.sql
-- Spec: docs/specs/spec-estrutura-condominio.md
-- Tipo: expand (aditiva: colunas novas anulaveis, tabelas novas, constraint de papel mais larga)
-- Rollback: forward-only. Para desfazer, criar NOVA migration. O que ela faria:
--   drop table if exists app.unit_members, app.people, app.units, app.blocks;  (somente se ainda nao houver dado real)
--   drop function if exists app.my_unit_ids();
--   restaurar os checks de papel de memberships sem 'council' (so se nao houver linha council).
-- Nunca editar esta migration depois de aplicada em qualquer ambiente.
-- Idempotente (if not exists / drop if exists): a suite PGlite aplica as migrations duas vezes.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Papel `council` (conselho): restrito a um condominio, como manager/staff/member.
-- Nomes das constraints preservados; linhas existentes continuam validas.
-- ---------------------------------------------------------------------------
alter table app.memberships
  drop constraint if exists memberships_role_check,
  drop constraint if exists memberships_scope_check;

alter table app.memberships
  add constraint memberships_role_check
    check (role in ('owner', 'admin', 'council', 'manager', 'staff', 'member')),
  add constraint memberships_scope_check check (
    (role in ('owner', 'admin') and workspace_id is null)
    or (role in ('council', 'manager', 'staff', 'member') and workspace_id is not null)
  );

-- ---------------------------------------------------------------------------
-- Condominio: slug (publico por desenho: login/cadastro) e endereco.
-- ---------------------------------------------------------------------------
alter table app.workspaces
  add column if not exists slug text
    check (slug is null or (char_length(slug) between 3 and 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')),
  add column if not exists address text
    check (address is null or char_length(address) between 1 and 200);

create unique index if not exists workspaces_slug_uidx on app.workspaces (slug) where slug is not null;

-- Referencia composta de app.people.photo_file_id: a foto precisa ser do mesmo tenant.
create unique index if not exists files_org_id_uidx on app.files (organization_id, id);

-- ---------------------------------------------------------------------------
-- Blocos e unidades (sem andar nem fracao ideal: decisao P3).
-- ---------------------------------------------------------------------------
create table if not exists app.blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  workspace_id uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, workspace_id) references app.workspaces (organization_id, id) on delete cascade,
  unique (organization_id, workspace_id, id)
);
create index if not exists blocks_org_ws_idx on app.blocks (organization_id, workspace_id);
create unique index if not exists blocks_workspace_name_uidx on app.blocks (workspace_id, lower(name));

create table if not exists app.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  workspace_id uuid not null,
  block_id uuid not null,
  number text not null check (char_length(number) between 1 and 20),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, workspace_id) references app.workspaces (organization_id, id) on delete cascade,
  foreign key (organization_id, workspace_id, block_id)
    references app.blocks (organization_id, workspace_id, id) on delete cascade,
  unique (organization_id, workspace_id, id)
);
create index if not exists units_org_ws_idx on app.units (organization_id, workspace_id);
create unique index if not exists units_block_number_uidx on app.units (block_id, lower(number));

-- ---------------------------------------------------------------------------
-- Pessoas (com ou sem login) e vinculos pessoa<->unidade com historico.
-- Telefone/WhatsApp: so cifrados (AES-256-GCM na API); phone_hash = HMAC para busca por igualdade.
-- ---------------------------------------------------------------------------
create table if not exists app.people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  workspace_id uuid not null,
  full_name text not null check (char_length(full_name) between 2 and 160),
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  phone_enc text,
  phone_hash text,
  whatsapp_enc text,
  photo_file_id uuid,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  access_status text not null default 'none'
    check (access_status in ('none', 'pending_approval', 'active', 'suspended')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, workspace_id) references app.workspaces (organization_id, id) on delete cascade,
  foreign key (organization_id, photo_file_id) references app.files (organization_id, id)
    on delete set null (photo_file_id),
  constraint people_workspace_email_key unique (workspace_id, email),
  unique (organization_id, workspace_id, id)
);
create index if not exists people_org_ws_idx on app.people (organization_id, workspace_id);
create index if not exists people_workspace_name_idx on app.people (workspace_id, lower(full_name));
create unique index if not exists people_workspace_user_uidx on app.people (workspace_id, user_id)
  where user_id is not null;

comment on column app.people.full_name is 'pii:name';
comment on column app.people.email is 'pii:email';
comment on column app.people.phone_enc is 'pii:phone (cifrado)';
comment on column app.people.phone_hash is 'pii:phone (hmac)';
comment on column app.people.whatsapp_enc is 'pii:phone (cifrado)';
comment on column app.people.photo_file_id is 'pii:photo';

create table if not exists app.unit_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  workspace_id uuid not null,
  unit_id uuid not null,
  person_id uuid not null,
  relation text not null check (relation in ('owner', 'tenant', 'resident', 'other')),
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, workspace_id) references app.workspaces (organization_id, id) on delete cascade,
  foreign key (organization_id, workspace_id, unit_id)
    references app.units (organization_id, workspace_id, id) on delete cascade,
  foreign key (organization_id, workspace_id, person_id)
    references app.people (organization_id, workspace_id, id) on delete cascade,
  constraint unit_members_period_check check (ends_on is null or ends_on >= starts_on)
);
create index if not exists unit_members_org_ws_idx on app.unit_members (organization_id, workspace_id);
create index if not exists unit_members_active_unit_idx on app.unit_members (unit_id) where ends_on is null;
create index if not exists unit_members_person_idx on app.unit_members (person_id);
create unique index if not exists unit_members_active_uidx on app.unit_members (unit_id, person_id)
  where ends_on is null;

drop trigger if exists blocks_updated_at on app.blocks;
create trigger blocks_updated_at before update on app.blocks
  for each row execute function app.set_updated_at();
drop trigger if exists units_updated_at on app.units;
create trigger units_updated_at before update on app.units
  for each row execute function app.set_updated_at();
drop trigger if exists people_updated_at on app.people;
create trigger people_updated_at before update on app.people
  for each row execute function app.set_updated_at();
drop trigger if exists unit_members_updated_at on app.unit_members;
create trigger unit_members_updated_at before update on app.unit_members
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper: unidades do usuario atual (vinculo vigente + pessoa com acesso ativo + membership ativa no condominio).
-- security definer + search_path vazio: le people/unit_members sem recursao de RLS.
-- ---------------------------------------------------------------------------
create or replace function app.my_unit_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select um.unit_id
  from app.unit_members um
  join app.people p
    on p.id = um.person_id
   and p.organization_id = um.organization_id
   and p.workspace_id = um.workspace_id
  where um.organization_id = app.current_org_id()
    and p.user_id = app.current_user_id()
    and p.access_status = 'active'
    and (um.ends_on is null or um.ends_on > current_date)
    and exists (
      select 1 from app.memberships m
      where m.user_id = p.user_id
        and m.organization_id = um.organization_id
        and m.status = 'active'
        and (m.workspace_id is null or m.workspace_id = um.workspace_id)
    )
$$;

revoke execute on function app.my_unit_ids() from public, anon, authenticated;
grant execute on function app.my_unit_ids() to app_api;

-- ---------------------------------------------------------------------------
-- RLS deny-by-default. Sem delete: inativar/encerrar (historico).
-- ---------------------------------------------------------------------------
alter table app.blocks enable row level security;
alter table app.units enable row level security;
alter table app.people enable row level security;
alter table app.unit_members enable row level security;

revoke all on app.blocks, app.units, app.people, app.unit_members from public, anon, authenticated;
grant select, insert, update on app.blocks, app.units, app.people, app.unit_members to app_api;

-- blocks e units: todos os papeis do condominio leem; owner/admin/manager escrevem.
drop policy if exists blocks_select on app.blocks;
create policy blocks_select on app.blocks for select to app_api
  using (organization_id = (select app.current_org_id())
     and workspace_id in (select app.workspace_ids()));

drop policy if exists blocks_insert on app.blocks;
create policy blocks_insert on app.blocks for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])));

drop policy if exists blocks_update on app.blocks;
create policy blocks_update on app.blocks for update to app_api
  using (organization_id = (select app.current_org_id())
     and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])))
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])));

drop policy if exists units_select on app.units;
create policy units_select on app.units for select to app_api
  using (organization_id = (select app.current_org_id())
     and workspace_id in (select app.workspace_ids()));

drop policy if exists units_insert on app.units;
create policy units_insert on app.units for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])));

drop policy if exists units_update on app.units;
create policy units_update on app.units for update to app_api
  using (organization_id = (select app.current_org_id())
     and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])))
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])));

-- people: gestao ve o diretorio; os demais papeis veem so a propria linha (council e staff nao veem pessoas).
drop policy if exists people_select on app.people;
create policy people_select on app.people for select to app_api
  using (organization_id = (select app.current_org_id())
     and (workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager']))
          or (user_id = (select app.current_user_id())
              and workspace_id in (select app.workspace_ids()))));

drop policy if exists people_insert on app.people;
create policy people_insert on app.people for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager']))
          and created_by = (select app.current_user_id()));

-- A linha propria so e editavel pelo dono; a API restringe a telefone/WhatsApp/foto (policy nao enxerga old/new).
drop policy if exists people_update on app.people;
create policy people_update on app.people for update to app_api
  using (organization_id = (select app.current_org_id())
     and (workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager']))
          or (user_id = (select app.current_user_id())
              and workspace_id in (select app.workspace_ids()))))
  with check (organization_id = (select app.current_org_id())
          and (workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager']))
               or (user_id = (select app.current_user_id())
                   and workspace_id in (select app.workspace_ids()))));

-- unit_members: gestao ve todos; os demais, os vinculos das proprias unidades.
drop policy if exists unit_members_select on app.unit_members;
create policy unit_members_select on app.unit_members for select to app_api
  using (organization_id = (select app.current_org_id())
     and (workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager']))
          or unit_id in (select app.my_unit_ids())));

drop policy if exists unit_members_insert on app.unit_members;
create policy unit_members_insert on app.unit_members for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager']))
          and created_by = (select app.current_user_id()));

drop policy if exists unit_members_update on app.unit_members;
create policy unit_members_update on app.unit_members for update to app_api
  using (organization_id = (select app.current_org_id())
     and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])))
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])));
