# Banco de dados (Supabase Postgres)

> **Quando ler:** ao criar/alterar tabela, policy, índice, migration, função SQL ou qualquer código que abra transação.
> **Resumo:**
> - Tabelas no schema `app` (não exposto). Toda tabela de negócio tem `organization_id`, índice, RLS ligada e uma policy por operação.
> - A API conecta como `app_api` (sem `BYPASSRLS`) pelo pooler e só usa o banco via `withTenantTx`, que injeta usuário e organização com `set_config(..., true)`.
> - Policies usam `(select app.current_user_id())`/`(select app.current_org_id())` e helpers `security definer` com `search_path = ''`.
> - Migrations `supabase/migrations/<timestamp>_<nome>.sql`, forward-only; mudança incompatível = expand/contract em dois deploys.
> - Constraints (CHECK, UNIQUE, FK composta) são a última defesa: invariantes importantes moram no banco, não só no código.
> **Relacionados:** [arquitetura](01-arquitetura.md), [storage](12-storage-e-governanca.md), [segurança](03-seguranca.md), [testes](07-testes.md), [deploy](09-deploy-easypanel-supabase.md), [lições](08-licoes-aprendidas.md), `templates/migration-template.sql`

## Convenções

| Item | Regra |
|---|---|
| Nomes | `snake_case`, tabelas no plural (`workspaces`), FK `<entidade>_id`, índice `<tabela>_<colunas>_idx`, policy `<tabela>_<operacao>` |
| Chave | `id uuid primary key default gen_random_uuid()` (nativo no PG 13+) |
| Tempo | `timestamptz` sempre; `created_at`/`updated_at not null default now()`; trigger `app.set_updated_at` |
| Dinheiro | `bigint` em centavos + CHECK `>= 0`; nunca `float`/`numeric` sem escala definida |
| Estados | `text` + `CHECK (status in (...))`. Evite `create type ... enum`: adicionar/remover valor é chato e não pode ser usado na mesma transação em que foi criado. Tabela de domínio só quando o usuário edita a lista |
| Texto | `text` + CHECK de tamanho (`char_length(x) between 1 and 200`) |
| JSON | `jsonb` só para metadados sem regra; nada que vá em `WHERE` com frequência |
| Soft-delete | Só onde lei/auditoria exige (`deleted_at timestamptz`, índices parciais `where deleted_at is null`). O padrão é apagar ou anonimizar |
| Auditoria | Ações sensíveis vão para `app.audit_log` (append-only) |

## Modelo base multi-tenant

```sql
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

create or replace function app.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create table app.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  cnpj text check (cnpj is null or cnpj ~ '^[0-9A-Z]{14}$'),
  city text check (city is null or char_length(city) between 1 and 120),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index workspaces_organization_id_idx on app.workspaces (organization_id);

create table app.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references app.organizations(id) on delete cascade,
  workspace_id uuid,
  role text not null check (role in ('owner', 'admin', 'manager', 'staff', 'member')),
  status text not null default 'active' check (status in ('invited', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, workspace_id) references app.workspaces (organization_id, id) on delete cascade,
  constraint memberships_scope_check check (
    (role in ('owner', 'admin') and workspace_id is null)
    or (role in ('manager', 'staff', 'member') and workspace_id is not null)
  ),
  unique nulls not distinct (user_id, organization_id, workspace_id)
);
create index memberships_user_id_idx on app.memberships (user_id) where status = 'active';
create index memberships_organization_id_idx on app.memberships (organization_id, workspace_id);

create table app.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('user', 'worker', 'system')),
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null,
  entity_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_created_idx on app.audit_log (organization_id, created_at desc);
create index audit_log_entity_idx on app.audit_log (entity_type, entity_id);

create trigger organizations_updated_at before update on app.organizations for each row execute function app.set_updated_at();
create trigger workspaces_updated_at before update on app.workspaces for each row execute function app.set_updated_at();
create trigger memberships_updated_at before update on app.memberships for each row execute function app.set_updated_at();
```

