# Testes

> **Quando ler:** ao escrever ou rodar testes, criar fixture/tenant de teste, testar migration ou validar um deploy.
> **Resumo:**
> - Testes rápidos (`*.test.ts`) usam banco fake + JWKS local; integração (`*.int.test.ts`) roda contra o **projeto Supabase `dev`** via `TEST_DATABASE_URL`, travada por allowlist de refs. Nunca `prod`.
> - Cada teste cria o próprio tenant (organization + usuários) e o apaga ao final; nada de dado compartilhado.
> - Obrigatórios: isolamento entre tenants, autorização por papel, RLS, idempotência, concorrência, regras de dinheiro.
> - Rode só o arquivo afetado, **sempre em background com saída em arquivo**, e leia só o resumo.
> - `test` = suíte rápida; `test:full` = tudo, só antes de mudança grande ou quando pedido.
>
> **Relacionados:** [banco](02-banco-de-dados.md), [segurança](03-seguranca.md), [boas práticas](04-boas-praticas.md), [backend](05-backend-api.md), [deploy](09-deploy-easypanel-supabase.md), [workflow Claude](10-workflow-claude.md), [lições](08-licoes-aprendidas.md)

## Pirâmide para este stack

| Camada | Ferramenta | O que cobre | Proporção |
|---|---|---|---|
| Unitário | vitest | funções puras de `@app/shared` (dinheiro, datas, competência, máscaras), cálculo de serviço sem I/O, builders de PDF | maioria |
| Integração API | vitest + supertest + Postgres `dev` | rota → middleware → serviço → SQL → RLS; papel e tenant | núcleo de valor |
| Banco | SQL contra `dev` | policies RLS, grants de `app_api`/`app_worker`, constraints | poucos, críticos |
| E2E | Playwright (opcional) | 2–5 jornadas críticas no navegador | mínimo |
| Smoke | script/curl | pós-deploy | 1 por ambiente |

- Front: testar hooks/funções com lógica (vitest + jsdom) quando houver lógica real; não testar markup estático.

## Configuração do vitest

```ts
export default defineConfig({
  test: {
    reporters: ["dot"],
    silent: "passed-only",
    testTimeout: 30_000,
    hookTimeout: 120_000,
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
  },
});
```

- `dot` + `silent: "passed-only"`: só testes que falham imprimem logs (economiza contexto do agente). Confirmar que a opção existe na versão instalada do vitest `[verificar]`.
- Timeouts altos porque o banco é remoto: latência de rede costuma passar do timeout padrão de 5s, e um `afterAll` que morre no meio deixa dado de teste para trás.
- `fileParallelism: false` até os testes provarem isolamento total; depois pode ligar.

## Nunca tocar dados reais

- Variáveis de teste (nomes em `.env.example`, valores só no `.env` local/secret do CI):
  - `TEST_DATABASE_URL`: conexão do projeto **dev** usada pelos testes de integração (papel `app_api`). Nunca a `DATABASE_URL` da aplicação.
  - `TEST_ALLOWED_DB_REFS`: refs de projeto dev permitidos, separados por vírgula.
  - `TEST_ADMIN_DATABASE_URL`: conexão de fixture (cria/apaga tenants `test_%`), nunca usada pelo código da aplicação.
- Trava obrigatória (`apps/api/src/test/guard.ts`, chamada em `src/test/setup.ts` antes de qualquer conexão): `assertTestEnvironment(env)` lança `UnsafeTestEnvironmentError` se `NODE_ENV=production`; se `TEST_DATABASE_URL` estiver definida e `TEST_ALLOWED_DB_REFS` vazia; se o project ref da URL não estiver na allowlist; ou se `TEST_DATABASE_URL === DATABASE_URL`. Sem `TEST_DATABASE_URL`, só rodam os testes sem banco. Coberta por `src/test/guard.test.ts`.
  - Ordem no `setup.ts`: a trava roda **antes** de o setup forçar `NODE_ENV=test`, para que um `NODE_ENV=production` herdado do shell seja barrado.
  - Comparação exata, não por substring: o guard extrai o project ref do usuário do pooler (`<papel>.<ref>`, ex.: `postgres.<ref>`) ou do host direto (`db.<ref>.supabase.co`) e compara por igualdade com cada item da allowlist. Um ref que só "aparece" em outro trecho da URL não passa.
  - Host fora desses formatos (ex.: `localhost`) só passa se o próprio hostname estiver em `TEST_ALLOWED_DB_REFS`.
