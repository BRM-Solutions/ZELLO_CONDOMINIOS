# Arquitetura

> **Quando ler:** ao criar um módulo, integração, job ou worker; ao tomar uma decisão estrutural; ao investigar um incidente.
> **Resumo:**
> - Só a API fala com o banco. O front usa Supabase apenas para Auth e para enviar/baixar arquivo por URL assinada emitida pela API; nunca lê tabelas.
> - Um projeto Supabase por ambiente concentra dados, Auth e Storage, governados juntos (ADR-009, [12](12-storage-e-governanca.md)).
> - Toda requisição autenticada segue: JWT Supabase → membership → `withTenantTx` → RLS. Nenhum handler acessa o banco fora de `withTenantTx`.
> - Isolamento por `organization_id` em todas as tabelas de negócio (schema compartilhado), garantido em duas camadas: código e RLS.
> - Efeito colateral externo (e-mail, WhatsApp, pagamento) nunca dentro da transação de negócio: grava na outbox, o worker entrega.
> - Comece sem fila e sem worker; adicione o worker quando o primeiro job ou integração aparecer.
> **Relacionados:** [banco](02-banco-de-dados.md), [storage](12-storage-e-governanca.md), [segurança](03-seguranca.md), [backend](05-backend-api.md), [deploy](09-deploy-easypanel-supabase.md), [lições](08-licoes-aprendidas.md)

## Visão de componentes

```
             navegador (React SPA)
             │            │
  supabase-js│ (Auth/URL) │ fetch /api/v1/*  Authorization: Bearer <access_token>
             ▼            ▼                   X-Organization-Id: <uuid>
   ┌──────────────┐   ┌──────────────────────────────┐   ┌───────────────────────┐
   │ Supabase Auth│   │ apps/api (Express, Easypanel)│   │ apps/web (nginx,      │
   │ JWKS público │◄──┤ valida JWT com jose + JWKS   │   │ Easypanel) estático   │
   └──────────────┘   │ pg Pool → pooler (app_api)   │   └───────────────────────┘
                      └──────┬───────────────▲───────┘
                             │ SQL + RLS      │ webhooks de provedores
                             ▼                │
   ┌────────────────────────────────────────────────┐   ┌──────────────────────┐
   │ Supabase Postgres (schema app, RLS em tudo)    │◄──┤ worker (opcional,    │
   │ outbox / inbound_events / jobs                 │   │ papel app_worker)    │
   └────────────────────────────────────────────────┘   └─────────┬────────────┘
   ┌────────────────────────────────────────────────┐             │ adapters
   │ Supabase Storage: bucket privado private-files │             ▼
   │ API assina com JWT do usuário; web faz PUT/GET │   pagamento / WhatsApp / e-mail
   │ direto na URL assinada; purga só pelo worker   │
   └────────────────────────────────────────────────┘
```

- Dois ambientes completos e separados: `dev` e `prod`. Cada um tem o **seu** projeto Supabase (Postgres + Auth + Storage) e os seus serviços Easypanel; nunca compartilhe Storage entre ambientes. Ver [09](09-deploy-easypanel-supabase.md) e [12](12-storage-e-governanca.md).
- O worker é o mesmo pacote da API com outro entrypoint (`dist/worker.js`) e outro serviço no Easypanel. Ver ADR-006.

## Monorepo e fronteiras

| Pacote | Pode importar | Nunca |
|---|---|---|
| `@app/shared` | só `zod` e utilitários puros | `pg`, `express`, React, `process.env`, I/O |
| `@app/api` | `@app/shared`, `pg`, `express`, `jose`, adapters | código de `apps/web` |
| `@app/web` | `@app/shared`, React, `@supabase/supabase-js` (Auth) | `pg`, segredos, `service_role`, consultas a tabelas via supabase-js |

