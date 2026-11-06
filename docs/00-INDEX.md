# Índice do kit — o que ler para cada tarefa

> **Quando ler:** no início de toda tarefa, para escolher os 1–3 docs que realmente importam e não carregar o resto.
> **Resumo:**
> - Nunca leia `docs/` inteiro. Use a tabela "tarefa → docs" abaixo e pare nela.
> - Cada assunto tem UM doc dono; os outros só linkam. Se dois docs parecerem dizer coisas diferentes, vale o dono.
> - Decisões em aberto aparecem como `DECIDIR:` nos docs; fatos não confirmados como `[verificar]`.
> - O domínio do produto vive em [11](11-dominio.md) (template preenchido pelo projeto); se estiver vazio, pergunte antes de supor. Exemplo preenchido: [exemplos/dominio-condominios](exemplos/dominio-condominios.md).
> **Relacionados:** [README](../README.md), [CLAUDE.md](../CLAUDE.md), [workflow Claude](10-workflow-claude.md)

## Mapa do kit

| Doc | Assunto (dono único) | Tamanho típico |
|---|---|---|
| [01-arquitetura](01-arquitetura.md) | Componentes, monorepo, fluxo de requisição, módulos, filas/outbox, jobs, observabilidade, ADRs | médio |
| [02-banco-de-dados](02-banco-de-dados.md) | Schema base multi-tenant, RLS, papéis `app_api`/`app_worker`, `withTenantTx`, migrations, concorrência, backups, LGPD no schema | longo |
| [03-seguranca](03-seguranca.md) | Ameaças, OWASP, authN/authZ, isolamento entre tenants, uploads, headers, segredos, webhooks, LGPD, checklist de produção | longo |
| [04-boas-praticas](04-boas-praticas.md) | Estilo de código, TypeScript, nomes, erros, comentários | médio |
| [05-backend-api](05-backend-api.md) | Padrões Express: rotas, handlers, Zod, envelope de erro, paginação | médio |
| [06-frontend](06-frontend.md) | Vite/React, TanStack Query, formulários, CSS/tokens, mobile 320–414px | médio |
| [07-testes](07-testes.md) | Vitest/supertest, tenant de teste, o que testar, como rodar barato | médio |
| [08-licoes-aprendidas](08-licoes-aprendidas.md) | Padrões recorrentes de falha em produção (Sintoma → Causa → Regra) | médio |
| [09-deploy-easypanel-supabase](09-deploy-easypanel-supabase.md) | Projetos Supabase dev/prod, Easypanel, CI/CD, secrets, rollback | longo |
| [10-workflow-claude](10-workflow-claude.md) | Opus especifica / Sonnet constrói, subagentes, higiene de contexto | médio |
| [11-dominio](11-dominio.md) | Domínio do produto: entidades, papéis x permissões, regras, integrações, LGPD, MVP (template) | médio |
| [12-storage-e-governanca](12-storage-e-governanca.md) | Arquivos: `app.files`, bucket `private-files`, policies de `storage.objects`, fluxo upload/download, retenção, legal hold, LGPD, quota, antivírus, backup de objetos | longo |
| [13-design-system](13-design-system.md) | **Regra dura** de interface: tokens, fontes, componentes, shells e navegação do mock Condomínio 360 / ZELLO; exceções fechadas | longo |
| [exemplos/](exemplos/dominio-condominios.md) | Exemplo de 11 preenchido (SaaS de condomínios); só como referência de formato | médio |
| [templates/](templates/) | `prd-template.md`, `spec-template.md`, `agent-prompt-template.md`, `adr-template.md`, `pr-checklist.md`, `migration-template.sql` | curto |

## Para a tarefa X, leia só Y