- Ordem na migration inicial: papéis (§"Papéis") → schema → tabelas → helpers → policies → grants. `unique nulls not distinct` exige PG 15+ (projetos Supabase atuais estão em 15/17 [verificar]).
- `cnpj`, `city`, `state` em `workspaces` são **campos opcionais de exemplo** (comuns em SaaS B2B no Brasil): mantenha, renomeie ou remova numa migration nova conforme [domínio](11-dominio.md) §2.
- A FK composta `(organization_id, workspace_id)` é o padrão para **toda** tabela filha de workspace: impossível gravar uma linha da organização A apontando para workspace da B, mesmo com bug na API.
- **Exclusão de tenant (decisão do scaffold)**: todas as FKs para `organizations` são `on delete cascade` (inclusive `workspaces` e `audit_log`), para que um único `delete from app.organizations` apague o tenant de teste inteiro ([07](07-testes.md)). Em produção isso significa que excluir uma organização apaga também a trilha de auditoria dela. `DECIDIR:` antes do primeiro cliente — (a) manter cascade e tratar exclusão de organização como ação rara, só por runbook, após exportar o `audit_log`; (b) trocar `audit_log.organization_id` para nullable + `on delete set null` (a trilha sobrevive, desvinculada) e `workspaces` para `restrict` (exige apagar filhos explicitamente). Recomendação: (b) em migration nova antes do go-live; LGPD não obriga apagar auditoria sem PII, e a trilha é prova de quem fez o quê. Os testes continuam funcionando se a limpeza apagar `audit_log` antes da organização. Detalhe de segurança em [03](03-seguranca.md) §"LGPD".
- `audit_log` não guarda PII no `metadata` (ids e campos alterados, não valores pessoais). Sem grant de UPDATE/DELETE para ninguém da aplicação.
- FK para `auth.users` funciona porque as tabelas pertencem a `postgres` (dono das migrations) [verificar se a checagem de FK exige privilégio do papel que insere; se der `permission denied for schema auth`, troque por uma tabela `app.profiles` sincronizada].

## Funções helper (contexto da requisição)

`auth.uid()` **não funciona** para papel customizado no Supabase hospedado (`permission denied for schema auth`, e `grant usage on schema auth` não tem efeito). Por isso o kit usa helpers próprios que leem as mesmas configurações que `auth.uid()` lê.

```sql
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
  select c.id
  from app.workspaces c
  join app.memberships m
    on m.organization_id = c.organization_id
   and (m.workspace_id is null or m.workspace_id = c.id)
  where c.organization_id = app.current_org_id()
    and m.user_id = app.current_user_id()
    and m.status = 'active'
    and (p_roles is null or m.role = any (p_roles))
$$;

revoke execute on function app.has_org_role(text[]), app.workspace_ids(text[]) from public, anon, authenticated;
grant execute on function app.current_user_id(), app.current_org_id(), app.has_org_role(text[]), app.workspace_ids(text[]) to app_api, app_worker;
```

- `security definer` (dono `postgres`, que tem `bypassrls`) evita recursão: a policy de `memberships` não é reavaliada dentro do helper.
- Sempre `set search_path = ''` e nomes qualificados (`app.`, `auth.`). Sem isso, quem chama pode sequestrar um nome não qualificado.
- Helpers ficam em schema **não exposto** pela Data API e com `execute` revogado de `public`/`anon`/`authenticated`.

## RLS: deny-by-default

Regras: RLS ligada em toda tabela de `app` na mesma migration que a cria; uma policy por operação (`select`, `insert`, `update`, `delete`), sempre `to app_api` (ou `app_worker`); sem policy = negado. Funções sem dependência da linha vão dentro de `(select ...)` para virar initPlan (avaliada uma vez por query, não por linha).

Exemplo de tabela de negócio (o nome é ilustrativo; domínio real em [11](11-dominio.md)):

```sql
create table app.notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) <= 10000),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, workspace_id) references app.workspaces (organization_id, id) on delete cascade
);
create index notices_org_ws_created_idx on app.notices (organization_id, workspace_id, created_at desc);
create trigger notices_updated_at before update on app.notices for each row execute function app.set_updated_at();

alter table app.notices enable row level security;

create policy notices_select on app.notices for select to app_api
  using (organization_id = (select app.current_org_id())
     and workspace_id in (select app.workspace_ids()));

create policy notices_insert on app.notices for insert to app_api
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager']))
          and created_by = (select app.current_user_id()));

create policy notices_update on app.notices for update to app_api
  using (organization_id = (select app.current_org_id())
     and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])))
  with check (organization_id = (select app.current_org_id())
          and workspace_id in (select app.workspace_ids(array['owner', 'admin', 'manager'])));

create policy notices_delete on app.notices for delete to app_api
  using (organization_id = (select app.current_org_id())
     and (select app.has_org_role(array['owner', 'admin'])));

grant select, insert, update, delete on app.notices to app_api;
```

