# Spec — Estrutura do condomínio (condomínios, blocos, unidades, pessoas e vínculos)

> PRD: [estrutura-condominio-acesso](../prd/estrutura-condominio-acesso.md) — Status: rascunho (aguarda aprovação) — Data: 2026-11-05
> Onda 1, trilha B ([roteiro](README.md)). Decisões: [ADR-010](../adr/0010-tenant-organization-workspace-condominio.md), [11-dominio](../11-dominio.md) §2–4 (P3, D1, D2, R3, R6).
> Docs a ler para implementar: [02](../02-banco-de-dados.md) §"RLS", §"Funções helper", §"LGPD no schema"; [03](../03-seguranca.md) §"Autorização", §"Criptografia de campos sensíveis", §"Testar isolamento entre tenants"; [05](../05-backend-api.md); [07](../07-testes.md); `docs/templates/migration-template.sql`.

## Objetivo

Dar ao sistema a estrutura real de cada condomínio e de quem está ligado a ele, base de todos os módulos: condomínio (com slug e endereço), blocos, unidades, pessoas (com ou sem login) e vínculos pessoa↔unidade com histórico, mais o papel `council` (conselho restrito ao condomínio). Habilita o pré-cadastro de todos os moradores pela administradora/síndico (R6). Só banco, API e shared; as telas vêm na Onda 2.3.

## Estado atual

- `supabase/migrations/20261030120000_base_multitenant.sql:53-65` — `app.workspaces` (`name`, `cnpj`, `city`, `state`, `status`); sem slug nem endereço.
- `…base_multitenant.sql:67-83` — `app.memberships`; `role` check em `:72`; `memberships_scope_check` em `:78-81` (`owner/admin` sem workspace; `manager/staff/member` com workspace).
- `…base_multitenant.sql:184-206` — helpers `app.has_org_role()` e `app.workspace_ids()`; padrão a seguir para `app.my_unit_ids()`.
- `packages/shared/src/tenancy.ts:4-12` — `ROLES`, `ROLE_RANK`, `highestRole`; `:23-34` `workspaceSchema`.
- `packages/shared/src/permissions.ts:3-13` — matriz de permissões.
- `apps/api/src/auth/membership.ts:15-40` — carrega memberships da organização e guarda **o papel mais alto** da organização + `workspaceIds`.
- `apps/api/src/auth/require-role.ts:5-16` — checa papel da organização, não do workspace da rota.
- `apps/api/src/modules/workspaces/routes.ts:11-23` e `repository.ts:31-40` — só listagem.
- `apps/api/src/app.ts:78` — registro dos routers autenticados.
- `apps/api/src/audit.ts:14` — `recordAudit`.
- `apps/api/src/config.ts:37-56` — schema de env da API (sem chaves de cifragem).
- Protótipo (zip): `docs/referencias/condominio-360/src/lib/moradores.ts:3-15` — vínculos, situações, campos da pessoa e da unidade; `routes/moradores.tsx:62-99` — filtros e formulário.

## Modelo de dados

Migration `supabase/migrations/<timestamp>_condominium_structure.sql`, tipo **expand**, a partir do template.

**Papéis**
- `app.memberships`: trocar o check de `role` (`:72`) para incluir `council` e o `memberships_scope_check` (`:78-81`) para exigir `workspace_id` também em `council` (`drop constraint` + `add constraint` com os mesmos nomes; linhas existentes continuam válidas).

**Condomínio**
- `app.workspaces`: `slug text` (`^[a-z0-9]+(-[a-z0-9]+)*$`, 3–60, único global, nulo permitido para linhas existentes) e `address text` (≤ 200). `cnpj/city/state` ficam (opcionais).

**Estrutura**
- `app.blocks`: `id`, `organization_id`, `workspace_id`, `name` (1–60), `sort_order int default 0`, `created_at/updated_at`; `unique (workspace_id, lower(name))`; FK composta para `workspaces`.
- `app.units`: `id`, `organization_id`, `workspace_id`, `block_id`, `number` (1–20, ex.: "1201"), `status` (`active|inactive`), timestamps; `unique (block_id, lower(number))`; FK composta `(organization_id, workspace_id, block_id)` → `blocks` (exige `unique (organization_id, workspace_id, id)` em `blocks`). Sem andar nem fração ideal (P3).

