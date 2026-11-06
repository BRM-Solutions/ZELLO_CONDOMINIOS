# Boas práticas de engenharia

> **Quando ler:** antes de escrever ou revisar qualquer código, commit ou PR; ao decidir adicionar uma dependência.
> **Resumo:**
> - TypeScript strict, ESM, sem `any` implícito; Zod é a única fonte de validação e mora em `@app/shared`.
> - Dinheiro em centavos inteiros (`*_cents`), datas em UTC no banco e `America/Sao_Paulo` só na exibição.
> - Erros sempre como `DomainError(status, code, message)`; logs com pino, sem PII.
> - Código e identificadores em inglês; textos de UI, mensagens de erro ao usuário e docs em pt-BR.
> - Commits convencionais pequenos, PR pequeno, Definição de Pronto cumprida antes de pedir revisão.
>
> **Relacionados:** [arquitetura](01-arquitetura.md), [segurança](03-seguranca.md), [backend](05-backend-api.md), [frontend](06-frontend.md), [testes](07-testes.md), [lições](08-licoes-aprendidas.md), [workflow Claude](10-workflow-claude.md)

## TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes` opcional (config em `tsconfig.base.json`, dono: scaffold).
- ESM em todo lugar: imports relativos com extensão `.js` na API (`import { pool } from "./db.js"`).
- Proibido `any` sem justificativa; use `unknown` + narrowing. `as` só em fronteira já validada por Zod.
- Tipos de domínio derivam dos schemas: `type WorkspaceInput = z.infer<typeof workspaceInputSchema>`. Nunca declarar o mesmo tipo à mão em dois lugares.
- `type-check` limpo é pré-requisito de PR (o CI barra).

## Nomes

| Coisa | Convenção | Exemplo |
|---|---|---|
| Arquivos TS | kebab-case; no módulo, nome da peça | `modules/projects/routes.ts`, `require-role.ts`, `webhook-adapter.ts` |
| Componentes React | PascalCase | `UnitTable.tsx` |
| Hooks | `useX` | `useUnits.ts` |
| Tabelas/colunas SQL | snake_case plural | `projects.organization_id` |
| Valores monetários | sufixo `_cents` / `Cents` | `fee_amount_cents`, `amountCents` |
| Datas | sufixo `_at` (timestamptz) / `_on` (date) | `paid_at`, `due_on` |
| Códigos de erro | SCREAMING_SNAKE | `UNIT_NOT_FOUND` |
| Env vars | SCREAMING_SNAKE | `WEB_ORIGIN` |

- Nomes de domínio em inglês no código (`project`, `member`, `fee`), com glossário pt-BR em [domínio](11-dominio.md).

## Estrutura de pastas