- UPDATE precisa de `using` (quais linhas posso tocar) **e** `with check` (para onde posso movê-las); sem o `with check`, alguém muda `organization_id` para outro tenant.
- Tabela só de organização (sem workspace): `organization_id = (select app.current_org_id()) and (select app.has_org_role(array[...]))`.
- `memberships`: SELECT permite `user_id = (select app.current_user_id())` (para listar minhas organizações) ou `has_org_role(array['owner','admin'])`; INSERT/UPDATE só `owner`/`admin`; ninguém se promove (CHECK no service + teste).
- `audit_log`: só policies de `select` (owner/admin da org) e `insert`; nenhuma de update/delete.
- Um teste de CI deve falhar se existir tabela em `app` com `rowsecurity = false` ou sem policy. SQL em [03](03-seguranca.md) §"Testar isolamento".

## Arquivos (`app.files`) e quota

- Metadados de arquivo ficam em `app.files` (RLS como as demais; `object_path` único, `classification`, `status`, `retention_until`, `legal_hold`, soft delete com `deleted_at`); o binário fica no Storage. DDL, policies de `storage.objects` e o helper `app.can_access_object`: [12](12-storage-e-governanca.md) §"Modelo".
- Quota por organização: `app.organizations.storage_quota_bytes` (`bigint`, null = sem limite), conferida pela API no init do upload com `app.org_storage_used_bytes()`.
- Exceção documentada a "nada para `authenticated`": `usage` no schema `app` + `execute` só em `app.can_access_object`, para o Storage. O motivo e o teste de catálogo estão no [12](12-storage-e-governanca.md).

## Papéis `app_api` e `app_worker`

```sql
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_api') then
    create role app_api nologin nobypassrls noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_worker') then
    create role app_worker nologin nobypassrls noinherit;
  end if;
end $$;
grant usage on schema app to app_api, app_worker;
alter role app_api set statement_timeout = '10s';
alter role app_api set idle_in_transaction_session_timeout = '15s';
```

- Senha e `LOGIN` são definidos **fora do git**, uma vez por ambiente: `alter role app_api with login password '<gerada>';` (procedimento em [09](09-deploy-easypanel-supabase.md)). Migration nunca contém senha.
- Grants explícitos por tabela, na migration da tabela. `app_worker` só recebe o que os jobs usam (ex.: `outbox`, `inbound_events`, leitura das tabelas que o job lê).
- Não use `grant authenticated to app_api`: daria a `app_api` tudo que `authenticated` tem (inclusive em `public`) e acopla a API à Data API.
- `postgres`/`service_role` só para migrations e operação manual; nunca em `DATABASE_URL` da API ou do worker.

## `withTenantTx`

Código real em `apps/api/src/db.ts` (resumo das assinaturas):

```ts
runInTx<T>(db: Db, settings: Record<string, string>, fn: (client: PoolClient) => Promise<T>, options?: { readOnly?: boolean }): Promise<T>
withTenantTx<T>(req: Request, fn: (client: PoolClient) => Promise<T>, options?): Promise<T>
withWorkerTx<T>(db: Db, orgId: string | null, fn: (client: PoolClient) => Promise<T>, options?): Promise<T>
```

- `runInTx` faz `begin` (ou `begin read only`), um `select set_config($1, $2, true)` por chave, `fn`, `commit`; em erro, `rollback` e, se o rollback falhar, `client.release(true)` descarta a conexão quebrada.
- `withTenantTx` pega o pool de `req.app.locals.db` (`getDb(req)`) e injeta `request.jwt.claim.sub` (`req.auth.userId`), `app.org_id` (`req.membership?.organizationId`) e `app.request_id`; sem `req.auth` lança `AUTH_REQUIRED`.