- Schemas Zod de entrada/saída vivem em `@app/shared`: a API valida com eles, o front reusa no formulário. Um contrato, dois usos.
- `@app/shared` **não tem build**: `main`/`types` apontam para `src/index.ts`; o Vite compila no web e o `tsup` da API embute o pacote (`noExternal: ["@app/shared"]`). Não adicione `dist/` nem `tsc -b` para ele.
- Regra de negócio que decide dinheiro, permissão ou estado fica só na API. O front pode pré-calcular para exibir, nunca para gravar (lição: preço sempre recalculado no servidor, ver [08](08-licoes-aprendidas.md)).
- Estrutura da API (é a do scaffold; se mudar, registre ADR):

```
apps/api/src/
  index.ts            boot HTTP
  worker.ts           boot do worker (quando existir)
  app.ts              cadeia de middlewares + montagem dos routers
  config.ts           env validado por Zod, falha no boot
  http.ts             DomainError, requestId, asyncRoute, parse, sendData, notFoundHandler, errorHandler
  db.ts               createPool, getDb, runInTx, withTenantTx(req, fn), withWorkerTx(db, orgId, fn)
  auth/               authenticate.ts, membership.ts, require-role.ts (requireRole, requirePermission)
  modules/<modulo>/   routes.ts, repository.ts (+ service.ts quando houver regra)
  integrations/       webhook-adapter.ts (interface), storage-client.ts (StorageClient injetável); adapters por módulo
  jobs/               outbox.ts (claim, retry, requeue), files-retention.ts (purga e reconciliação)
  test/               *.test.ts (unit/HTTP) e *.int.test.ts (integração, banco dev)
```

## Fluxo de uma requisição autenticada

Ordem fixa dos middlewares (contrato): `requestId` → `pino-http` → `helmet` → `cors` → `/health` e `/ready` → rate-limit → webhooks (`express.raw`) → `express.json({ limit })` → `authenticate` → `loadMembership` → handler com `withTenantTx`. Rota de exemplo do scaffold: `GET /api/v1/workspaces` (com `X-Organization-Id`).

1. **Login no front**: `supabase.auth.signInWithPassword` ou `signInWithOtp` (magic link). O SDK guarda e renova a sessão; o front envia `session.access_token` como Bearer.
2. **`requestId`**: usa `X-Request-Id` recebido ou gera `req_<uuid>`; devolve no header. Todo log e todo erro carregam esse id.
3. **`authenticate`**: verifica assinatura, `exp`, `iss` e `aud` do JWT contra o JWKS do projeto. Só confia em `sub`. Não lê papel do token.

Código real em `apps/api/src/auth/authenticate.ts`: `createRemoteJwtVerifier(config)` monta o verificador (`jose` `createRemoteJWKSet` + `jwtVerify` com `issuer = SUPABASE_URL/auth/v1` e `audience = "authenticated"`) e `authenticate(verifier)` é o middleware (injetável, para testes com chave local). Falta de token → `401 AUTH_REQUIRED`; assinatura/`exp`/`iss`/`aud` inválidos ou sem `sub` → `401 AUTH_INVALID`; só `req.auth = { userId }` é preenchido.

   - JWKS fica em `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`; o edge do Supabase cacheia 10 min. Não cacheie por mais tempo que isso na API (o `createRemoteJWKSet` do `jose` já faz cache curto e refaz a busca quando aparece um `kid` novo).
   - Projetos novos usam chaves assimétricas por padrão; se o projeto ainda estiver no segredo HS256 legado, migre para signing keys antes de ir a produção (a doc do Supabase desaconselha verificar com segredo compartilhado).
4. **`loadMembership`**: lê `X-Organization-Id` (uuid validado por Zod; ausente/inválido → `400 VALIDATION_ERROR`), busca os memberships ativos do usuário naquela organização (dentro de `withTenantTx`, read-only) e grava `req.membership = { organizationId, role, workspaceIds }` com o papel mais alto. Sem membership → 404 (não 403, para não confirmar que a organização existe). Rotas "sem organização" (listar minhas organizações, aceitar convite) pulam este middleware explicitamente.
5. **Handler**: valida entrada com Zod, checa papel (`requirePermission("workspaces:read")`, matriz `PERMISSIONS` em `@app/shared`, ou `requireRole(...)`), e abre `withTenantTx(req, fn)`. Dentro da transação a API injeta `request.jwt.claim.sub` e `app.org_id`; as policies usam esses valores. Detalhe e código: [02](02-banco-de-dados.md) §"withTenantTx".
6. **Resposta**: `sendData` → `{ data, meta: { requestId, ...meta } }` em sucesso (listas: `meta: { requestId, page, pageSize, total }`); `{ error: { code, message, details? } }` em erro, sem stack. Padrão de handler: [05](05-backend-api.md).

