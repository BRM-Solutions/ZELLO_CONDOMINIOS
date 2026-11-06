# Spec — Cadastro de moradores sem convite e aprovação de acesso

> PRD: [estrutura-condominio-acesso](../prd/estrutura-condominio-acesso.md) (histórias 3 e 4) — Status: rascunho (aguarda aprovação) — Data: 2026-11-05
> Onda 2.2 ([roteiro](README.md)). Regras: [11-dominio](../11-dominio.md) §3 (papéis), §4 R2/R3/R6, §5 (Resend), §6 (LGPD). Base: [spec-estrutura-condominio](spec-estrutura-condominio.md) (`people`, `unit_members`, `access_status`, `app.my_unit_ids()`).
> Docs a ler para implementar: [02](../02-banco-de-dados.md) §"RLS", §"Funções helper", §"Concorrência", §"LGPD no schema"; [03](../03-seguranca.md) §"Autenticação", §"Autorização", §"Headers, CORS e rate limiting", §"Logs", §"LGPD"; [01](../01-arquitetura.md) §"Integrações, outbox e webhooks"; [05](../05-backend-api.md); [07](../07-testes.md); `docs/templates/migration-template.sql`.

## Objetivo

Permitir que o morador peça acesso ao portal do seu condomínio sem convite (R6, decisão da dona, não reabrir): cria a conta no Supabase Auth pela página pública `/c/<slug>/cadastro`, confirma o e-mail e envia a solicitação; fica **pendente** até `owner`, `admin` ou `manager` do condomínio aprovar. E-mail verificado igual ao de um pré-cadastro (`people.access_status = 'none'`) → a solicitação aponta para ele; sem pré-cadastro → solicitação com unidade declarada (bloco + número) e tipo de vínculo. A aprovação cria, numa transação, membership `member` + pessoa/vínculo ativos, satisfazendo R2. Avisos de aprovada/recusada saem pela outbox via Resend. Só banco, API e shared; telas na Onda 2.3.

## Estado atual