- `is_local = true` limita o valor à transação: com pooler em modo transação, a próxima requisição que pegar a mesma conexão não herda o usuário anterior. Nunca use `set` sem `local` nem `set_config(..., false)`.
- `withWorkerTx(db, orgId, fn)` recebe o pool **injetado** (o worker cria o seu em `worker.ts`), sem usuário (`request.jwt.claim.sub` vazio) e com policies `to app_worker` específicas; `orgId = null` para jobs que varrem todas as organizações (ex.: claim do outbox).
- Repositórios recebem o `client`; `pool.query` direto só em `/ready`.

## Pooler (Supavisor)

- API e worker: modo transação, porta `6543`, usuário `app_api.<project-ref>` (papel customizado pelo pooler compartilhado usa `<papel>.<project-ref>`).
- Modo transação não suporta prepared statements nomeados: com `pg`, nunca passe `name` na query. Também proibidos: `SET` de sessão, `LISTEN/NOTIFY`, tabelas temporárias, `pg_advisory_lock` de sessão (use `pg_advisory_xact_lock`).
- `Pool({ max })` pequeno (5–10 por réplica); some réplicas × `max` e mantenha abaixo do limite do plano [verificar limite de clientes do pooler por tamanho de compute].
- Migrations e `pg_dump` usam conexão direta ou modo sessão (5432); a conexão direta é IPv6 por padrão (IPv4 é add-on) [verificar se o runner do CI tem IPv6; senão use o pooler em modo sessão].

## Migrations

- Criar: `supabase migration new <nome>` → `supabase/migrations/<YYYYMMDDHHMMSS>_<nome>.sql` (ou `scripts/new-migration.sh <nome>`, que já parte de `docs/templates/migration-template.sql`). Lição: numeração sequencial (`022_...`) colidiu entre branches e gerou dois arquivos com o mesmo número.
- **Forward-only**: migration aplicada nunca é editada. Reverter = nova migration que desfaz. Teste a migration em `dev` (CI) antes de `prod` (gate manual). Fluxo de CI: [09](09-deploy-easypanel-supabase.md).
- Comece com `set lock_timeout = '5s';` para não travar produção esperando lock.
- **Expand/contract** para mudança incompatível (renomear coluna, trocar UNIQUE, tornar NOT NULL):
  1. Expand: adiciona o novo (coluna nullable, índice, constraint `not valid`), código passa a escrever nos dois.
  2. Backfill em lotes pequenos (job ou migration de dados revisada).
  3. `alter table ... validate constraint`, código passa a ler só o novo.
  4. Contract em **outro deploy**: remove o antigo. Exemplo típico: uma constraint antiga só podia ser removida depois que o código novo estivesse no ar; ficou numa migration separada com aviso no topo.
- Índice em tabela grande: `create index concurrently` (não roda dentro de transação; isole em migration própria) [verificar se `supabase db push` envolve cada arquivo em transação].
- Migration de dados que toca linhas reais de clientes só com pedido explícito e revisão humana (lição: uma migration de reprecificação mexeu em dado real).

## Seeds e dados de teste

- `supabase/seed.sql` só para banco local/dev: dados fictícios neutros ("Acme Org", "Workspace A/B"), nenhum dado real.
- Nunca semear prod com dados fictícios. Testes criam o próprio tenant (organização + usuários) e apagam ao final; ver [07](07-testes.md).

## Índices e EXPLAIN

- Índice em toda FK e em todo `organization_id`, preferencialmente composto na ordem de filtro (`organization_id, workspace_id, created_at desc`).
- Índice parcial para filas e estados quentes (`where status in ('pending','retry')`).
- Medir como a API mede: `begin; set local role app_api; select set_config('app.org_id', '<uuid>', true), set_config('request.jwt.claim.sub', '<uuid>', true); explain (analyze, buffers) <query>; rollback;`. Procure `Seq Scan` em tabela grande e `SubPlan` executado por linha (sinal de helper sem `select`).
- `pg_stat_statements` para achar as consultas caras; advisors de performance/segurança do painel do Supabase [verificar nome atual].

## Constraints como última defesa

- CHECK para invariantes de valor (`amount_cents >= 0`, `due_date >= issue_date`, soma de partes = total). Lição: `check (vendido + reservado <= total)` segurou estoque mesmo se o código errasse.
- UNIQUE para regras de unicidade de negócio e idempotência (`unique (organization_id, external_id)`).
- FK composta com `organization_id` para impedir referência entre tenants.
- `not null` por padrão; nullable só com motivo.