Por que o papel vem do banco e não de claim: revogar acesso tem efeito na próxima requisição, sem esperar o JWT expirar, e não depende de hook de token customizado.

## Multi-tenancy

- Modelo: schema compartilhado, coluna `organization_id` (+ `workspace_id` quando a linha pertence a um workspace). Detalhe em [02](02-banco-de-dados.md) §"Modelo base".
- Três barreiras, todas obrigatórias: (1) o handler filtra por `req.membership.organizationId`; (2) a policy RLS exige `organization_id = app.current_org_id()` e membership; (3) FKs compostas `(organization_id, workspace_id)` impedem ligar linha de um tenant a objeto de outro.
- `organization_id` nunca vem do corpo da requisição: vem do membership validado.
- Um usuário pode pertencer a várias organizações; o front escolhe a ativa e manda no header. A API nunca mistura duas organizações na mesma transação.

## Adicionar um módulo novo (passo a passo)

1. Spec aprovada ([10](10-workflow-claude.md)). Liste tabelas, papéis que leem/escrevem e dados pessoais envolvidos.
2. Migration nova (`supabase migration new <modulo>`), a partir de `templates/migration-template.sql`: tabela com `organization_id`/`workspace_id`, FKs compostas, CHECKs, índices, `enable row level security`, policies por operação, grants para `app_api`. Ver [02](02-banco-de-dados.md).
3. Schemas Zod em `packages/shared/src/<modulo>.ts` (entrada, patch, saída) e export no `index.ts`.
4. `apps/api/src/modules/<modulo>/repository.ts`: SQL parametrizado, recebe o `client` da transação, sem `pool.query` direto.
5. `service.ts`: regras de negócio, sem Express. `routes.ts`: valida, checa papel, chama `withTenantTx`, responde.
6. Monte o router em `app.ts` atrás de `authenticate` + `loadMembership`.
7. Testes ([07](07-testes.md)): caminho feliz, validação, papel insuficiente, e **isolamento entre dois tenants** ([03](03-seguranca.md) §"Testar isolamento").
8. Front: hook TanStack Query + tela ([06](06-frontend.md)), conferida em 320–414px.
9. Se o módulo envia algo para fora: outbox + adapter (seção abaixo). Se mexe em dado pessoal: atualizar o inventário LGPD ([03](03-seguranca.md) §"LGPD").

## Integrações, outbox e webhooks idempotentes

Padrão adapter: cada provedor (pagamento, WhatsApp, e-mail, PDF) tem `integrations/<x>/adapter.ts` com uma interface pequena, uma implementação real e uma fake para teste. O domínio só conhece a interface. O fake é escolhido por config de teste, nunca por "não há credencial" em produção.

**Saída (outbox transacional)**

- A transação de negócio insere em `app.outbox (organization_id, event_type, aggregate_id, payload, status, attempts, next_attempt_at)` com `UNIQUE (event_type, aggregate_id)` e `ON CONFLICT DO NOTHING`. Se a transação faz rollback, nada é enviado; se repetir, nada duplica.
- O worker reivindica lote com `select ... for update skip locked`, marca `processing`, chama o adapter fora da transação, grava `sent`/`retry` (backoff exponencial em `next_attempt_at`)/`failed` após N tentativas.
- Estado `unknown` para resultado ambíguo (timeout depois de enviar): não reenviar automaticamente o que pode chegar em dobro ao destinatário; exige ação humana. Padrão recorrente: reenvio automático de mensagem é pior que atraso.
- Job de recuperação devolve para `retry` itens presos em `processing` há mais de X minutos (réplica morreu no meio).
- SQL de claim e índices parciais: [02](02-banco-de-dados.md) §"Concorrência".

**Entrada (webhooks)**

