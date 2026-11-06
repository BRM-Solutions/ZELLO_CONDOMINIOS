# Backend — anatomia da API

> **Quando ler:** ao criar ou alterar rota, serviço, repositório, webhook, upload, PDF, job ou config em `apps/api`.
> **Resumo:**
> - `app.ts` monta o Express e exporta `app` sem efeitos colaterais; `index.ts` só faz `listen` e shutdown; jobs e outbox rodam em `worker.ts`.
> - Cadeia fixa: `requestId → pino-http → helmet → cors → rate-limit → authenticate → loadMembership → handler`.
> - Handler fino (parse Zod + chamar serviço); serviço tem a regra; repositório tem o SQL (`pg`, parametrizado).
> - Todo acesso a dado de tenant passa por `withTenantTx(req, fn)`; nada de `pool.query` solto em rota.
> - Escrita sensível exige `Idempotency-Key`; chamada de rede externa nunca dentro de transação.
>
> **Relacionados:** [arquitetura](01-arquitetura.md), [storage](12-storage-e-governanca.md), [banco](02-banco-de-dados.md), [segurança](03-seguranca.md), [boas práticas](04-boas-praticas.md), [testes](07-testes.md), [deploy](09-deploy-easypanel-supabase.md), [lições](08-licoes-aprendidas.md)

## Estrutura