- API por **módulo de domínio**, não por camada global (detalhe em [backend](05-backend-api.md)):
  `apps/api/src/modules/<modulo>/{routes,service,repository}.ts` (o router é exportado por `routes.ts` como `<modulo>Router()`; `service.ts` só quando houver regra) + `<modulo>.test.ts` ao lado (ou `<modulo>.int.test.ts` se usar banco real; ver [testes](07-testes.md#suíte-rápida-vs-completa)). O scaffold hoje concentra os testes em `src/test/`.
- Infra transversal na raiz de `apps/api/src/` (`config.ts`, `http.ts`, `db.ts`), `auth/`, `integrations/<x>/`, `jobs/`; árvore canônica em [arquitetura](01-arquitetura.md#monorepo-e-fronteiras).
- Web: `pages/`, `components/`, `hooks/`, `contexts/`, `lib/` (detalhe em [frontend](06-frontend.md)).
- `packages/shared/src/`: um arquivo por assunto (`common.ts`, `tenancy.ts`, `permissions.ts`, `money.ts`, `documents.ts`) reexportado por `index.ts`; só funções puras, sem I/O, sem dependência de Node ou DOM. Sem etapa de build: api e web importam `src/index.ts` direto (`main`/`types` do pacote) e o `tsup` da API embute o shared (`noExternal`).
- Limite prático: arquivo passou de ~400 linhas, quebre. Motivo: tela de admin ou camada de banco com 1.000+ linhas obriga todo agente a ler o arquivo inteiro para qualquer mudança (ver [lições](08-licoes-aprendidas.md#processo-com-ia)).

## Erros

- Uma classe base, códigos estáveis (o front decide comportamento pelo `code`, nunca pela `message`):

```ts
export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) { super(message); }
}
export const notFound = (what: string) => new DomainError(404, `${what}_NOT_FOUND`, "Registro não encontrado.");
```

- Status: 400 validação, 401 sem/inválido token, 403 sem permissão, 404 não existe **ou não é do seu tenant** (não vazar existência), 409 conflito/idempotência, 422 regra de negócio, 429 rate limit, 500 inesperado.
- `message` em pt-BR, pronta para mostrar ao usuário; nunca stack, SQL ou dado de outro tenant.
- Erro desconhecido vira `500 INTERNAL_ERROR` genérico na resposta e é logado com stack no servidor.
- Formato de resposta é contrato do kit: `{ error: { code, message, details? } }` (ver [backend](05-backend-api.md#formato-de-erro)).

## Logging

- `pino` + `pino-http`; um `requestId` por requisição propagado no header `X-Request-Id` e em todo log.
- **Nunca logar PII**: CPF, telefone, e-mail, nome de pessoa, token, corpo de webhook bruto. Use `redact` do pino:

```ts
pinoHttp({ redact: ["req.headers.authorization", "req.body.cpf", "req.body.phone", "req.body.email", "*.password"] })
```

- Níveis: `error` (ação humana necessária), `warn` (degradação recuperável), `info` (eventos de negócio: "fee.paid", com ids, sem PII), `debug` (só dev).
- Em vez de `console.log`, sempre o logger. Padrão recorrente: jobs em `setInterval` logando com `console.error`, sem `requestId` nem contexto, deixam falhas invisíveis até um alerta externo.
- Auditoria de negócio (quem mudou o quê) vai para a tabela `audit_log`, não para log de aplicação (ver [banco](02-banco-de-dados.md)).

## Validação

- Zod em **toda borda**: body, query, params, env, payload de webhook, resposta de API externa, mensagem de fila.
- Schemas de entrada/saída ficam em `@app/shared` e são importados pela API (validar) e pelo web (formulário). Nunca duplicar regra de validação no front "na mão".
- Preço, total, saldo, multa: **sempre recalculados no servidor**; o cliente só envia intenção (ids e quantidades).
- Strings: `.trim()`, limite de tamanho (`.max()`) em todo campo livre; URLs com `z.string().url()` + allowlist de esquema `https:` (achado comum de auditoria: schema de URL aceitando `javascript:`/`data:` e um campo de URL que o servidor buscava sem restrição de host — SSRF; ver [segurança](03-seguranca.md)).

## Datas e fuso

- Banco: `timestamptz` sempre; o servidor e o Postgres operam em UTC. Datas de calendário sem hora (vencimento de boleto) usam `date`.
- Exibição e regra de negócio "por dia" (vencimento, competência do mês): `America/Sao_Paulo` explícito.

```ts
new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(date);
```

- Nunca `new Date("2026-11-05")` para data de calendário (vira meia-noite UTC = dia anterior em SP). Trate `date` como string `YYYY-MM-DD` até a borda.
- API retorna ISO 8601 com `Z`. Função de "competência" (mês de referência) fica em `@app/shared/utils` com teste.

## Dinheiro

- Inteiro em centavos (`integer`/`bigint` no banco, `number` inteiro em TS). **Nunca float**, nunca `numeric` convertido para `number` com casas.
- Percentuais em basis points (`fee_basis_points`, 198 = 1,98%). Arredondamento explícito e num lugar só (`Math.round` sobre o inteiro), com teste para teto/piso.
- Formatação só na borda: `formatBrl(cents)` em `@app/shared` (`Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`).
- Entrada digitada em pt-BR ("1.234,56") convertida por função única `parseBrlToCents` com teste.
- Lição: valores de taxa calculados e gravados no momento da criação do registro evitaram recalcular histórico quando a tarifa mudou (ver [lições](08-licoes-aprendidas.md#pagamentos-e-webhooks)).

## Idioma

- Código, nomes, commits e comentários: inglês. UI, mensagens de erro, docs, specs: pt-BR.
- Textos de UI centralizados por tela (constantes), não espalhados em lógica; sem i18n até haver pedido.

## Comentários

- Padrão: **sem comentário**. Bons nomes e funções pequenas explicam o "o quê".
- Comente só o **porquê não-óbvio**, em uma linha: uma restrição externa, uma decisão contra-intuitiva, um workaround de fornecedor.
- Nunca: comentário que narra o código, histórico de mudança ("antes era X"), código comentado, TODO sem issue.
- Respeite a densidade existente no arquivo; não apague comentários úteis de outros.

## Git

- Branches curtas a partir de `main`: `feat/<escopo>-<assunto>`, `fix/...`, `chore/...`. Vida máxima de poucos dias; rebase em `main` antes do PR.
- Commits convencionais: `feat|fix|chore|docs|refactor|test(scope): resumo no imperativo`. Ex.: `feat(projects): add project import from CSV`.
- Corpo do commit explica o porquê (bom exemplo: um commit que conserta um layout mobile descreve a causa e a regra criada).
- Commits feitos pelo Claude terminam com a linha de co-autoria fornecida pela sessão, ex.: `Co-Authored-By: Claude <noreply@anthropic.com>` (o texto exato vem do próprio Claude Code; não inventar).
- **Nunca commitar segredos**: `.env`, certificados (`*.p12`, `*.pem`), chaves, dumps. `.gitignore` cobre isso desde o primeiro commit. Padrão recorrente: senha real de infraestrutura em `.env.example` desde o primeiro commit exige rotação — se vazou para o histórico, **rotacione**, não basta apagar o arquivo.
- `.env.example` só com nomes e valores fictícios óbvios.
- Proibido sem confirmação humana: `push --force`, reescrever histórico publicado, apagar branch remota.
- Commit e push só quando pedido; um pedido de commit implica push em seguida (regra herdada), salvo instrução contrária.

## Pull requests e revisão

- PR pequeno (alvo: < 400 linhas de diff útil), um assunto, descrição com: objetivo, link da spec, como testar, riscos, screenshots mobile/desktop se mexeu em UI. Checklist em `docs/templates/pr-checklist.md`.
- Revisor (Opus, só o diff — ver [workflow](10-workflow-claude.md)) verifica, nesta ordem:
  1. isolamento de tenant (todo SQL filtra por `organization_id`/passa por `withTenantTx`);
  2. autorização por papel no servidor;
  3. validação Zod na borda e ausência de PII em log;
  4. idempotência/concorrência onde há escrita sensível;
  5. migration forward-only e compatível com o código antigo;
  6. testes cobrindo o caso negativo (outro tenant, papel errado);
  7. mobile verificado (se UI).

## Definição de Pronto (DoD)

- [ ] Atende a spec; nada fora de escopo foi incluído.
- [ ] `type-check`, `lint`, `test` verdes localmente (teste do arquivo afetado; suíte rápida antes do PR).
- [ ] Testes novos para regra nova, incluindo caso negativo de tenant/papel.
- [ ] Migration nova (se houver) com timestamp, forward-only, testada em `dev`.
- [ ] UI verificada em 320, 375, 414px e desktop — ou declarado explicitamente que não foi.
- [ ] Sem segredo, sem PII em log, sem `console.log` esquecido.
- [ ] Dados de teste criados foram apagados.
- [ ] Docs/ADR atualizados se mudou decisão (template em `docs/templates/adr-template.md`).

## Dívida técnica

- Atalho consciente é permitido se **registrado**: issue com rótulo `tech-debt`, motivo, risco e gatilho para pagar ("antes de abrir para o 2º cliente").
- Nunca dívida em segurança/isolamento de tenant/dinheiro: isso é bug, não dívida.
- Lição: verificação de telefone deixada como mock com código fixo "até depois" é achado crítico de auditoria — mock que autentica não pode chegar a produção nem como dívida.

## Dependências

Antes de adicionar uma lib, responda (no PR):

| Critério | Mínimo |
|---|---|
| Necessidade | Não resolvível com a stdlib/stack atual em < ~50 linhas |
| Manutenção | Release nos últimos 12 meses, issues respondidas |
| Tamanho (web) | Impacto no bundle medido; prefira imports por função |
| Licença | MIT/Apache/BSD/ISC; **fontes**: SIL OFL 1.1 aceita (decisão DS-4, 2026-11-05), arquivo de licença versionado junto da fonte |
| Segurança | Sem advisory alto aberto (`pnpm audit --prod`) |
| Tipos | TS nativo ou `@types` mantido |

- Versões fixadas por lockfile; atualização em PR próprio (`chore(deps):`).
- Proibido: ORM (decisão do kit, ADR-003), framework CSS (Tailwind etc.), lib de estado global no front (TanStack Query + Context bastam), lib de data pesada (use `Intl`).
- Dependência nova de infraestrutura (fila, cache, broker) exige ADR. Motivo: broker de mensagens separado no início é uma peça a mais para operar e mais um segredo; um outbox em tabela Postgres resolve o volume inicial com uma peça a menos para operar (ver [backend](05-backend-api.md#jobs-outbox-e-worker)).

## Checklist rápido do autor

- [ ] Li a spec e os docs indicados em `00-INDEX.md` para esta tarefa, e só eles.
- [ ] Tipos derivados de Zod; nenhuma validação duplicada.
- [ ] Centavos inteiros; datas UTC; fuso explícito na exibição.
- [ ] Erros com `code` estável; mensagens pt-BR.
- [ ] Commit convencional, PR pequeno, DoD marcada.