1. Autenticar (assinatura/token, segredo obrigatório em produção) antes de qualquer outra coisa. Ver [03](03-seguranca.md) §"Webhooks".
2. Gravar `app.inbound_events (provider, provider_event_id)` com UNIQUE e `ON CONFLICT DO NOTHING`; se já existia, responder 200 e parar.
3. Enfileirar o processamento (linha em `app.jobs`/outbox interna) e responder 200 rápido.
4. O processador **nunca confia no corpo**: consulta o provedor de novo com credencial própria para obter status e valor reais (lição: o webhook de pagamento só dizia "olhe este id").
5. Reconciliação periódica cobre webhooks perdidos e passa pelo mesmo processador (um único caminho de código confirma o estado).

Fila externa (RabbitMQ, Redis): não no começo. A outbox em Postgres aguenta o volume inicial típico de um SaaS B2B. DECIDIR quando: >~50 eventos/s sustentados ou necessidade de fan-out entre serviços.

## Jobs agendados

- Nunca `setInterval` dentro do processo da API. Motivo: com mais de uma réplica, cada job roda N vezes; e um deploy da API derruba o agendador.
- O worker roda um loop por job; cada execução abre transação e tenta `pg_try_advisory_xact_lock(hashtext('<job>'))`. Sem lock, pula (outra réplica está rodando). Use a versão `xact` por causa do pooler em modo transação.
- Todo job é idempotente e retomável: processa em lotes pequenos, grava progresso, pode ser interrompido a qualquer momento.
- Todo job registra início/fim/contagem no log com `job=<nome>` e, se alterar dado de negócio, em `audit_log` com `actor_kind = 'worker'`.
- Job que toca dado de um tenant usa `withWorkerTx(db, orgId, fn)` (pool do worker injetado), que injeta `app.org_id` como a API faz; o worker não ganha `BYPASSRLS`.

DECIDIR: agendador. Opções: (a) loop no worker com advisory lock (recomendado: um lugar só, testável, logs juntos); (b) `pg_cron` no Supabase chamando função SQL [verificar disponibilidade e limites no plano]; (c) cron do Easypanel chamando endpoint protegido. Recomendação: (a); (b) só para manutenção puramente SQL (limpeza de tabelas).

## Observabilidade

- Logs: `pino` JSON em stdout, um log por requisição via `pino-http` (`quietReqLogger`), com `requestId`, `userId`, `organizationId`, rota, status, duração. Nada de `console.log` em código novo.
- `redact` obrigatório para `req.headers.authorization`, cookies e campos pessoais (CPF, telefone, e-mail no corpo). Regra completa: [03](03-seguranca.md) §"Logs".
- `X-Request-Id` volta em toda resposta e aparece na mensagem de erro do front ("informe o código req_..."). É o fio que liga relato do usuário → log → `audit_log.request_id`.
- `GET /health`: liveness, não toca banco, responde `200 { status: "ok", service: "{{SLUG}}-api" }` se o processo está vivo. É o que o Easypanel usa para reiniciar container [verificar config de healthcheck no doc 09].
- `GET /ready`: `select 1` com timeout curto (ex.: 2 s); 503 se falhar. Use para gate de deploy e monitor externo.
- Diagnóstico profundo (fila, backlog da outbox, jobs atrasados) fica em rota separada protegida por token comparado em tempo constante (ex.: `/ops/health` com `timingSafeEqual`), nunca pública.
- Métricas mínimas a observar desde o dia 1: taxa de 5xx, p95 de latência, itens `pending/retry` na outbox mais velhos que 10 min, falhas de job, conexões do pool (`waitingCount`).
- DECIDIR: rastreamento de erros. Opções: (a) só logs do Easypanel; (b) Sentry (front e API, com scrub de PII); (c) log drain do Supabase + agregador. Recomendação: (b) antes do primeiro cliente pagante.

## Decisões (ADR curtas)

Formato completo para ADRs novas: `templates/adr-template.md`.