- `apps/api/src/app.ts:74-83` — rate limit global único (300/min por IP, store em memória); nenhum limite por rota.
- `apps/api/src/app.ts:88` — único grupo "autenticado sem organização": `/api/v1/me` com `authenticate` e **sem** `loadMembership`.
- `apps/api/src/app.ts:89-96` — grupo `/api/v1` com `authenticate` + `loadMembership`; qualquer rota montada aqui exige `X-Organization-Id` e membership ativa.
- `apps/api/src/app.ts:30-40` — `REDACT_PATHS` (cobre `email`, `phone`, `whatsapp`; não cobre nome nem nota).
- `apps/api/src/auth/authenticate.ts:35` — `req.auth.email` vem do claim `email` do JWT. O JWT do Supabase **não** tem claim de e-mail verificado (só `email`, `is_anonymous`, `user_metadata` editável pelo próprio usuário — [doc de claims](https://supabase.com/docs/guides/auth/jwt-fields)). Portanto `req.auth.email` não serve para casar pré-cadastro.
- `apps/api/src/auth/membership.ts:31-32` — sem membership na organização → 404; o candidato a morador não tem membership nenhuma.
- `apps/api/src/auth/require-workspace.ts:7-37` — checagem por condomínio (`:workspaceId`), base para as rotas de aprovação.
- `apps/api/src/db.ts:56-72` — `withTenantTx` injeta `app.org_id = ''` quando não há `req.membership` (`:66`); `:74-81` `withWorkerTx`.
- `apps/api/src/http.ts:22` — `notFound()`; `:53-55` `notFoundHandler` inclui o caminho na mensagem (não usar para slug inexistente).
- `apps/api/src/audit.ts:14` — `recordAudit`.
- `apps/api/src/jobs/outbox.ts:22` backoff (30 s … 6 h, soma ~7,2 h); `:46-69` claim; `:82-109` `processItem` (`UnknownOutcomeError` → `unknown`). `apps/api/src/worker.ts:8` — `handlers` vazio.
- `apps/api/src/config.ts:72-81` — env do worker sem nada de e-mail; `:43-70` env da API.
- `apps/api/src/modules/condominium/service.ts:309-317` — `assertLinkableUnits` (unidade existe no condomínio e está ativa); `:359-392` `createPerson` (padrão de escrita + audit); `:102-119` helper `audit`; `:90-100` `mapDbErrors`.
- `apps/api/src/modules/condominium/routes.ts:210-215` — `GET /me/units` (montado no grupo com membership).
- `supabase/migrations/20261030120000_base_multitenant.sql:290-319` — `memberships`: insert/update só `owner`/`admin` (manager não cria membership); select só a própria ou owner/admin. `:331-336` `audit_log_insert` e `:345-348` `outbox_insert` exigem `app.has_org_role()` (candidato sem membership não grava). `:262-265` `workspaces_select` exige membership. `:118` `unique (event_type, aggregate_id)` na outbox.
- `supabase/migrations/20261105202822_condominium_structure.sql:81-107` — `app.people` (`user_id` `:91`, `access_status` `:93-94`, `unique (workspace_id, email)` `:101`, `unique (workspace_id, user_id)` `:106-107`); `:116-139` `unit_members` (`unit_members_active_uidx` `:138`); `:158-180` `app.my_unit_ids()` (exige `access_status = 'active'` + membership + vínculo vigente); `:229-252` policies de `people`.
- `supabase/migrations/20261030130000_files_storage.sql:110` — padrão de worker: `select ... to app_worker using (true)`, escrita com `organization_id = app.current_org_id()`.
- `packages/shared/src/permissions.ts:3-18` — matriz; nada de aprovação.
- `packages/shared/src/condominium.ts:4-14` — `RELATIONS`, `ACCESS_STATUSES`; `:199-203` `linkUnitSchema`; `:215-224` `updatePersonSchema` permite trocar o e-mail de um pré-cadastro (relevante para corrida com a aprovação).
- `packages/shared/src/tenancy.ts:46-53` — `meResponseSchema`.
- `apps/web/src/contexts/AuthContext.tsx:49-57` — `/me` define memberships; usuário sem membership fica sem organização (sem tela própria). `:70-76` magic link com `emailRedirectTo: window.location.origin` (cria usuário se não existir). `apps/web/src/pages/LoginPage.tsx:16` — senha mínima 6 (doc 03 pede ≥ 10).
- `supabase/config.toml:21-30` — local: `enable_signup = true`, `enable_confirmations = true`; dev/prod configurados no painel.
- `apps/api/src/test/migrations.pglite.test.ts:19` — stub `auth.users (id)` só com `id`; `apps/api/src/test/condominium.int.test.ts:36` — int test já insere em `auth.users` com `email`.
- [spec-personalizador](spec-personalizador.md) linhas 28 e 42 — padrão já decidido para leitura pública: função `security definer` restrita + `GET /api/v1/public/branding/:slug`, 404 idêntico para inexistente/inativo.

## Desenho do fluxo

```
Morador (web)                       Supabase Auth (SMTP Resend)          API                                   Gestão
1 GET /public/condominiums/:slug ─────────────────────────────────────► nome + blocos/unidades (sem PII)
2 supabase.auth.signUp(email, senha, emailRedirectTo) ──► e-mail de confirmação
3 clica no link ──► e-mail confirmado, sessão criada
4 GET  /registration/:slug  (JWT) ────────────────────────────────────► estado: pré-cadastro? pedido?
5 POST /registration/:slug  (JWT) ────────────────────────────────────► app.submit_unit_request(): lê e-mail
                                                                         VERIFICADO em auth.users, casa pré-cadastro,
                                                                         grava unit_requests (pending) + audit
6                                                                        GET .../registrations ◄─────── owner/admin/manager
7                                                                        POST .../approve|reject ◄──── (transação, idempotente)
8                                                    worker ◄── outbox registration.approved|rejected ──► Resend
```

Regra central contra sequestro de conta: **nenhuma rota recebe e-mail no corpo** e o módulo nunca lê `req.auth.email`. O e-mail usado para casar pré-cadastro é lido pelo banco em `auth.users.email` com `email_confirmed_at is not null`, dentro de função `security definer` (padrão recomendado pelo Supabase para ler `auth.users` a partir de papel customizado — [KB](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema)).

## Modelo de dados

Migration nova `supabase/migrations/<timestamp>_resident_registration.sql` (`supabase migration new resident_registration`; timestamp posterior ao da 2.1), a partir do template, tipo **expand**, idempotente (`if not exists`/`drop ... if exists`, a suíte PGlite aplica duas vezes, como em `…condominium_structure.sql:9`).

**Tabela `app.unit_requests`** (solicitação de cadastro)

| Coluna | Tipo / regra | Nota |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `organization_id` | `uuid not null` → `organizations` `on delete cascade` | derivado do slug **no banco** |
| `workspace_id` | `uuid not null`; FK `(organization_id, workspace_id)` → `workspaces` cascade | |
| `user_id` | `uuid null` → `auth.users (id) on delete set null` | conta excluída: pedido fica sem dono, aprovação = 409 |
| `email` | `text null`, `char_length 3–254`, `= lower(email)` | `pii:email`; **cópia do e-mail verificado** no envio; nunca vem do corpo |
| `full_name` | `text null`, 2–160 | `pii:name`; declarado |
| `person_id` | `uuid null`; FK `(organization_id, workspace_id, person_id)` → `people` | pré-cadastro casado, ou pessoa criada na aprovação |
| `unit_id` | `uuid null`; FK `(organization_id, workspace_id, unit_id)` → `units` | unidade declarada (nula quando casou com pré-cadastro) |
| `relation` | `text null`, `in ('owner','tenant','resident','other')` | declarado |
| `status` | `text not null default 'pending'`, `in ('pending','approved','rejected')` | |
| `decided_by` | `uuid null` | |
| `decided_at` | `timestamptz null` | |
| `decision_note` | `text null`, ≤ 500 | uso interno da gestão (decisão 4); `pii:free_text` |
| `anonymized_at` | `timestamptz null` | retenção (decisão 1) |
| `created_at`, `updated_at` | `timestamptz default now()` + trigger `app.set_updated_at` | |

CHECKs: `(status = 'pending') = (decided_at is null)`; `person_id is not null or (unit_id is not null and relation is not null)`; `anonymized_at is null or (email is null and full_name is null and decision_note is null)`; `unique (organization_id, workspace_id, id)`.

Índices: `unit_requests_org_ws_status_idx (organization_id, workspace_id, status, created_at desc)`; `unit_requests_user_idx (user_id)`; **`unit_requests_one_pending_uidx unique (workspace_id, user_id) where status = 'pending'`** (um pendente por usuário+condomínio); **`unit_requests_person_pending_uidx unique (person_id) where status = 'pending' and person_id is not null`** (um pré-cadastro não é disputado por dois pedidos); `unit_requests_retention_idx (decided_at) where anonymized_at is null and status <> 'pending'`.

Default seguro: tabela nova, nada existente muda.

**RLS de `unit_requests`** (deny-by-default; `grant select, update` a `app_api`; **sem `insert` nem `delete` para `app_api`**: só a função de envio insere)

| Policy | Para | Regra |
|---|---|---|
| `unit_requests_select` | `app_api` | `organization_id = (select app.current_org_id()) and workspace_id in (select app.workspace_ids(array['owner','admin','manager']))` |
| `unit_requests_update` | `app_api` | mesma regra em `using` e `with check` |
| `unit_requests_select_worker` | `app_worker` | `using (true)` (padrão de `files_storage.sql:110`) |
| `unit_requests_update_worker` | `app_worker` | `organization_id = (select app.current_org_id())` em `using`/`with check`; `grant update (email, full_name, decision_note, anonymized_at)` só nessas colunas |

`council`, `staff` e `member` não veem solicitações.

**Políticas novas em `app.memberships`** (exceção estreita ao "só owner/admin gerenciam" de `base_multitenant.sql:288-319`, necessária porque o síndico aprova — [11](../11-dominio.md) §3 "aprovação de acesso: C" para manager):

- `memberships_select_member_by_manager` (select): `organization_id = current_org_id() and role = 'member' and workspace_id in (select app.workspace_ids(array['owner','admin','manager']))`.
- `memberships_insert_member_on_approval` (insert): `organization_id = current_org_id() and role = 'member' and status = 'active' and user_id <> current_user_id() and workspace_id in (select app.workspace_ids(array['owner','admin','manager'])) and exists (select 1 from app.unit_requests r where r.organization_id = memberships.organization_id and r.workspace_id = memberships.workspace_id and r.user_id = memberships.user_id and r.status in ('pending','approved'))`.
- `memberships_update_member_on_approval` (update, reativar `revoked`/`invited`): mesma expressão em `using` e `with check` (o `with check` fixa `role = 'member'`: manager nunca promove).

Efeito: manager só cria/reativa `member` no seu condomínio e só para quem tem solicitação; não cria `admin`/`manager`, não age em outro condomínio, não se autoaprova.

**Funções** (todas `set search_path = ''`, nomes qualificados, `revoke execute ... from public, anon, authenticated`, `grant execute ... to app_api` salvo indicação):

1. `app.verified_email_of_current_user() returns text` — `security definer`, `stable`, SQL: `select lower(u.email) from auth.users u where u.id = app.current_user_id() and u.email_confirmed_at is not null and coalesce(u.is_anonymous, false) = false`. **Sem grant a `app_api`** (só usada pelas funções 2 e 3). Colunas `email_confirmed_at`/`is_anonymous` do `auth.users` hospedado `[verificar no dev antes do merge]`.
2. `app.registration_status(p_slug text)` — `security definer`, `stable`. Retorna, para o usuário atual: `workspace_name`, `email_verified boolean`, `pre_registered boolean` (só calculado se `email_verified`; pessoa com `email` igual, `user_id` nulo ou o próprio, `access_status in ('none','pending_approval')`), `access_status` da pessoa já ligada ao usuário (`active`/`suspended`/null), e o último pedido do usuário no condomínio (`id`, `status`, `block_name`, `unit_number`, `relation`, `created_at`, `decided_at`). Workspace só se `slug = p_slug`, `workspaces.status = 'active'` e `organizations.status = 'active'`; senão zero linhas.
3. `app.submit_unit_request(p_slug text, p_full_name text, p_unit_id uuid, p_relation text, p_request_id text) returns table (outcome text, request_id uuid, matched boolean)` — `security definer`, `volatile`, plpgsql. Passos:
   - `v_user := app.current_user_id()`; nulo → `outcome = 'auth_required'`.
   - `v_email := app.verified_email_of_current_user()`; nulo → `'email_not_verified'`.
   - Workspace ativo por slug (como em 2); não achou → `'not_found'`.
   - `perform pg_advisory_xact_lock(hashtextextended(v_ws::text || ':' || v_user::text, 0))`.
   - Pessoa já ligada ao usuário no condomínio (`people.user_id = v_user`): `access_status = 'active'` → `'already_member'`; `'suspended'` → `'suspended'`.
   - Pedido `pending` do usuário no condomínio → `'pending_exists'`.
   - Pré-cadastro: `select ... from app.people where workspace_id = v_ws and email = v_email for update`; casa se `user_id is null or user_id = v_user` e `access_status in ('none','pending_approval')`; `suspended` → `'suspended'`; ligado a outro usuário → não casa (vira pedido novo; a aprovação devolve 409 e a gestão resolve).
   - Sem casamento: `p_unit_id`/`p_relation` obrigatórios (`'unit_required'`), unidade `active` do mesmo workspace (`'invalid_unit'`).
   - `insert into app.unit_requests (...)` com `email = v_email`, `full_name = p_full_name`, `person_id` (se casou), `unit_id`/`relation` (só se não casou). Violação de `unit_requests_*_uidx` → `'pending_exists'`.
   - Casou: `update app.people set access_status = 'pending_approval' where id = ... and access_status = 'none'`.
   - `insert into app.audit_log` (`actor_kind 'user'`, `actor_user_id = v_user`, `action 'registration.submit'`, `entity_type 'unit_request'`, `request_id = p_request_id`, metadata `{workspaceId, matchedPreRegistration, unitId}` — sem nome nem e-mail).
   - `outcome = 'created'`. Só esse caminho escreve; os demais retornam sem efeito.
4. `app.public_unit_directory(p_slug text) returns table (workspace_name text, block_id uuid, block_name text, block_sort int, unit_id uuid, unit_number text)` — `security definer`, `stable`. Workspace e organização ativos; `left join` blocos e unidades `status = 'active'`; `order by block_sort, block_name, unit_number`; `limit 5000`. Nenhuma coluna de pessoa. Zero linhas = inexistente/inativo.

Por que funções e não policies: o candidato não tem membership (`app.workspace_ids()` vazio), então nenhuma policy existente permite ler o workspace pelo slug, casar `people` por e-mail, atualizar `people.access_status` ou gravar `audit_log` (`base_multitenant.sql:331-336`). Funções pequenas, com regra fixa e sem parâmetro de e-mail, expõem menos que abrir policies para usuário sem tenant.

**Expand/contract:** só adições (tabela, índices, 3 policies em `memberships`, 4 funções). Nada removido.

**Rollback (comentário no topo):** nova migration com `drop function` das 4 funções, `drop policy` das 3 de `memberships`, `drop table app.unit_requests` (só sem dado real).

## Shared (`packages/shared`)

- `packages/shared/src/registration.ts` (novo), export em `index.ts`:
  - `REQUEST_STATUSES = ["pending","approved","rejected"]`, `requestStatusSchema`.
  - `publicUnitDirectorySchema` (saída): `{ name, blocks: [{ id, name, units: [{ id, number }] }] }`.
  - `submitRegistrationSchema` (entrada, `.strict()`): `fullName` (trim, 2–160), `unitId` (uuid, opcional), `relation` (`relationSchema`, opcional); `refine`: ambos ou nenhum. **Sem campo `email`** (campo extra = 400).
  - `registrationStatusSchema` (saída do morador): `{ condominium: { name, slug }, emailVerified, preRegistered, accessStatus: accessStatusSchema.nullable(), request: { id, status, blockName, unitNumber, relation, createdAt, decidedAt } | null }`.
  - `registrationRequestSchema` (saída da gestão): `id, status, fullName, email, preRegistered, person: { id, fullName, units: personUnitSchema[] } | null, declaredUnit: { unitId, blockName, unitNumber } | null, relation, createdAt, decidedAt, decidedBy`. Sem telefone.
  - `registrationsFilterSchema` = `paginationQuerySchema.extend({ status: requestStatusSchema.default("pending") })`.
  - `approveRegistrationSchema` (`.strict()`): `units?: { unitId, relation }[]` (1–20, sem repetição) — decisão 3: o gestor pode corrigir a unidade.
  - `rejectRegistrationSchema` (`.strict()`): `note?: string` (trim, 1–500).
- `packages/shared/src/permissions.ts:3-18`: `"registrations:read": ["owner","admin","manager"]`, `"registrations:decide": ["owner","admin","manager"]`. `council` fora (decisão da dona).
- Testes em `packages/shared/src/registration.test.ts`.

## Backend (`apps/api`)

| Método | Rota | Auth / papel | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| GET | `/api/v1/public/condominiums/:slug/units` | público, `publicLimiter` | slug | `publicUnitDirectorySchema` | 404 `NOT_FOUND` idêntico (inexistente, inativo, organização suspensa, slug malformado); 429 |
| GET | `/api/v1/registration/:slug` | JWT, **sem membership**, `registrationReadLimiter` | — | `registrationStatusSchema` | 401; 404 idêntico ao público; 429 |
| POST | `/api/v1/registration/:slug` | JWT, sem membership, `registrationWriteLimiter` | `submitRegistrationSchema` | 201 `registrationStatusSchema` | 400 validação / `UNIT_REQUIRED` / `INVALID_UNIT`; 401; 403 `EMAIL_NOT_VERIFIED`; 404; 409 `REQUEST_PENDING`, `ALREADY_MEMBER`, `ACCESS_SUSPENDED`; 429 |
| GET | `/api/v1/workspaces/:workspaceId/registrations` | `registrations:read` no condomínio | `registrationsFilterSchema` | lista paginada `registrationRequestSchema` | 403; 404 |
| GET | `…/registrations/:requestId` | `registrations:read` | — | `registrationRequestSchema` | 403; 404 |
| POST | `…/registrations/:requestId/approve` | `registrations:decide` | `approveRegistrationSchema` | `registrationRequestSchema` | 403 (inclui `SELF_DECISION`); 404; 409 `REQUEST_DECIDED`, `REQUEST_STALE`, `PRE_REGISTRATION_CONFLICT`, `PERSON_INACTIVE`, `ACCESS_SUSPENDED`, `MEMBERSHIP_CONFLICT`, `PERSON_EMAIL_TAKEN`; 422 `UNIT_REQUIRED`, `UNIT_INACTIVE` |
| POST | `…/registrations/:requestId/reject` | `registrations:decide` | `rejectRegistrationSchema` | `registrationRequestSchema` | 403; 404; 409 `REQUEST_DECIDED` |

**`apps/api/src/app.ts`** (dono do arquivo nesta onda: o builder desta spec)
- Montar **antes** do grupo de `:89-96`, depois de `express.json` (`:86`):
  - `app.use("/api/v1/public", publicRouter(...))` — sem `authenticate`. Se a 2.1 já criou `modules/public/routes.ts` (branding), estender o mesmo router.
  - `app.use("/api/v1/registration", authenticate(verifier), registrationRouter())` — grupo **autenticado sem membership**, como `/api/v1/me` em `:88`. O router termina com `notFoundHandler` próprio para que caminhos não casados não caiam no grupo com `loadMembership`.
- Rotas de gestão no grupo existente (`:89-96`), `registrationAdminRouter()` ao lado de `condominiumRouter`.
- `REDACT_PATHS` (`:30-40`): acrescentar `fullName`, `*.fullName`, `note`, `*.note`.

**Rate limit** — `apps/api/src/http/rate-limits.ts` (novo) com `express-rate-limit` v8 (`apps/api/package.json:19`), mesmo `handler` 429 de `app.ts:80-81`:
- `publicLimiter`: 30/min por IP.
- `registrationReadLimiter`: 60/min por `req.auth.userId`.
- `registrationWriteLimiter`: 5/h por `req.auth.userId` **e** 20/h por IP (dois limitadores). Chave por IP com o helper de IPv6 da v8 `[verificar: ipKeyGenerator]`.
- Store em memória vale só com 1 réplica: segue o `DECIDIR` já aberto em [03](../03-seguranca.md) §"Headers, CORS e rate limiting" (não é decisão nova). `trust proxy` de `app.ts:49` `[verificar saltos]`.

**Módulo `apps/api/src/modules/registration/`** (`routes.ts`, `admin-routes.ts`, `service.ts`, `repository.ts`)
- Público: `getPublicDirectory(db, slug)` chama `app.public_unit_directory` em `runInTx` com `request.jwt.claim.sub = ''` e `app.org_id = ''` (read-only). Agrupa em blocos. Zero linhas → `notFound("Condomínio não encontrado.")` — a mesma instância de mensagem para todos os casos; slug que falha em `slugSchema` também cai no mesmo 404. `Cache-Control: public, max-age=60` só no 200.
- `getRegistrationStatus(req, slug)`: `withTenantTx` read-only (org vazio) → `app.registration_status`.
- `submitRegistration(req, slug, input)`: `withTenantTx` → `app.submit_unit_request(slug, fullName, unitId ?? null, relation ?? null, req.id)`; mapeia `outcome` → `DomainError` (tabela acima); `created` → 201 com o status atualizado. **Proibido** ler `req.auth.email` neste módulo (teste garante).
- `listRegistrations` / `getRegistration`: `withTenantTx` read-only, `where organization_id = $1 and workspace_id = $2` + RLS; ordem `created_at desc, id desc`; `anonymized_at is null` mostra nome/e-mail, senão `null`.
- **`approveRegistration(req, workspaceId, requestId, input)`** — uma `withTenantTx`, nenhuma chamada externa dentro:
  1. `select ... from app.unit_requests where id = $1 and organization_id = $2 and workspace_id = $3 for update` → ausente = 404.
  2. `approved` → devolve o estado atual, **sem** nova escrita/audit/outbox (idempotente, 200). `rejected` → 409 `REQUEST_DECIDED`.
  3. `user_id is null` → 409 `REQUEST_STALE`. `user_id = ctx.userId` → 403 `SELF_DECISION`.
  4. Pessoa, sempre `for update`, nesta ordem (pedido → pessoa evita deadlock):
     a. `person_id` preenchido: `user_id` de outro usuário → 409 `PRE_REGISTRATION_CONFLICT`; `email <> unit_requests.email` (gestão trocou o e-mail depois do pedido, `condominium.ts:215-224`) → 409 `PRE_REGISTRATION_CONFLICT`.
     b. Sem `person_id`: procurar pessoa por `(workspace_id, user_id)`; senão por `(workspace_id, email = unit_requests.email)` (pré-cadastro criado depois do pedido), mesmas regras de (a); senão `insertPerson` (`full_name`, `email` do pedido, `created_by = aprovador`).
     c. `status = 'inactive'` → 409 `PERSON_INACTIVE`; `access_status = 'suspended'` → 409 `ACCESS_SUSPENDED`.
     d. `update app.people set user_id = $user, access_status = 'active', status = case when status = 'pending' then 'active' else status end`.
  5. Vínculos: `input.units` (decisão 3) ou a unidade declarada; `assertLinkableUnits` (`condominium/service.ts:309-317`, exportar para reuso) e `insertUnitMember` com `on conflict do nothing` no `unit_members_active_uidx`. Depois, sem vínculo vigente (`ends_on is null or ends_on > current_date`) → 422 `UNIT_REQUIRED` (rollback). Garante R2.
  6. Membership `(user_id, organization_id, workspace_id)`: ativa (qualquer papel) → mantém; `member` revogada/convidada → `update status = 'active'`; outro papel não ativo → 409 `MEMBERSHIP_CONFLICT`; inexistente → `insert role 'member', status 'active'`.
  7. `update app.unit_requests set status = 'approved', person_id, decided_by, decided_at = now() where id = $1 and status = 'pending'` (0 linhas = corrida perdida → reler e voltar ao passo 2).
  8. `audit`: `registration.approve` (`entity_type 'unit_request'`, metadata `{ workspaceId, personId, matchedPreRegistration, unitIds, relations, membership: 'created'|'reactivated'|'kept' }`); `membership.create` quando criada.
  9. `insert into app.outbox (organization_id, event_type 'registration.approved', aggregate_id = request id, payload '{}') on conflict do nothing`. Payload sem e-mail; o worker lê o destinatário.
  - Erros de unicidade via `mapDbErrors` (`people_workspace_email_key` → `PERSON_EMAIL_TAKEN`; `people_workspace_user_uidx` → `PRE_REGISTRATION_CONFLICT`).
- **`rejectRegistration`**: `for update`; `rejected` → 200 idempotente; `approved` → 409; `SELF_DECISION` → 403; `update status 'rejected', decided_by, decided_at, decision_note`; pessoa casada com `access_status = 'pending_approval'` volta a `'none'`; audit `registration.reject` com `{ workspaceId, hasNote }` (nunca o texto); outbox `registration.rejected`.
- Concorrência: duas aprovações simultâneas serializam no `for update` do pedido; a segunda vê `approved` e devolve 200 sem duplicar membership/vínculo/audit/outbox. Aprovar × recusar: o segundo recebe 409. Dois pedidos que disputam a mesma pessoa: barrados pelo `unit_requests_person_pending_uidx` e pelo `for update` na pessoa.

**E-mail (worker)** — `apps/api/src/integrations/email/` com `adapter.ts` (interface `EmailSender.send({ to, subject, text, html, idempotencyKey })`), `resend.ts` (`fetch` em `https://api.resend.com/emails`, `Authorization: Bearer`, header `Idempotency-Key`, timeout 10 s, resposta validada por Zod) e `fake.ts` (testes).
- `apps/api/src/jobs/registration-emails.ts`: handlers `registration.approved` e `registration.rejected` registrados em `worker.ts:8`. Cada um: `withWorkerTx(db, item.organizationId)` lê `unit_requests.email`, `status`, `anonymized_at` + `workspaces.name`, `slug`; pedido anonimizado ou status diferente do evento → retorna sem enviar (item vira `sent`). Envio **fora** da transação; `idempotencyKey = "<eventType>/<aggregateId>"` (Resend deduplica por 24 h — [changelog](https://resend.com/changelog/idempotency-keys)); o backoff total de `outbox.ts:22` (~7,2 h) cabe na janela, então timeout é `retry`, não `unknown`. 4xx de validação → erro permanente (`failed`); 409 `concurrent_idempotent_requests`, 429 e 5xx → `retry`.
- Conteúdo pt-BR, texto + HTML simples, sem dado além do nome do condomínio: aprovado = "Seu acesso ao portal <condomínio> foi aprovado" + link fixo `APP_PUBLIC_URL/c/<slug>/entrar` (sem token); recusado = "Seu cadastro no portal <condomínio> não foi aprovado. Procure a administração." (decisão 4).
- Log: só `outboxId`, `eventType`, status HTTP do provedor; nunca destinatário, assunto ou corpo.
- `config.ts:72-81` (worker): `RESEND_API_KEY` (obrigatória em `production`; em `test` usa o fake por config), `EMAIL_FROM` (decisão 5), `APP_PUBLIC_URL` (url https). A API **não** recebe chave do Resend. Nomes em `.env.example` e no doc 09 (passo curto na sessão principal, fora da área do builder).

**Retenção** — `apps/api/src/jobs/registration-retention.ts`, loop do worker com `pg_try_advisory_xact_lock(hashtext('registration-retention'))`: anonimiza pedidos decididos há mais de N dias (`email`, `full_name`, `decision_note` = null, `anonymized_at = now()`), audit `actor_kind 'worker'`. **Só implementar após o jurídico confirmar o prazo da decisão 1** (90 dias após a decisão; 60 dias para pendentes); até lá a coluna e o índice existem e o job fica fora.

## Frontend (`apps/web`)

Nenhuma tela nesta spec (Onda 2.3). Contrato e recomendações para a `spec-telas-acesso.md`:
- Cadastro em duas etapas: (1) e-mail + senha → `supabase.auth.signUp` com `emailRedirectTo` para a página de continuação do slug; mensagem **sempre igual** ("Se o e-mail puder ser usado, enviamos um link de confirmação"), sem usar `identities` vazio para dizer "já cadastrado" (o Supabase ofusca e-mail existente para evitar enumeração `[verificar comportamento com conta não confirmada]`); (2) após confirmar, `GET /registration/:slug` decide se pede unidade (`preRegistered = false`) e `POST` envia.
- Senha mínima 10 (corrigir `LoginPage.tsx:16`, hoje 6; regra em [03](../03-seguranca.md) §"Autenticação").
- Usuário sem membership em `AuthContext.tsx:55-57` precisa de destino próprio (estado do pedido), não erro.
- Mobile 320–414px: na 2.3.

## Configuração do Supabase Auth (dev e prod, painel; local em `supabase/config.toml`)

Feita pela dona/operador no painel; o builder só ajusta `supabase/config.toml` para paridade local. Itens e nomes de chave do `config.toml` `[verificar na doc do CLI]`:
- Confirm email **ligado** (`config.toml:30` já local). Secure email change **ligado** (troca de e-mail confirma o endereço antigo e o novo — [doc](https://supabase.com/docs/reference/kotlin/v1/auth-updateuser)); `auth.users.email` só muda após confirmação `[verificar]`.
- Anonymous sign-ins **desligado**. Nenhum provedor OAuth no MVP (se entrar, rever: o provedor passa a definir `email_confirmed_at`).
- Senha mínima 10; proteção de senha vazada se o plano permitir `[verificar]`.
- Redirect URLs: apenas os domínios do web; para o slug variável, `https://<web>/c/**` ou rota fixa de retorno com o slug em query `[verificar se a allow-list considera query string]`. A doc recomenda caminho exato em produção ([Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)).
- **SMTP personalizado = Resend**: host `smtp.resend.com`, porta 465, usuário `resend`, senha = chave do Resend **própria do Supabase de cada ambiente** (não a do worker), restrita a envio e ao domínio `[verificar na doc do Resend]`. Sem isso o Supabase limita a 2 e-mails/h.
- Saem pelo **Supabase Auth**: confirmação de cadastro, magic link, recuperação de senha, troca de e-mail. Templates pt-BR com `{{ .RedirectTo }}`/`token_hash` ([templates](https://supabase.com/docs/guides/auth/auth-email-templates)); sem dado além do destinatário. Limites de envio do Auth `[verificar valores no painel]`.
- Saem pela **outbox/worker**: `registration.approved`, `registration.rejected` (`registration.submitted` **não** existe: decisão 2, sem e-mail de pedido novo).
- Links com token só existem nos e-mails do Auth; a API e o worker nunca recebem nem logam esses links.

## Segurança e tenant

| Ameaça | Controle | Teste negativo |
|---|---|---|
| Cadastro com e-mail de outra pessoa para herdar o pré-cadastro (account takeover) | Confirmação de e-mail obrigatória; e-mail lido de `auth.users` com `email_confirmed_at` dentro da função; nenhuma rota aceita `email`; módulo não lê `req.auth.email`; aprovação humana compara nome declarado × pré-cadastro | token válido com claim `email` = vítima e `auth.users.email` = atacante → não casa; usuário com `email_confirmed_at` nulo → 403 sem escrita; `is_anonymous` → 403; corpo com `email` → 400 |
| Troca de e-mail para o da vítima | Secure email change; função lê `auth.users.email` (atual confirmado), não `email_change` | int: `email_change` preenchido com o e-mail da vítima não casa |
| Enumeração de condomínios/e-mails/moradores | 404 idêntico; nenhuma entrada de e-mail; `preRegistered` só para o dono verificado do e-mail; público sem PII | corpo e status iguais para slug inexistente/inativo/org suspensa/malformado; resposta pública só com chaves do schema |
| Abuso (spam de pedidos, scraping) | `publicLimiter`, limites por usuário e IP; um pendente por usuário+condomínio | 6º POST na hora → 429; segundo pendente → 409 |
| Escalada pelo síndico | Policies novas só `role = 'member'`, só no seu condomínio, só com solicitação, `user_id <> current_user_id()` | int: manager inserindo `admin`/`manager`, `member` sem pedido, `member` em A2, promovendo `member` → erro de RLS |
| IDOR entre condomínios/tenants | `requireWorkspacePermission` + `where organization_id/workspace_id` + RLS | manager A1 em A2 → 404; usuário de B → 404; `requestId` de A2 no caminho de A1 → 404 |
| Autoaprovação | `SELF_DECISION` + policy `user_id <> current_user_id()` | 403 |
| Aprovação duplicada / corrida | `for update`, `on conflict do nothing`, outbox `unique (event_type, aggregate_id)` | int: duas aprovações paralelas → 1 membership, 1 audit `registration.approve`, 1 outbox |
| PII em log/e-mail | `REDACT_PATHS`; audit só ids/flags; e-mail sem token e sem nota; worker não loga destinatário | captura do logger sem e-mail/nome; payload da outbox `{}` |
| Chave do Resend | Só no worker (`config.ts` worker) e no SMTP do Supabase; nunca na API/front | `loadConfig` da API não conhece a variável; worker em produção sem chave → `ConfigError` |
| Função `security definer` mal exposta | `search_path = ''`, execute revogado de `public/anon/authenticated`, `verified_email_of_current_user` sem grant | PGlite: `proacl`/`has_function_privilege` por papel |

- Dados pessoais novos: `unit_requests.email`, `full_name`, `decision_note` (`comment on column ... is 'pii:...'`). Gestão (owner/admin/manager) vê nome e e-mail do solicitante; council/staff/member não.
- Base legal e retenção: pendência jurídica de [11](../11-dominio.md) §6 + decisão 1.
- Atualizar no mesmo PR: [11](../11-dominio.md) §6 (linha "solicitação de cadastro" → `unit_requests`, prazo quando decidido); [03](../03-seguranca.md) §"Autorização" (exceção: manager cria só `member` com solicitação).

## Fora de escopo

- Telas (cadastro, estado do pedido, fila de aprovação, badge de pendentes): Onda 2.3.
- Suspender/revogar acesso de morador já aprovado e editar papel: backoffice (2.4) ou spec própria.
- Cancelamento do pedido pelo próprio morador; listagem "meus pedidos" sem slug (`/me/registrations`).
- Convites (R6), importação por planilha (plano Fase 3), cadastro de síndico/equipe pelo fluxo público.
- MFA para aprovadores (DECIDIR existente em [03](../03-seguranca.md) §"Autenticação").
- Store de rate limit em Postgres/Redis (DECIDIR existente em 03).
- Job de retenção até o jurídico confirmar o prazo da decisão 1.

## Decisões tomadas (2026-11-05, aceitas as recomendações)

1. **Retenção de `unit_requests`:** anonimizar nome, e-mail e nota 90 dias após a decisão; pedidos pendentes há 60 dias são recusados automaticamente pelo worker, sem e-mail. O prazo final passa pelo jurídico `[verificar]`; o job de retenção só é implementado depois dessa confirmação.
2. **Aviso de pedido novo:** sem e-mail; só contador de pendentes no portal (tela na spec 2.3).
3. **Gestor corrige a unidade na aprovação:** sim; `approve` aceita `units` (padrão = unidade declarada; para pré-cadastro, os vínculos dele).
4. **Motivo da recusa:** nota interna opcional; o e-mail ao morador é genérico ("procure a administração").
5. **Remetente no Resend:** domínio da plataforma, com o nome do condomínio no nome de exibição; chaves separadas por ambiente e por uso (SMTP do Supabase × worker). SPF/DKIM `[verificar]`.
6. **Novo pedido depois de recusado:** livre, contido pelo rate limit.

## Verificação manual

Só no **dev** (confirmar o projeto Supabase e a `DATABASE_URL` antes), com tenant de teste criado para isso:
1. Pré-requisitos no painel do dev: confirmação de e-mail, secure email change, anonymous off, SMTP Resend (chave de dev), redirect do web dev. Worker dev com `RESEND_API_KEY` de dev.
2. Como admin de teste: criar org `test_reg_<data>`, condomínio `test-reg-<data>` (slug), 1 bloco, 3 unidades; pré-cadastrar uma pessoa com e-mail de teste controlado (alias `+reg1`) vinculada à unidade 101.
3. `GET /public/condominiums/test-reg-<data>/units` → nome e unidades, sem pessoa. Slug inexistente e condomínio inativado → respostas idênticas.
4. Pré-cadastrado: `signUp` com `+reg1`, confirmar pelo e-mail (chegou via Resend), `GET /registration/:slug` → `preRegistered: true`; `POST` só com `fullName` → 201 pendente; `POST` de novo → 409.
5. Sem pré-cadastro: `signUp` com `+reg2`; antes de confirmar, `signInWithPassword` deve falhar (sem sessão); após confirmar, `POST` só com `fullName` → 400 `UNIT_REQUIRED`; com unidade 102/inquilino → 201. (O caso "token de usuário não confirmado → 403" fica no teste de integração.)
6. Tentativa de takeover: conta `+reg3` tenta `PATCH` de e-mail para `+reg1` (sem confirmar) e envia pedido → não casa com o pré-cadastro de `+reg1`.
7. Council e staff do condomínio: `GET .../registrations` → 403. Manager: aprovar `+reg1` (2x → mesmo resultado, 1 linha de audit) e recusar `+reg2`; conferir e-mails de aprovado/recusado (sem nota, sem token) e `outbox` `sent`.
8. `+reg1` entra: `GET /me` mostra membership `member`; `GET /me/units` (com `X-Organization-Id`) mostra a 101.
9. Limpeza: apagar a org de teste (cascade em condomínio, pessoas, vínculos, pedidos, audit, outbox) e os usuários `+reg*` em Authentication → Users do dev; conferir zero linhas restantes.

## Testes automatizados

- `apps/api/src/test/registration.test.ts` (rápido, fake db + supertest, `buildTestApp` de `test/helpers.ts:120`):
  - público: 404 com corpo idêntico (inexistente, slug malformado); 200 só com chaves do schema; 429 após o limite.
  - `/registration`: sem token 401; `outcome` → status/código para cada valor; corpo com `email` → 400; `unitId` sem `relation` → 400; o service chama a função sem argumento de e-mail e **não** lê `req.auth.email` (spy); 429 no 6º POST; rota inexistente sob `/registration` → 404 sem passar por `loadMembership`.
  - gestão: council/staff/member → 403; manager de outro condomínio → 404; outra org → 404; aprovar já aprovado → 200 sem novo `insert` em audit/outbox; aprovar recusado → 409; recusar aprovado → 409; autoaprovação → 403; `note` > 500 → 400.
  - `REDACT_PATHS` contém os campos novos; log capturado sem e-mail/nome.
- `apps/api/src/test/registration.int.test.ts` (dev, `pnpm test:full`, tenants A/B criados e apagados; usuários em `auth.users` com e sem `email_confirmed_at`, como `condominium.int.test.ts:36`):
  - takeover: claim `email` do JWT ≠ `auth.users.email` → casa só com o e-mail do banco; `email_confirmed_at` nulo → `email_not_verified` e zero linhas; `is_anonymous` → idem; `email_change` não é considerado.
  - casamento com pré-cadastro: `people.access_status` vai a `pending_approval`; pré-cadastro com `user_id` de outro → pedido novo sem `person_id`.
  - unicidade: dois POST paralelos do mesmo usuário → 1 pendente; dois usuários disputando a mesma pessoa → 1 pendente.
  - aprovação: pré-cadastro e pedido novo → membership `member` ativa, `people.user_id`/`access_status = 'active'`, vínculo vigente, `app.my_unit_ids()` retorna a unidade; aprovações paralelas → 1 membership, 1 audit, 1 outbox; e-mail do pré-cadastro alterado após o pedido → 409; sem unidade → 422 e rollback completo.
  - RLS: manager de A1 → insert `admin`/`manager` em memberships, `member` sem pedido, `member` em A2, update `member`→`manager` = erro; usuário sem membership: `select` em `unit_requests` = 0 e `insert` direto negado; usuário de B com org A → 0 linhas; `app_worker` com org B não atualiza pedido de A.
  - funções: `public_unit_directory` não retorna nada de `people`; workspace inativo → 0 linhas.
- `apps/api/src/test/migrations.pglite.test.ts`: estender o stub de `auth.users` (`:19`) com `email text`, `email_confirmed_at timestamptz`, `is_anonymous boolean`, `email_change text`; tabela nova com RLS e policies; execute das 4 funções revogado de `public/anon/authenticated` e `verified_email_of_current_user` sem execute para `app_api`; unicidades parciais; CHECKs de status/anonimização.
- `apps/api/src/test/registration-emails.test.ts`: handler com `fake.ts` — usa `Idempotency-Key` `registration.approved/<id>`; pedido anonimizado → não envia; 4xx → erro permanente; 5xx/timeout → retry; corpo sem token e sem nota; logger sem destinatário.
- `apps/api/src/test/config.test.ts`: worker em `production` sem `RESEND_API_KEY`/`EMAIL_FROM`/`APP_PUBLIC_URL` → `ConfigError`; mensagem não ecoa valor.
- `packages/shared/src/registration.test.ts`: `.strict()` (rejeita `email`), limites, `unitId` e `relation` juntos.
- `supabase/tests/catalog.sql` verde.

## Critério de pronto

- [ ] Migration aditiva aplicada no dev pelo CI; colunas de `auth.users` usadas pelas funções confirmadas no dev.
- [ ] Type-check e lint limpos; testes listados passando com números reais (`Tests N passed`), inclusive `pnpm test:full` no dev.
- [ ] Testes negativos de takeover, enumeração, escalada do síndico e corrida passando.
- [ ] RLS testada com usuário de outro tenant, de outro condomínio e sem membership.
- [ ] Nenhum e-mail/nome em log, em audit ou em payload de outbox; e-mails sem token e sem nota.
- [ ] `.env.example` e doc 09 com `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_URL` (só nomes) e checklist de Auth/SMTP; docs 03 e 11 atualizados.
- [ ] Verificação manual executada no dev e dados/usuários de teste apagados.
- [x] Decisões 1–6 tomadas (a 1 só aguarda confirmação do jurídico para o job de retenção).