**Pessoas e vínculos**
- `app.people`: `id`, `organization_id`, `workspace_id`, `full_name` (2–160), `email` (minúsculo, ≤ 254), `phone_enc text null`, `phone_hash text null`, `whatsapp_enc text null`, `photo_file_id uuid null` (FK `app.files`, mesmo tenant), `user_id uuid null` (FK `auth.users` `on delete set null`), `status` (`active|inactive|pending` = Ativo/Inativo/Pendente de confirmação), `access_status` (`none|pending_approval|active|suspended`), `created_by`, timestamps. `unique (workspace_id, email)`; `unique (workspace_id, user_id) where user_id is not null`. `comment on column ... is 'pii:<tipo>'` em `full_name`, `email`, `phone_*`, `whatsapp_enc`, `photo_file_id` ([02](../02-banco-de-dados.md) §"LGPD no schema").
- `app.unit_members`: `id`, `organization_id`, `workspace_id`, `unit_id`, `person_id`, `relation` (`owner|tenant|resident|other` = Proprietário/Inquilino/Morador/Outros), `starts_on date not null default current_date`, `ends_on date null` (`check ends_on >= starts_on`), `created_by`, timestamps; `unique (unit_id, person_id) where ends_on is null`. Encerrar = preencher `ends_on`; **sem delete** (histórico, R3).
- Histórico de cada pessoa (protótipo `historico`) = eventos de `app.audit_log` com `entity_type = 'person'`, sem tabela nova.

**Helper**
- `app.my_unit_ids()` `returns setof uuid`, `security definer`, `set search_path = ''`: unidades com `unit_members` ativo (`ends_on is null or ends_on > current_date`: o acesso termina **na data de término**, para o síndico poder cortar na hora; decisão de segurança tomada na verificação local, 2026-11-05; por isso a data de término não pode ser futura e o fuso das datas de negócio é `America/Sao_Paulo`, fixado em `runInTx`) cuja pessoa tem `user_id = app.current_user_id()`, `access_status = 'active'`, na `app.current_org_id()`. Grant só a `app_api`.

**RLS** (todas `to app_api`, `(select app.current_org_id())`, deny-by-default):

| Tabela | select | insert/update |
|---|---|---|
| `blocks`, `units` | `workspace_id in (select app.workspace_ids())` (todos os papéis do condomínio) | `app.workspace_ids(array['owner','admin','manager'])` |
| `people` | gestão: `app.workspace_ids(array['owner','admin','manager'])`; `member`: `user_id = app.current_user_id()` | gestão; `member` só atualiza o próprio telefone/WhatsApp/foto (coluna-a-coluna na API; policy limita à própria linha) |
| `unit_members` | gestão; `member`: `unit_id in (select app.my_unit_ids())` | gestão |
| `memberships` (existente) | sem mudança além do papel novo | — |

`council` e `staff` **não** veem pessoas nem vínculos (protótipo: Moradores só para síndico e administração, `R/components/vg/AppShell.tsx:31`). Sem `delete` em nenhuma tabela nova (inativar/encerrar). Índices: `(organization_id, workspace_id)` em todas; `people (workspace_id, lower(full_name))`; `unit_members (unit_id) where ends_on is null`; `unit_members (person_id)`.

## Shared (`packages/shared`)