| ADR | Decisão | Por quê | Status |
|---|---|---|---|
| 001 | Monorepo pnpm com `@app/api`, `@app/web`, `@app/shared` | Um contrato Zod para api e web, sem duplicar tipos | Aceita |
| 002 | Só a API acessa o banco; Data API (PostgREST) do Supabase desligada | Uma única porta para regras, autorização e auditoria; elimina a superfície `anon`/`authenticated` direta | Aceita |
| 003 | `pg` direto, SQL parametrizado, sem ORM | Controle de transação, locks e `set_config`; SQL auditável | Aceita |
| 004 | RLS deny-by-default em todas as tabelas, mesmo com a API filtrando | Defesa em profundidade contra IDOR; bug no handler não vaza tenant | Aceita |
| 005 | Papel do usuário vem de `memberships`, lido por requisição | Revogação imediata; sem hook de claims | Aceita |
| 006 | Outbox em Postgres + worker (mesmo pacote, outro entrypoint) no lugar de broker | Menos infra e menos segredo; lição: broker extra trouxe credencial vazada e ponto de falha | Aceita |
| 007 | Supabase Cloud (dev + prod) com app no Easypanel | Backup, PITR, Auth e upgrades gerenciados | DECIDIR |
| 008 | Multi-tenant por coluna `organization_id` (schema compartilhado) | Simples, migrations únicas, RLS resolve isolamento | Aceita |
| 010 | `organization` = cliente pagante (administradora ou condomínio autogerido); `workspace` = condomínio ([ADR-010](adr/0010-tenant-organization-workspace-condominio.md)) | Administradora gere vários condomínios com um login; usa o modelo base sem migration estrutural | Aceita |
| 009 | Storage centralizado: metadados em `app.files`, binário no bucket privado `private-files`; API assina com JWT do usuário + publishable; secret key só no worker | Uma identidade, uma RLS e uma trilha para dado e arquivo; nenhuma chave que ignora RLS na requisição | Aceita |

**ADR-007 DECIDIR: onde roda o Supabase.** (a) Supabase Cloud, plano Pro em prod (backups diários de 7 dias, PITR opcional) — recomendado; (b) self-hosted no Easypanel: custo de licença zero, mas você passa a operar Postgres, Auth, Storage, Kong, upgrades de segurança, backup/WAL e restore testado; só compensa com alguém dedicado a operar banco. Projeto Free não serve para prod (sem backup automático, pausa por inatividade). Comparativo de custos e passos: [09](09-deploy-easypanel-supabase.md).

**ADR-009 DECIDIDO: Storage centralizado e governado.** Um projeto Supabase por ambiente concentra Postgres, Auth e Storage. Metadados em `app.files` (RLS como as demais, classificação, status `pending|available|quarantined|deleted`, `retention_until`, `legal_hold`); binário no bucket privado `private-files`, caminho `<organization_id>/<workspace_id|org>/<file_id>/<nome-sanitizado>`. Policies de `storage.objects` autorizam via `app.can_access_object(name, mode)` (`security definer`, único grant ao papel `authenticated`). A API chama o Storage com o JWT do usuário + chave *publishable* (policies valem); só o worker usa a secret key, para purga por retenção e reconciliação. Fluxo `POST /api/v1/files` → upload direto → `POST /api/v1/files/:id/complete` → `GET /api/v1/files/:id/url` (60–300 s, auditado) → `DELETE /api/v1/files/:id` (soft delete). Descartadas: serviço interno com secret key só para Storage (mais um processo com chave que ignora RLS) e `service_role` na API (nunca). Em aberto (DECIDIR no [12](12-storage-e-governanca.md)): antivírus e backup dos objetos. Detalhe completo: [12](12-storage-e-governanca.md).

## Checklist

- [ ] Handler novo passa por `authenticate` + `loadMembership` (ou está explicitamente na lista de rotas sem organização).
- [ ] Nenhum acesso ao banco fora de `withTenantTx`/`withWorkerTx`.
- [ ] Nenhuma chamada a API externa dentro de transação.
- [ ] Efeito colateral externo passa por outbox com chave de idempotência.
- [ ] Job novo usa advisory lock, é idempotente e loga início/fim.
- [ ] Decisão estrutural nova registrada como ADR.
