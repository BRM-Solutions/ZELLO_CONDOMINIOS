-- Storage centralizado + governanca: app.files (metadados), cota por organizacao, bucket privado e
-- policies de storage.objects. Binario no Storage, metadados e regras no Postgres.
-- Forward-only: nunca editar depois de aplicada. Detalhes: docs/12-storage-e-governanca.md

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Cota de armazenamento por organizacao (bytes). NULL = sem limite.
-- ---------------------------------------------------------------------------
alter table app.organizations add column if not exists storage_quota_bytes bigint
  check (storage_quota_bytes is null or storage_quota_bytes >= 0);

-- ---------------------------------------------------------------------------
-- app.files. Caminho do objeto: <organization_id>/<workspace_id|org>/<file_id>/<nome-sanitizado>.
-- uploaded_by sem FK: o arquivo sobrevive a exclusao do usuario (trilha em audit_log).
-- ---------------------------------------------------------------------------
create table if not exists app.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  workspace_id uuid,
  bucket text not null default 'private-files' check (char_length(bucket) between 3 and 63),
  object_path text not null unique check (char_length(object_path) between 3 and 1024),
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (char_length(mime_type) between 3 and 127),
  size_bytes bigint not null check (size_bytes >= 1),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  classification text not null default 'internal'
    check (classification in ('public', 'internal', 'confidential', 'personal')),
  status text not null default 'pending'
    check (status in ('pending', 'available', 'quarantined', 'deleted')),
  retention_until timestamptz,
  legal_hold boolean not null default false,
  uploaded_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (organization_id, workspace_id)
    references app.workspaces (organization_id, id) on delete cascade,
  constraint files_deleted_consistency check ((status = 'deleted') = (deleted_at is not null))
);
create index if not exists files_org_created_idx on app.files (organization_id, created_at desc);
create index if not exists files_workspace_idx on app.files (organization_id, workspace_id) where workspace_id is not null;
create index if not exists files_pending_idx on app.files (created_at) where status = 'pending';
create index if not exists files_deleted_idx on app.files (deleted_at) where status = 'deleted';
create index if not exists files_retention_idx on app.files (retention_until) where retention_until is not null;

drop trigger if exists files_updated_at on app.files;
create trigger files_updated_at before update on app.files
  for each row execute function app.set_updated_at();

-- Uso total da organizacao, ignorando a visibilidade por workspace da RLS (a cota e da organizacao).
create or replace function app.org_storage_used_bytes() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(f.size_bytes), 0)::bigint
  from app.files f
  where f.organization_id = app.current_org_id()
    and f.status <> 'deleted'
    and app.has_org_role()
$$;

-- ---------------------------------------------------------------------------
-- RLS deny-by-default (mesmo padrao das demais tabelas).
-- Escopo: arquivo de workspace -> membros desse workspace (owner/admin enxergam todos);
-- arquivo da organizacao (workspace_id null) -> so owner/admin.
-- A API nao tem DELETE: a remocao fisica e do worker.
-- ---------------------------------------------------------------------------
alter table app.files enable row level security;
revoke all on app.files from public, anon, authenticated;

grant select, insert on app.files to app_api;
grant update (status, size_bytes, mime_type, sha256, deleted_at) on app.files to app_api;
grant select, delete on app.files to app_worker;

drop policy if exists files_select on app.files;
create policy files_select on app.files for select to app_api
  using (organization_id = (select app.current_org_id())
     and ((workspace_id is null and (select app.has_org_role(array['owner', 'admin'])))
          or workspace_id in (select app.workspace_ids())));