- `tenancy.ts`: `ROLES` com `council`; `ROLE_RANK` = owner 6, admin 5, council 4, manager 3, staff 2, member 1; `workspaceSchema` com `slug`, `address`.
- `permissions.ts`: `structure:read` (todos), `structure:write` (owner, admin, manager), `people:read` / `people:write` (owner, admin, manager), `people:reveal` (owner, admin, manager).
- `condominium.ts` (novo): `blockSchema`, `unitSchema`, `createUnitsBatchSchema` (bloco + lista de números, máx. 500), `personSchema` (telefone **mascarado**), `createPersonSchema` (nome, e-mail, telefone/WhatsApp opcionais em E.164 BR, unidades `[{ unitId, relation, startsOn? }]`), `updatePersonSchema`, `unitMemberSchema`, `RELATIONS`, `PERSON_STATUSES`, `ACCESS_STATUSES`, `peopleFilterSchema` (nome, e-mail, bloco, número, vínculo, situação, ordem `az|za`, paginação — filtros do protótipo `R/routes/moradores.tsx:62-68`). Export em `index.ts`.

## Backend (`apps/api`)

**Autorização por condomínio:** `apps/api/src/auth/require-workspace.ts` (novo) — `requireWorkspacePermission(permission)` lê `:workspaceId`, confere que pertence à organização e que o usuário tem papel com a permissão **naquele condomínio** (`owner/admin` da organização ou membership com aquele `workspace_id`), usando os dados já carregados em `req.membership` (estender `membership.ts:35-38` para guardar `{ workspaceId, role }[]`). Workspace de outro tenant ou sem vínculo = 404.

**Cifragem:** `apps/api/src/crypto/pii.ts` (novo) — `encryptPii`/`decryptPii` AES-256-GCM formato `v1:<iv>:<tag>:<ct>` e `hashPii` HMAC-SHA256, chaves `DATA_ENCRYPTION_KEY` e `DATA_HASH_KEY` (32 bytes base64) validadas em `config.ts`; nomes em `.env.example` e no doc 09. Telefone normalizado (E.164) antes de cifrar/hashear. Respostas sempre mascaradas (`(21) •••••-0000`).

| Método | Rota | Permissão (no condomínio) | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| POST | `/api/v1/workspaces` | owner, admin (organização) | nome, slug, endereço, cidade, UF, CNPJ? | workspace | 400; 409 slug |
| PATCH | `/api/v1/workspaces/:workspaceId` | `structure:write` | parcial | workspace | 400, 404, 409 |
| GET/POST | `/api/v1/workspaces/:workspaceId/blocks` | read / write | `blockSchema` | bloco(s) | 409 nome |
| PATCH | `…/blocks/:blockId` | `structure:write` | nome, ordem | bloco | 404, 409 |
| GET | `…/units?blockId=` | `structure:read` | paginação | unidades | — |
| POST | `…/units` e `…/units/batch` | `structure:write` | unidade / `createUnitsBatchSchema` | criadas + ignoradas (já existentes) | 400 |
| PATCH | `…/units/:unitId` | `structure:write` | número, status | unidade | 404, 409 |
| GET | `…/people` | `people:read` | `peopleFilterSchema` | lista paginada mascarada | — |
| POST | `…/people` | `people:write` | `createPersonSchema` (pré-cadastro, R6) | pessoa (`access_status = none`) | 409 e-mail |
| GET/PATCH | `…/people/:personId` | `people:read` / `people:write` | `updatePersonSchema` | pessoa + vínculos (ativos e históricos) | 404 |
| POST | `…/people/:personId/reveal-contact` | `people:reveal` | `{ reason }` (≥ 10 caracteres) | telefone/WhatsApp completos | 404; **audita** |
| POST | `…/people/:personId/units` | `people:write` | `{ unitId, relation, startsOn? }` | vínculo | 409 vínculo ativo duplicado |
| POST | `…/unit-members/:id/end` | `people:write` | `{ endsOn }` | vínculo encerrado | 400 data |
| GET | `/api/v1/me/units` | autenticado | — | unidades e vínculos do próprio usuário | — |

- Módulos: `apps/api/src/modules/condominium/{routes,repository,service}.ts`; registrar em `app.ts:78`. Toda query em `withTenantTx`.
- `recordAudit` em: criar/alterar condomínio, bloco, unidade; criar/alterar pessoa (campos alterados, nunca valores de contato); vincular/encerrar; `person.contact_reveal` (com motivo).
- Log com `redact` de `email`, `phone`, `whatsapp` ([03](../03-seguranca.md) §"Logs").
- Aprovação de acesso e página de cadastro: **fora**, Onda 2.2 (usa `access_status`).

