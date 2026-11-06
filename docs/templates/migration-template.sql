-- Migration: <AAAAMMDDHHMMSS>_<nome>.sql  (criar com: supabase migration new <nome>)
-- Spec: docs/specs/spec-<nome>.md
-- Tipo: expand | contract   (contract só depois que o código que não usa mais o objeto estiver em prod)
-- Rollback: forward-only. Para desfazer, criar NOVA migration. O que ela faria:
--   drop table if exists app.<tabela>;   (somente se ainda não houver dado real)
-- Nunca editar esta migration depois de aplicada em qualquer ambiente.
-- Helpers (app.current_org_id, app.current_user_id, app.workspace_ids, app.has_org_role,
-- app.set_updated_at) vêm da migration base: docs/02-banco-de-dados.md.
-- Nunca usar auth.uid() em policy: app_api não tem acesso ao schema auth no Supabase hospedado.

set lock_timeout = '5s';

create table app.<tabela> (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  <coluna> text not null check (char_length(<coluna>) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- cascade: a limpeza de testes apaga o tenant por organizations (docs/02 "Modelo base", DECIDIR p/ dado que precisa sobreviver).
  foreign key (organization_id, workspace_id) references app.workspaces (organization_id, id) on delete cascade
);

create index <tabela>_org_ws_created_idx on app.<tabela> (organization_id, workspace_id, created_at desc);

create trigger <tabela>_updated_at before update on app.<tabela>
  for each row execute function app.set_updated_at();

alter table app.<tabela> enable row level security;

create policy <tabela>_select on app.<tabela> for select to app_api
  using (organization_id = (select app.current_org_id())
     and workspace_id in (select app.workspace_ids()));

create policy <tabela>_insert on app.<tabela> for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager']))
          and created_by = (select app.current_user_id()));

create policy <tabela>_update on app.<tabela> for update to app_api
  using (organization_id = (select app.current_org_id())
     and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])))
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])));

create policy <tabela>_delete on app.<tabela> for delete to app_api
  using (organization_id = (select app.current_org_id())
     and (select app.has_org_role(array['owner', 'admin'])));

grant select, insert, update, delete on app.<tabela> to app_api;

-- Somente se um job processar esta tabela (escopo mínimo + policy "to app_worker" própria):
-- grant select, update (status) on app.<tabela> to app_worker;