| Tarefa | Leia | Não precisa ler |
|---|---|---|
| Entender o projeto no primeiro contato | [README](../README.md), este índice, [01](01-arquitetura.md) (só "Visão de componentes" e "Fluxo") | 02–11 |
| Escrever PRD/spec de feature | [10](10-workflow-claude.md), [11](11-dominio.md), `templates/prd-template.md` ou `spec-template.md` | 06, 09 |
| Criar módulo novo (tabela + API + tela) | [01](01-arquitetura.md) §"Adicionar um módulo", [02](02-banco-de-dados.md) §"RLS: deny-by-default" (traz o exemplo de tabela de negócio), [05](05-backend-api.md) | 09, 08 |
| Criar/alterar tabela, índice ou migration | [02](02-banco-de-dados.md), `templates/migration-template.sql` | 06 |
| Escrever policy RLS ou mexer em papéis/grants | [02](02-banco-de-dados.md) §"RLS: deny-by-default" e §"Funções helper", [03](03-seguranca.md) §"Testar isolamento entre tenants" | 06, 09 |
| Endpoint novo na API | [05](05-backend-api.md), [03](03-seguranca.md) §"Autorização" | 06, 09 |
| Tela/componente no front | [13](13-design-system.md) (obrigatório) e [06](06-frontend.md); rota equivalente em `docs/referencias/condominio-360/src/routes/` | 02, 09 |
| Ordem das próximas specs | [specs/README](specs/README.md) | — |
| Integração externa (pagamento, WhatsApp, e-mail) | [01](01-arquitetura.md) §"Integrações, outbox e webhooks", [03](03-seguranca.md) §"Webhooks" | 06 |
| Job agendado ou worker | [01](01-arquitetura.md) §"Jobs agendados", [02](02-banco-de-dados.md) §"Concorrência" | 06 |
| Upload/arquivo/Storage, retenção ou eliminação de arquivo | [12](12-storage-e-governanca.md); rotas no código: [05](05-backend-api.md) §"Uploads" | 06, 08 |
| Dados pessoais (CPF, telefone, dado financeiro) | [03](03-seguranca.md) §"LGPD", [02](02-banco-de-dados.md) §"LGPD no schema" | 06 |
| Escrever/rodar testes | [07](07-testes.md) (trava `TEST_DATABASE_URL` + `TEST_ALLOWED_DB_REFS`; `*.int.test.ts` fora do `pnpm test`); isolamento: [03](03-seguranca.md) §"Testar isolamento entre tenants" | 09 |
| Deploy, CI, variáveis de ambiente | [09](09-deploy-easypanel-supabase.md) (dev: automático após CI verde na `main`; prod: Actions → Deploy → Run workflow com `confirm=prod`, §4.3) | 04, 06 |
| Revisão de PR / auditoria | `templates/pr-checklist.md`, [03](03-seguranca.md) §"Checklist de revisão antes de produção" | — |
| Incidente em produção | [09](09-deploy-easypanel-supabase.md) (rollback), [01](01-arquitetura.md) §"Observabilidade", [03](03-seguranca.md) §"Incidentes e backups" | 04, 06 |
| Delegar trabalho a subagente | [10](10-workflow-claude.md), `templates/agent-prompt-template.md` | — |

Regra: se a tarefa não está na tabela, leia este índice, escolha no máximo 2 docs e diga na resposta quais escolheu.

## Ordem de leitura no primeiro dia (humano)

1. [README](../README.md): o que é o kit e como subir o ambiente.
2. [CLAUDE.md](../CLAUDE.md): as regras que o Claude segue em toda sessão.
3. [10-workflow-claude](10-workflow-claude.md): como pedir trabalho (spec → confirmação → implementação → revisão).
4. [01-arquitetura](01-arquitetura.md): o desenho geral e as ADRs.
5. [02-banco-de-dados](02-banco-de-dados.md) §"Modelo base" e §"RLS": o coração do multi-tenant.
6. [03-seguranca](03-seguranca.md) §"Modelo de ameaças" e §"Checklist de revisão antes de produção".
7. [09-deploy-easypanel-supabase](09-deploy-easypanel-supabase.md): criar projetos dev/prod antes de escrever a primeira feature.
8. [08-licoes-aprendidas](08-licoes-aprendidas.md): 15 minutos que evitam os erros mais comuns em produção.
9. [11-dominio](11-dominio.md): preencher antes do primeiro PRD.