drop policy if exists files_insert on app.files;
create policy files_insert on app.files for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and uploaded_by = (select app.current_user_id())
          and status = 'pending'
          and legal_hold = false
          and deleted_at is null
          and ((workspace_id is null and (select app.has_org_role(array['owner', 'admin'])))
               or workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager', 'staff']))));

-- Marcar como deleted exige papel de remocao (owner/admin/manager) e arquivo sem legal_hold e com retencao vencida
-- (a API nao altera essas colunas, entao o with check enxerga os valores da linha atual); complete/quarentena, papel de escrita.
drop policy if exists files_update on app.files;
create policy files_update on app.files for update to app_api
  using (organization_id = (select app.current_org_id())
     and status <> 'deleted'
     and ((workspace_id is null and (select app.has_org_role(array['owner', 'admin'])))
          or workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager', 'staff']))))
  with check (organization_id = (select app.current_org_id())
          and ((status <> 'deleted'
                and ((workspace_id is null and (select app.has_org_role(array['owner', 'admin'])))
                     or workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager', 'staff']))))
               or (status = 'deleted'
                   and legal_hold = false
                   and (retention_until is null or retention_until <= now())
                   and ((workspace_id is null and (select app.has_org_role(array['owner', 'admin'])))
                        or workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager']))))));

-- Worker: varre entre tenants (como o outbox) e remove so o que a regra de retencao permite.
drop policy if exists files_select_worker on app.files;
create policy files_select_worker on app.files for select to app_worker using (true);

drop policy if exists files_delete_worker on app.files;
create policy files_delete_worker on app.files for delete to app_worker
  using (organization_id = (select app.current_org_id())
     and legal_hold = false
     and ((status = 'deleted' and (retention_until is null or retention_until <= now()))
          or (status <> 'deleted' and retention_until is not null and retention_until <= now())
          or (status = 'pending' and created_at < now() - interval '24 hours')));

revoke execute on function app.org_storage_used_bytes() from public, anon, authenticated;
grant execute on function app.org_storage_used_bytes() to app_api, app_worker;

-- ---------------------------------------------------------------------------
-- Helper do Storage. O front tem a chave publishable e o JWT e pode chamar o Storage direto, sem a API:
-- as policies de storage.objects sao a barreira real, entao o helper confere o caminho E a linha de app.files.
-- Roda como o papel `authenticated` do Supabase, por isso usa auth.uid() (unico uso no projeto; security definer, search_path vazio).
-- Formato exigido: <organization_id>/<workspace_id|org>/<file_id>/<nome>, igual aos campos da linha de app.files.
--   read:   status available, ou pending do proprio uploader (o complete confere o objeto antes de liberar)
--   write:  pending do proprio uploader (a linha nasce no init; sem linha pending nao ha upload)
--   delete: so linha ja deleted, sem legal_hold e com retention_until nula ou vencida
-- Papel (membership ativa): read = qualquer; write = owner/admin/manager/staff; delete = owner/admin/manager.
-- Membro restrito a um workspace so alcanca o proprio; caminho 'org' exige membership da organizacao inteira.
create or replace function app.can_access_object(p_name text, p_mode text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_parts text[] := string_to_array(coalesce(p_name, ''), '/');
  v_roles text[] := case p_mode
    when 'read' then array['owner', 'admin', 'manager', 'staff', 'member']
    when 'write' then array['owner', 'admin', 'manager', 'staff']
    when 'delete' then array['owner', 'admin', 'manager']
  end;
  f app.files%rowtype;
begin
  if v_uid is null or v_roles is null or coalesce(array_length(v_parts, 1), 0) <> 4 then
    return false;
  end if;
  select * into f from app.files where object_path = p_name and bucket = 'private-files';
  if not found
     or v_parts[1] <> f.organization_id::text
     or v_parts[2] <> coalesce(f.workspace_id::text, 'org')
     or v_parts[3] <> f.id::text then
    return false;
  end if;
  if not (case p_mode
      when 'read' then f.status = 'available' or (f.status = 'pending' and f.uploaded_by = v_uid)
      when 'write' then f.status = 'pending' and f.uploaded_by = v_uid
      else f.status = 'deleted' and not f.legal_hold
           and (f.retention_until is null or f.retention_until <= now())
    end) then
    return false;
  end if;
  return exists (
    select 1 from app.memberships m
    where m.user_id = v_uid
      and m.organization_id = f.organization_id
      and m.status = 'active'
      and m.role = any (v_roles)
      and (m.workspace_id is null or m.workspace_id = f.workspace_id)
  );
end
$$;

-- Unicos grants ao papel `authenticated`: uso do schema e este helper. Nenhuma tabela, nenhuma outra funcao.
revoke execute on function app.can_access_object(text, text) from public, anon;
grant usage on schema app to authenticated;
grant execute on function app.can_access_object(text, text) to authenticated;

-- `authenticated` ganhou usage em app: fecha o execute implicito de PUBLIC nos helpers de contexto.
revoke execute on function app.current_user_id(), app.current_org_id(), app.set_updated_at() from public, anon;

-- ---------------------------------------------------------------------------
-- Bucket privado e policies. Protegido para ambientes sem o schema `storage` (Postgres puro).
-- Sem policy de UPDATE em storage.objects: sem upsert, objeto ja conferido nunca e sobrescrito.
-- Teto do bucket (50 MiB) >= FILE_MAX_BYTES da API; allowed_mime_types >= FILE_ALLOWED_MIME.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'private-files', 'private-files', false, 52428800,
      array[
        'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;

  if to_regclass('storage.objects') is not null then
    drop policy if exists private_files_select on storage.objects;
    create policy private_files_select on storage.objects for select to authenticated
      using (bucket_id = 'private-files' and app.can_access_object(name, 'read'));

    drop policy if exists private_files_insert on storage.objects;
    create policy private_files_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'private-files' and app.can_access_object(name, 'write'));

    drop policy if exists private_files_delete on storage.objects;
    create policy private_files_delete on storage.objects for delete to authenticated
      using (bucket_id = 'private-files' and app.can_access_object(name, 'delete'));
  end if;
end
$$;