- Árvore de pastas canônica em [arquitetura](01-arquitetura.md#monorepo-e-fronteiras) (`app.ts`, `index.ts`, `worker.ts`, `config.ts`, `http.ts`, `db.ts`, `auth/`, `modules/<modulo>/`, `integrations/<x>/`, `jobs/`). Este doc descreve o que vai dentro de cada peça.
- Utilitários transversais deste doc (idempotência, storage, PDF) ficam em `src/lib/` quando usados por mais de um módulo.
- Express **4** (decisão do kit; latest-4 hoje é 4.22.x). Express 4 não captura rejeição de handler `async`: use `asyncRoute` sempre.

## app.ts vs index.ts vs worker.ts

- `app.ts` não abre conexão, não agenda `setInterval`, não consome fila. Padrão recorrente: `app.ts` que dispara consumidores de fila no import e `index.ts` com jobs em `setInterval` fazem qualquer teste com supertest subir consumidor junto, e com N réplicas cada job rodaria N vezes (ver [lições](08-licoes-aprendidas.md#banco-e-testes)).
- `index.ts`: só `listen` e shutdown. Jobs e outbox ficam em `worker.ts` (processo separado, mesmo build).

```ts
const server = app.listen(config.API_PORT, () => logger.info({ port: config.API_PORT }, "api.up"));
function shutdown(signal: string) {
  logger.info({ signal }, "api.shutdown");
  server.close(() => { void pool.end().finally(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

- `worker.ts` faz o mesmo: ao receber `SIGTERM`, para de reivindicar lotes, termina o item atual e fecha o pool.
- Sem shutdown, um deploy no meio de um envio deixa itens "em processamento", resolvidos só por uma rotina de recuperação de abandonados. Faça os dois: shutdown e recuperação.

## Cadeia de middlewares (contrato)

Resumo de `apps/api/src/app.ts` (`createApp({ config, db, verifier, logger, webhookAdapters })`, dependências injetadas para teste):

```ts
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.locals.db = db;
app.use(requestId);
app.use(pinoHttp({ logger: log, genReqId: (req) => req.id, autoLogging: { ignore: quietHealth } }));
app.use(helmet());
app.use(cors({ origin: allowlist(config.webOrigins), allowedHeaders: [..., "X-Organization-Id", "Idempotency-Key"], exposedHeaders: ["X-Request-Id"], credentials: false }));
app.use(healthRouter());
app.use(rateLimit({ windowMs: 60_000, limit: 300, handler: () => next(DomainError 429 RATE_LIMITED) }));
app.use("/api/v1/webhooks", express.raw({ type: "*/*", limit: "64kb" }), webhooksRouter(webhookAdapters));
app.use(express.json({ limit: "64kb" }));
app.use("/api/v1/me", authenticate(verifier), meRouter());
app.use("/api/v1", authenticate(verifier), loadMembership, workspacesRouter());
app.use(notFoundHandler);
app.use(errorHandler);
```

- `trust proxy`: atrás do proxy do Easypanel, sem isso `req.ip` é o IP do proxy e o rate-limit por IP vira global. `[verificar no seu deploy: número de saltos do proxy]`.
- Rate-limit: `express-rate-limit` (v8 hoje) `[verificar API da versão instalada]`. Memória local só vale com **uma réplica**; com mais de uma, store em Postgres. Rotas de login/convite/recuperação com limite próprio, mais baixo.
- Webhooks montados **antes** de `authenticate` (autenticam por assinatura/segredo próprio) e com corpo bruto (`express.raw`), porque HMAC é calculado sobre os bytes recebidos; o router faz o `JSON.parse` depois de validar a assinatura.
- `authenticate`: valida o Bearer com `jose` contra o JWKS do Supabase e preenche só `req.auth = { userId }`. Código e detalhes em [arquitetura](01-arquitetura.md#fluxo-de-uma-requisição-autenticada).
- `loadMembership`: lê `X-Organization-Id`, busca o membership ativo e preenche `req.membership`; sem membership → 404. Rotas sem organização (`/me`, aceitar convite) pulam este middleware explicitamente. Papel **nunca** vem de claim do JWT.
- Autorização: `requirePermission("workspaces:read")` (preferido; papéis vêm de `PERMISSIONS`/`rolesFor` em `packages/shared/src/permissions.ts`) ou `requireRole("admin", "manager")` por rota. Sem membership → 404, papel insuficiente → `403 FORBIDDEN`. A matriz fica em `@app/shared` (o front usa a mesma para esconder botões). Lição: matriz duplicada front/back divergiu e exigiu correção nos dois lados.

## Handler, serviço, repositório

Exemplo real (`apps/api/src/modules/workspaces/routes.ts`, `GET /api/v1/workspaces`):

```ts
router.get("/workspaces", requirePermission("workspaces:read"), asyncRoute(async (req, res) => {
  const query = parse(paginationQuerySchema, req.query);
  const organizationId = req.membership?.organizationId;
  if (!organizationId) throw notFound();
  const { items, total } = await withTenantTx(req, (tx) => listWorkspaces(tx, organizationId, query), { readOnly: true });
  sendData(req, res, items, buildPaginationMeta(query, total));
}));
```

- Escrita segue o mesmo molde: `parse(schema, req.body)`, serviço dentro de `withTenantTx`, `res.status(201)` + `sendData`.

- Handler: parse, chamar serviço, serializar. Sem SQL, sem regra.
- Serviço: regra de negócio, recebe `tx` e o contexto; lança `DomainError`.
- Repositório: SQL parametrizado (`$1`), sempre com `organization_id = $n` no `where` mesmo com RLS (defesa em profundidade); mapeia `snake_case → camelCase`.
- SQL dinâmico (ordenar/filtrar) só por allowlist de colunas; nunca interpolar entrada.

## withTenantTx

- Abre transação, injeta `request.jwt.claim.sub` e `app.org_id` com `set_config(..., true)` e garante `commit/rollback/release`. Código canônico em [banco](02-banco-de-dados.md#withtenanttx) (não duplicar aqui); `withWorkerTx(db, orgId, fn)` é a versão do worker (recebe o pool injetado; `orgId` pode ser `null`). Leitura pura: passe `{ readOnly: true }` (vira `begin read only`).
- Repositórios recebem o `client` da transação; `pool.query` direto só em `/ready`.
- Transação curta: nada de `fetch`, e-mail, Storage ou PDF pesado dentro dela. Padrão que funciona: a chamada ao provedor de pagamento fica **fora** da transação que trava a linha com `for update` — nunca segure lock esperando rede.
- Concorrência: `select ... for update` na linha "pai" (ex.: o registro disputado) ou `pg_advisory_xact_lock(hashtextextended($1, 0))` para chaves lógicas.
- Pool: `max` pequeno (10) por réplica, conexão pelo pooler do Supabase em modo transação `[verificar porta/modo no doc 09]`. `set_config(..., true)` é local à transação, por isso é compatível com pooler em modo transação.

## Paginação, filtros, ordenação

- Query padrão validada por Zod em `@app/shared`:

```ts
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
```

- Real em `packages/shared/src/common.ts` (`DEFAULT_PAGE_SIZE = 50`, `MAX_PAGE_SIZE = 200`, `buildPaginationMeta`, `paginationOffset`, `paginatedSchema`). Filtro/ordenação por módulo: estenda com `.extend({ sort: z.enum([...]), order, q })` — allowlist, nunca coluna livre.
- Resposta: `{ data: T[], meta: { requestId, page, pageSize, total } }`.
- Ordenação sempre estável: `order by <coluna> <dir>, id <dir>`. Lição: listagem com teto fixo de 100 linhas acaba virando paginação com ordem estável `created_at, id` quando o volume cresce. Pagine desde o primeiro endpoint de lista.
- Exportação CSV percorre todas as páginas do filtro ativo (ou endpoint de export dedicado com streaming).

## Formato de erro

- Sucesso: `sendData(req, res, data, meta)` → `{ data, meta: { requestId, ... } }`. Erro: `{ error: { code, message, details? } }` + header `X-Request-Id`.
- `errorHandler` traduz: `DomainError → status/code` (classe e fábricas `badRequest`, `authRequired`, `authInvalid`, `forbidden`, `notFound`, `conflict` em `apps/api/src/http.ts`), `ZodError → 400 VALIDATION_ERROR` (com `details.issues` = `path` + `message`), JSON malformado → `400 INVALID_JSON`, corpo grande → `413 PAYLOAD_TOO_LARGE`, rate limit → `429 RATE_LIMITED`, resto → `500 INTERNAL_ERROR` logado com stack. Códigos sempre em `MAIÚSCULAS_COM_UNDERSCORE`. Uploads não usam multer (binário vai direto ao Storage, ver §Uploads).
- Rota inexistente → `404 NOT_FOUND`. Recurso de outro tenant → também 404.

## Idempotência

- Obrigatória em: criar cobrança, registrar pagamento manual, disparar envio em massa, qualquer POST que gere efeito externo.
- Header `Idempotency-Key` (UUID gerado pelo front por intenção de ação, reaproveitado em retry).
- Tabela `idempotency_keys(organization_id, actor_id, endpoint, key, request_hash, response_status, response_body, expires_at)`, PK em `(organization_id, actor_id, endpoint, key)`.
- Na mesma transação da escrita: se a chave existe com o mesmo `request_hash` → devolve a resposta salva; hash diferente → `409 IDEMPOTENCY_KEY_REUSED`; senão executa e grava.
- Escopo por **ator**, não só por endpoint. Chave escopada só por endpoint é prática fraca (só não é explorável se o hash cobrir o corpo todo).
- Para efeitos de domínio, prefira também unicidade natural no banco (`unique (fee_id, event_type)` + `on conflict do nothing`).

## Uploads

Decisão e governança: [12](12-storage-e-governanca.md) (ADR-009). Aqui, só a anatomia no código.

| Rota | Permissão | O que faz |
|---|---|---|
| `POST /api/v1/files` | `files:write` | valida MIME/tamanho/quota, grava `app.files` `pending`, devolve URL/token de upload assinado |
| `POST /api/v1/files/:id/complete` | uploader | confere objeto (tamanho, MIME, magic bytes) → `available` ou `quarantined` |
| `GET /api/v1/files/:id/url` | `files:read` | URL assinada de `STORAGE_SIGNED_URL_TTL_SECONDS` (60–300) + `audit_log` `file.download` |
| `DELETE /api/v1/files/:id` | `files:delete` | soft delete; recusado com `FILE_LEGAL_HOLD`/`FILE_RETENTION_ACTIVE` |

- Módulo `apps/api/src/modules/files/` (routes/service/repository, como os demais). O binário **não** passa pela API: o cliente envia direto ao Storage; sem `multer` para arquivo.
- `integrations/storage-client.ts`: interface `StorageClient` (`createSignedUploadUrl`, `headObject`, `createSignedDownloadUrl`, `removeObjects`, cada um recebendo `StorageAuth`) com implementação real e fake; injetada em `createApp` como o verificador de JWT, para testar sem rede. A real recebe o JWT da requisição (`Authorization: Bearer`) + `SUPABASE_PUBLISHABLE_KEY`; nunca secret key.
- Ordem: transação curta no banco (inclui `audit_log`) → commit → chamada ao Storage. Falha no Storage depois do commit deixa linha `pending` (reserva quota); o worker a apaga após 24 h. Varredura de objetos sem linha no banco não existe (exigiria listar o Storage): DECIDIR em produção.
- `jobs/files-retention.ts` (worker, `SUPABASE_SECRET_KEY`): purga por retenção/soft delete e reconciliação de órfãos, com advisory lock.
- Limite alinhado em três lugares: `FILE_MAX_BYTES`, `file_size_limit` do bucket e limite global do plano. Códigos de erro do módulo: `FILE_TYPE_NOT_ALLOWED`, `STORAGE_QUOTA_EXCEEDED`, `FILE_NOT_PENDING`, `UPLOAD_MISSING`, `FILE_NOT_AVAILABLE`, `FILE_LEGAL_HOLD`, `FILE_RETENTION_ACTIVE`, `STORAGE_UNAVAILABLE` (status em `modules/files/service.ts`).

## Geração de PDF

- Padrão: `pdfkit` gerando `Buffer` em memória (`bufferPages: true`), função pura `buildXPdf(dados) → Promise<Buffer>` em `lib/pdf/` ou no módulo, testável sem HTTP.
- Fontes padrão do pdfkit (Helvetica) só cobrem Latin-1: sanitize texto vindo do usuário (emoji e símbolos fora da faixa somem ou quebram) ou embuta uma fonte TTF com acentos e símbolos. Na prática, um `sanitizeForPdf` para nomes e descrições resolve.
- Controle de quebra de página manual (`ensure(height)` antes de cada bloco) para não cortar linhas de tabela.
- PDF caro ou em lote → job no worker, resultado salvo no Storage, link assinado para o usuário.
- Resposta direta: `Content-Type: application/pdf` + `Content-Disposition: attachment; filename="..."`.

## Webhooks

O fluxo (autenticar → deduplicar em `inbound_events` → enfileirar → responder 200 → processar reconsultando o provedor → reconciliação) é definido em [arquitetura](01-arquitetura.md#integrações-outbox-e-webhooks-idempotentes). Na implementação:

```ts
webhooksRouter.post("/:provider", asyncRoute(async (req, res) => {
  const adapter = getWebhookAdapter(req.params.provider);
  if (!adapter.verify(req.headers, req.body as Buffer)) throw new DomainError(401, "INVALID_WEBHOOK_SIGNATURE", "Webhook não autenticado.");
  const events = adapter.parse(JSON.parse((req.body as Buffer).toString("utf8")));
  await recordInboundEvents(adapter.name, events);
  res.json({ received: true });
}));
```

- `verify` compara assinatura com `timingSafeEqual` sobre o corpo bruto; o segredo é obrigatório em produção pelo `config.ts` (lição: webhook aceitava chamada sem segredo porque o default era vazio).
- `parse` valida com Zod e extrai só ids; valor e status do corpo são ignorados (é o que impede confirmação forjada).
- Handshake de verificação de posse da URL (alguns provedores fazem um GET/POST de desafio antes de ativar) fica no adapter, nunca em `if` espalhado na rota.
- Integrações moram em `integrations/<x>/adapter.ts` (interface + real + fake). Previstas: [domínio](11-dominio.md).

## Jobs, outbox e worker

Modelo de dados, estados (`pending/processing/sent/retry/failed/unknown`), claim com `for update skip locked` e agendamento por advisory lock: [arquitetura](01-arquitetura.md#integrações-outbox-e-webhooks-idempotentes) e [banco](02-banco-de-dados.md#concorrência). Regras de implementação:

- Produtor grava no outbox **na mesma transação** da mudança de negócio (`withTenantTx`); o worker usa `withWorkerTx(db, orgId, fn)` e papel `app_worker` (código em `apps/api/src/jobs/outbox.ts`).
- Chamada ao adapter fora da transação de claim; resultado gravado em transação nova.
- Erro classificado no adapter: `permanent` (dado inválido, destinatário recusado) → `failed`; `transient` (timeout antes de enviar, 5xx) → `retry` com backoff; ambíguo (timeout depois de enviar) → `unknown`.
- Kill switch por env (`<INTEGRACAO>_ENABLED=false`) para parar envios sem deploy de código.
- Teste do worker chama a função `processBatch()` direto, com adapter fake; nunca sobe o loop.
- Lição: mensageria precisa de pacing, limite por hora e aquecimento para não ter número bloqueado — qualquer integração de envio em massa nasce com limite configurável.

## Health e ready

- `GET /health`: liveness, sem I/O, sempre `200 { status: "ok", service: "{{SLUG}}-api" }` (o `service` identifica qual API respondeu). É o health check do Easypanel.
- `GET /ready`: `select 1` com timeout curto; `503` se o banco não responde.
- Relatório detalhado (filas, backlog) só em rota protegida por token, nunca público.

## Config por env

- `config.ts` valida `process.env` com Zod no boot; erro → processo não sobe (falha rápida).
- Defaults só para `development`/`test`; em `production`, segredos obrigatórios via `superRefine`. Padrão recorrente: defaults "de dev" (chave de criptografia, URL de fila, segredo de webhook) passam silenciosamente em produção.
- **Nunca** default com host, domínio ou credencial real no código (host de storage como default vaza infra e mascara env faltando).
- Variáveis do contrato: `NODE_ENV`, `API_PORT`, `WEB_ORIGIN`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWKS_URL` (opcional; default `SUPABASE_URL/auth/v1/.well-known/jwks.json`), `LOG_LEVEL`; arquivos: `SUPABASE_PUBLISHABLE_KEY`, `STORAGE_BUCKET` (default `private-files`), `STORAGE_SIGNED_URL_TTL_SECONDS` (default 120), `FILE_MAX_BYTES`, `FILE_ALLOWED_MIME`; worker: `WORKER_POLL_INTERVAL_MS`, `WORKER_BATCH_SIZE`, `SUPABASE_SECRET_KEY` (só no worker); testes: `TEST_DATABASE_URL`, `TEST_ALLOWED_DB_REFS`, `TEST_ADMIN_DATABASE_URL` ([testes](07-testes.md#nunca-tocar-dados-reais)). Nomes finais em `.env.example`; conferir com `pnpm check-env`.
- Dev local: `pnpm --filter @app/api dev` (`tsx watch --env-file-if-exists=../../.env src/index.ts`) e `dev:worker` para o worker. Se o watch travar ou acumular processos (`EADDRINUSE`), mate a porta e rode sem watch (ver [lições](08-licoes-aprendidas.md#processo-com-ia)).
- Timeout explícito em toda chamada HTTP externa (`AbortSignal.timeout(25_000)`). Lição: sem timeout, o proxy derrubou a conexão e o navegador mostrou um erro de CORS enganoso.

## Checklist de rota nova

- [ ] Schema Zod de entrada/saída em `@app/shared`.
- [ ] `requirePermission`/`requireRole` com papéis explícitos; matriz `PERMISSIONS` atualizada no shared.
- [ ] Acesso via `withTenantTx`; SQL com `organization_id`.
- [ ] `Idempotency-Key` se gera efeito externo ou dinheiro.
- [ ] Nenhuma rede dentro da transação; timeout em chamadas externas.
- [ ] Lista paginada com ordem estável.
- [ ] Testes: feliz, validação, papel errado (403), outro tenant (404), repetição idempotente.