Os demais (04, 05, 06, 07) se leem quando a tarefa pedir.

## Como as peças se conectam

```
CLAUDE.md (sempre carregado, curto)
   │  regras + ponteiro para este índice
   ▼
docs/00-INDEX.md ──► escolhe 1–3 docs por tarefa
   │
   ├─ docs/01..12 (carregam sob demanda)
   ├─ docs/templates/* (PRD, spec, prompt de agente, ADR, migration, PR)
   │
.claude/agents/*.md ──► subagentes com `model:` fixo (Opus especifica/revisa, Sonnet constrói)
.claude/skills/*/SKILL.md ──► roteiros invocáveis (ex.: fluxo spec → delegação)
.claude/settings.json ──► permissões (ex.: bloqueia leitura de .env)
```

- Spec nova nasce de `templates/spec-template.md`, cita arquivo:linha real e linka os docs que a regem.
- O prompt do subagente (`templates/agent-prompt-template.md`) deve listar só os docs desta tabela para a tarefa dele, nunca "leia docs/".
- Decisão de arquitetura nova vira ADR curta (`templates/adr-template.md`) e entra em [01](01-arquitetura.md) §"Decisões".
- Lição nova (bug em produção, retrabalho caro) entra em [08](08-licoes-aprendidas.md) e a regra derivada no doc dono do assunto.

## Glossário curto

| Termo | Significado aqui |
|---|---|
| Tenant / organização | `organizations`: cliente do SaaS (a empresa que assina). Fronteira de isolamento de dados. |
| Workspace | `workspaces`: subdivisão opcional de uma organização (filial, unidade, projeto...). Escopo opcional de um membership. O significado no seu produto fica em [11](11-dominio.md). |
| Membership | Vínculo usuário ↔ organização (↔ workspace) com um papel. Fonte única de autorização; lido a cada requisição. |
| Papéis | `owner`, `admin`, `manager` (gestor de workspace), `staff`, `member` (base genérica; renomeie/ajuste em [11](11-dominio.md)). Coluna `text` + CHECK (não enum); helpers SQL `app.current_user_id()`, `app.current_org_id()`, `app.has_org_role(roles)`, `app.workspace_ids(roles)`. |
| RLS | Row Level Security do Postgres. Aqui é defesa em profundidade: a API já filtra, a policy garante. |
| `app_api` / `app_worker` | Papéis de banco sem `BYPASSRLS` usados pela API e pelo worker. |
| `withTenantTx` / `withWorkerTx` | `withTenantTx(req, fn)` abre transação e injeta usuário/organização para as policies; `withWorkerTx(db, orgId, fn)` é a versão do worker (pool injetado, sem usuário). Ver [02](02-banco-de-dados.md) §"`withTenantTx`". |
| Pooler | Supavisor do Supabase em modo transação (porta 6543). |
| Outbox | Tabela onde a transação de negócio grava "algo precisa ser enviado"; o worker entrega depois. |
| Idempotência | Repetir a mesma requisição/evento não muda o resultado (UNIQUE + `ON CONFLICT`). |
| IDOR | Acesso a objeto de outro usuário/tenant trocando um id. Risco nº 1 de SaaS multi-tenant. |
| `service_role` / secret key | Chave do Supabase que ignora RLS. Nunca no front, nunca na API de requisição. |
| `DECIDIR:` | Decisão de produto/negócio em aberto, com opções e recomendação. |
| `[verificar]` | Fato externo não confirmado na data de escrita; confirmar antes de depender dele. |
| Nome/slug do produto | Preenchidos por `scripts/init-project.mjs` (ver [README](../README.md) §"Primeiros 60 minutos"). |