## Concorrência

| Problema | Ferramenta |
|---|---|
| Decrementar saldo/estoque/vaga sem passar do limite | `select ... for update` na linha-mãe + CHECK; transação curta |
| Fila/outbox com várias réplicas | `for update skip locked` + `limit` |
| Evento/requisição repetida | UNIQUE + `insert ... on conflict do nothing returning id` |
| Job singleton | `pg_try_advisory_xact_lock(hashtext('<job>'))` |
| Edição concorrente de formulário | coluna `version int`, `update ... where id = $1 and version = $2` (0 linhas = conflito 409) |

```sql
with claimed as (
  select id from app.outbox
  where status in ('pending', 'retry') and next_attempt_at <= now()
  order by created_at
  limit 50
  for update skip locked
)
update app.outbox o set status = 'processing', attempts = attempts + 1, updated_at = now()
from claimed where o.id = claimed.id
returning o.*;
```

- Nunca chame API externa com lock aberto: a linha travada vira gargalo de toda a organização (lição: o lock por linha foi o limite de vazão medido; a chamada ao provedor de pagamento ficou fora da transação).
- Idempotência de requisição (POST que cria cobrança): tabela `idempotency_keys (organization_id, endpoint, key, request_hash, response_status, response_body, expires_at)` com UNIQUE; mesma chave com corpo diferente → 422.

## Backups e PITR

- Free: sem backup automático. Pro: backup diário com 7 dias de retenção; Team: 14 dias. PITR é add-on (cerca de US$ 100/mês por 7 dias de retenção, RPO de ~2 min, exige compute Small ou maior); com PITR ligado, o backup diário deixa de ser feito.
- Recomendação para prod: Pro + PITR antes do primeiro cliente pagante. DECIDIR com custo em [09](09-deploy-easypanel-supabase.md).
- Backups do banco (diário e PITR) **não** incluem os objetos do Storage, e restaurar backup não recupera objeto apagado (confirmado na doc de backups do Supabase). Cópia dos objetos: `DECIDIR` em [12](12-storage-e-governanca.md) §"Governança".
- Teste de restore trimestral em projeto descartável; backup que nunca foi restaurado não conta.
- Self-hosted: backup, WAL e restore são responsabilidade sua (`pg_dump` diário off-site no mínimo).

## LGPD no schema

- Inventário: cada coluna com dado pessoal é marcada na spec e em `COMMENT ON COLUMN ... IS 'pii:<tipo>'` para virar consulta de inventário.
- CPF/telefone: guardar cifrado (`bytea`) + hash para busca. Use **HMAC com chave secreta**, não `sha256` puro: o espaço de CPFs é pequeno e um hash sem chave é revertido por força bruta (erro comum: `digest(..., 'sha256')` sem chave). Cifragem e chaves: [03](03-seguranca.md) §"Criptografia".
- Exibir mascarado por padrão (`***.***.***-00`); revelar o dado completo é ação auditada.
- Retenção: cada tabela com PII define prazo na spec; job de retenção anonimiza (sobrescreve PII com `null`/`'anonimizado'`, mantém ids e valores financeiros exigidos por lei) em vez de apagar registros contábeis. DECIDIR prazos com o jurídico.
- Exclusão de conta: `auth.users` em cascata remove memberships; dados que o tenant precisa manter (ex.: histórico financeiro) ficam desvinculados da pessoa.

## Checklist

- [ ] Tabela nova em `app`, com `organization_id` (+ `workspace_id` e FK composta quando couber), índices e trigger `updated_at`.
- [ ] `enable row level security` + policy para cada operação permitida, `to app_api`, helpers dentro de `(select ...)`.
- [ ] UPDATE com `using` e `with check`.
- [ ] Grants explícitos só para os papéis que precisam.
- [ ] CHECK/UNIQUE para as invariantes da spec.
- [ ] Migration com timestamp, `lock_timeout`, sem editar migrations antigas, sem senha, sem dado real.
- [ ] Mudança incompatível dividida em expand/contract.
- [ ] Colunas com PII marcadas, com cifragem/HMAC e prazo de retenção definidos.