## Frontend (`apps/web`)

Nenhuma tela nesta spec (Onda 2.3, telas de `/moradores` do protótipo). Só os tipos do shared ficam disponíveis.

## Segurança e tenant

- Isolamento: `organization_id` + FK composta em toda tabela; RLS + checagem de papel por condomínio na API (corrige o uso do papel mais alto da organização de `membership.ts:31` para rotas de condomínio).
- `member` só enxerga a própria pessoa e as próprias unidades (`app.my_unit_ids()`), nunca o diretório.
- Telefone/WhatsApp cifrados na API, mascarados na resposta, revelação só com motivo e auditada. Sem CPF (P3).
- Slug é público por desenho (login/cadastro), não contém dado pessoal.

## Fora de escopo

Página de cadastro, confirmação de e-mail e aprovação (2.2); telas (2.3); `super_admin` (2.4); importação por planilha (plano Fase 3); foto da pessoa via upload (campo existe; fluxo de arquivo entra na 2.3); retenção/anonimização de pessoas (aguarda jurídico).

## DECIDIR

- Nenhum de produto. Pendência jurídica registrada em [11-dominio](../11-dominio.md) §6 (base legal e retenção de `people`), que não bloqueia a implementação em dev.

## Verificação manual

1. Dev, tenant de teste A (org, dois condomínios A1/A2) e B, criados pelo teste/script e apagados ao final.
2. Como admin de A: criar A1 com slug, 2 blocos, 6 unidades pelo `batch` (repetir o batch: nenhuma duplicada), pré-cadastrar 3 pessoas com telefone, vincular, encerrar um vínculo e conferir histórico.
3. Conferir no banco que `phone_enc` não contém o número em claro e que a resposta mostra mascarado; `reveal-contact` sem motivo = 400; com motivo = número + linha em `audit_log`.
4. Manager só de A1: tudo em A1; A2 = 404. Council de A1: lê blocos/unidades, `people` = 403. Staff: idem council. Member vinculado: `GET /me/units` só a sua; `GET .../people` = 403.
5. Usuário de B: todas as rotas de A = 404.
6. Apagar os tenants de teste e conferir que nada sobrou.

## Testes automatizados

- `apps/api/src/test/condominium.test.ts` (rápido, fake db/supertest): validação (400), permissões por papel e por condomínio (403/404), mascaramento, `reveal-contact` exige motivo e audita.
- `apps/api/src/test/condominium.int.test.ts` (banco dev): RLS A/B entre tenants; manager de A1 × A2; council/staff sem `people`; member só `my_unit_ids`; unicidades (slug, bloco, unidade, e-mail, vínculo ativo); encerramento preserva histórico; batch idempotente.
- `apps/api/src/crypto/pii.test.ts`: ida e volta, IV aleatório, hash determinístico, chave errada falha.
- `packages/shared/src/condominium.test.ts`: schemas (telefone BR, e-mail, limites).
- `supabase/tests/catalog.sql` continua verde (toda tabela nova com RLS e policy); `migrations.pglite.test.ts` aplica a migration nova.

## Critério de pronto

- [ ] Migration aditiva aplicada no dev pelo CI; constraints de papel aceitam `council` sem invalidar linhas existentes.
- [ ] Type-check e lint limpos; testes listados passando com números reais (`Tests N passed`), inclusive `pnpm test:full` no dev.
- [ ] RLS testada com usuário de outro tenant e com papel de outro condomínio.
- [ ] Nenhum telefone em claro no banco, em log ou em resposta sem revelação auditada.
- [ ] `.env.example` e doc 09 com `DATA_ENCRYPTION_KEY` e `DATA_HASH_KEY` (só nomes).
- [ ] Verificação manual executada e dados de teste apagados.