- Por que allowlist e não marcador no banco: não exige tabela extra nem seed especial em dev, e falha **antes** de abrir conexão. Nunca adicione o ref de prod à allowlist.
- Nunca modificar linha de configuração global (singleton) em teste. Padrão de incidente recorrente: um teste sobrescreve a configuração global de mensageria com uma URL fake, a execução é interrompida antes do `afterAll` e **toda entrega real fica quebrada** até alguém notar (ver [lições](08-licoes-aprendidas.md#banco-e-testes)). Configuração global em teste → override em memória (injeção) ou transação que nunca comita.
- Integrações externas (pagamento, WhatsApp, e-mail) sempre com cliente **fake** injetado em teste; nunca chamar o provedor real.

## Factories e tenant de teste

```ts
export async function createTestTenant() {
  const orgId = randomUUID();
  await admin.query("insert into app.organizations (id, name) values ($1, $2)", [orgId, `test_${orgId}`]);
  const users = {
    owner: await createTestUser(orgId, "owner"),
    manager: await createTestUser(orgId, "manager"),
    member: await createTestUser(orgId, "member"),
  };
  return { orgId, users, cleanup: () => admin.query("delete from app.organizations where id = $1", [orgId]) };
}
```

- Um tenant por arquivo (`beforeAll`) ou por teste quando houver mutação que afete outros casos. Para isolamento, crie **dois** tenants e teste um contra o outro.
- Limpeza por `on delete cascade` a partir de `organizations` (uma linha apaga tudo). Se alguma tabela não cascatear, o teste de limpeza falha (ver abaixo).
- Prefixo `test_` em nomes + varredura: `setup.ts` apaga tenants `test_%` com mais de 1h (sobras de execução interrompida).
- Alternativa mais segura quando não precisa de commit: rodar o teste inteiro dentro de uma transação e dar `rollback` no fim (bom para rotas de leitura).
- JWT em teste (decidido no scaffold): `createApp` recebe o `verifier` injetado; `src/test/helpers.ts` (`buildTestApp`) gera par ES256 com `jose` (`generateKeyPair` + `createLocalJWKSet`) e assina tokens locais, sem depender do Auth. Para integração que precise de `auth.users` real (FK de `memberships`), crie o usuário no Auth do `dev` via API admin no setup, com a conexão de fixture (`TEST_ADMIN_DATABASE_URL`).
- Banco fake: `createFakeDb` em `helpers.ts` para testes de rota/outbox sem Postgres (é o que `pnpm test` roda hoje).

## O que testar obrigatoriamente

| Tema | Caso mínimo |
|---|---|
| Isolamento entre tenants | usuário do tenant A lendo/alterando/listando recurso do B → 404 e lista sem itens do B |
| Autorização por papel | cada rota de escrita com papel insuficiente → 403; `member` só vê o que é dele (escopo definido no [domínio](11-dominio.md)) |
| RLS | conectado como `app_api` com `request.jwt.claim.sub` do usuário A, `select` direto na tabela não retorna linhas do B; sem `set_config` não retorna nada |
| Idempotência | mesmo `Idempotency-Key` + mesmo corpo → mesma resposta, um registro; corpo diferente → 409 |
| Concorrência | `Promise.all` de N requisições iguais → exatamente 1 efeito (ex.: reenvio de mensagem) |
| Dinheiro | arredondamento, teto/piso de taxa, soma de partes = total, nunca float |
| Datas | prazo perto da meia-noite em `America/Sao_Paulo`, virada de mês |
| Webhook | sem assinatura → 401; evento repetido → processado uma vez; valor do corpo ignorado |
| Validação | corpo inválido → 400 `VALIDATION_ERROR` com campo |
| Limpeza | após `cleanup()`, nenhuma linha com o `orgId` em nenhuma tabela de negócio |

Exemplo de isolamento:

```ts
it("não lê workspace de outro tenant", async () => {
  const ws = await createWorkspace(tenantB);
  await request(app)
    .get(`/api/v1/workspaces/${ws.id}`)
    .set("Authorization", `Bearer ${tenantA.users.owner.token}`)
    .set("X-Organization-Id", tenantA.orgId)
    .expect(404);
});
```

## Suíte rápida vs completa

- `pnpm test` (rápida): em `apps/api`, `vitest run --exclude '**/*.int.test.ts'`. Convenção: todo teste que abre conexão com o banco `dev` se chama `*.int.test.ts`. Roda antes de todo PR e no CI (o CI não tem `TEST_DATABASE_URL`).
- `pnpm test:full`: tudo, inclusive `*.int.test.ts` (exige `TEST_DATABASE_URL` + `TEST_ALLOWED_DB_REFS`). Só quando pedido, antes de mudança grande em área lenta, ou nightly.
- Por quê: suíte completa contra banco remoto chega fácil a vários minutos com saída enorme; separar `test`/`test:full` e usar reporter `dot` é o que torna viável o agente rodar testes sem estourar contexto.

## Como rodar (comandos prontos)

Arquivo afetado, em background, saída em arquivo:

```bash
pnpm --filter @app/api exec vitest run src/test/api.test.ts > /tmp/test-api.log 2>&1
grep -E "Test Files|Tests|FAIL" /tmp/test-api.log
```

Suíte rápida:

```bash
pnpm test > /tmp/test-fast.log 2>&1
grep -E "Test Files|Tests|FAIL" /tmp/test-fast.log
```

- No Claude Code: Bash com `run_in_background: true` e esperar a notificação; nunca polling em loop.
- Se houver `FAIL`, leia só o trecho da falha: `grep -n -A 30 "FAIL" /tmp/test-api.log | head -80`. Nunca o log inteiro.
- Um teste por vez quando depurando: `vitest run arquivo.test.ts -t "nome do teste"`.
- Teste longo é trabalho de subagente (ver [workflow](10-workflow-claude.md)).

## Teste de migrations

- Toda migration nova é aplicada primeiro no `dev` (CI, `supabase db push`) e a suíte rápida roda depois dela.
- Forward-only: teste que o **código atual** continua funcionando com o schema novo (deploy da API pode acontecer depois da migration). Mudança destrutiva em duas etapas: adicionar → migrar código → remover em migration posterior.
- Migration com dado (backfill) tem teste ou consulta de verificação na própria spec, e **nunca** toca registro de produção específico por id sem pedido explícito.
- `DECIDIR:` validar migrations também num Supabase local (CLI + Docker, `supabase db reset`) antes do `dev`. Recomendação: opcional; o `dev` remoto é a fonte de verdade e o CI é quem aplica.
- Teste de RLS em duas camadas:
  - Estático, no `pnpm test`: `apps/api/src/test/migrations.test.ts` lê `supabase/migrations/*.sql` e exige `enable row level security` para cada tabela de `app`.
  - Catálogo, contra o banco já migrado: `supabase/tests/catalog.sql` deve retornar **zero linhas** (tabela de `app` sem RLS ou sem policy). Rode após `db push` no dev (`psql "$TEST_ADMIN_DATABASE_URL" -f supabase/tests/catalog.sql`). `DECIDIR:` incluir esse passo no `deploy.yml` após as migrations de dev (recomendado; hoje não está no workflow).

## Smoke pós-deploy

Executado pelo pipeline (ver [deploy](09-deploy-easypanel-supabase.md)) e à mão quando necessário:

```bash
curl -fsS "$API_URL/health"
curl -fsS "$API_URL/ready"
curl -fsS -o /dev/null -w "%{http_code}\n" "$WEB_URL/"
curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/api/v1/me"
```

- Esperado: `health` 200, `ready` 200, web 200, `/me` sem token 401.
- Smoke **não cria dado** em produção. Se precisar de fluxo completo, use um tenant de smoke dedicado em `dev`.

## E2E (opcional)

- Vale quando: houver fluxo crítico de várias telas (login → criação → pagamento) ou regressões repetidas de UI.
- Playwright (`@playwright/test`), contra `dev`, com tenant criado por API no `beforeAll`; projetos de viewport 375px e 1280px para cobrir a [regra mobile](06-frontend.md#regra-mobile-obrigatória).
- Não roda em todo PR no começo; nightly ou manual.

## Checklist

- [ ] Banco do teste é `dev` (`TEST_ALLOWED_DB_REFS` só com refs de dev; trava do `guard.ts` ativa).
- [ ] Tenant próprio criado e apagado; nenhum singleton global alterado.
- [ ] Casos negativos: outro tenant (404) e papel errado (403).
- [ ] Idempotência/concorrência onde há escrita sensível.
- [ ] Integrações externas com fake.
- [ ] Teste que usa banco real nomeado `*.int.test.ts`.
- [ ] Rodei só o arquivo afetado, em background, e li só o resumo.
