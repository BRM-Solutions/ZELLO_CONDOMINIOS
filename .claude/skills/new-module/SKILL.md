---
name: new-module
description: Receita para criar um módulo de negócio novo ponta a ponta (ex.: projetos, avisos, chamados, reservas, cobranças) — migration com RLS, schemas Zod em packages/shared, rotas da API, páginas no web, testes e docs. Use quando pedirem "criar o módulo X", "novo CRUD de Y", "adicionar a entidade Z", ou ao iniciar a implementação de um PRD aprovado. Exige PRD ou spec; se não houver, comece por /spec-then-delegate.
---

# Novo módulo ponta a ponta

Pré-requisito: PRD em `docs/prd/<modulo>.md` aprovado. Sem ele, pare e proponha escrever (template `docs/templates/prd-template.md`). Domínio do produto: `docs/11-dominio.md` (se a seção que o módulo precisa estiver vazia, pergunte).

## 0. Spec
- `docs/specs/spec-<modulo>.md` via `/spec-then-delegate` (template `docs/templates/spec-template.md`).
- Defina na spec: tabelas, papéis por operação (matriz em `docs/11-dominio.md` §3), rotas, telas, casos de teste.

## 1. Migration + RLS — `docs/02-banco-de-dados.md`
- `supabase migration new <modulo>`; copie `docs/templates/migration-template.sql`.
- `organization_id` (+ `workspace_id`) `not null`, FK composta, `check` nos campos, índice pelo filtro principal.
- RLS ligada; uma policy por operação `to app_api`; UPDATE com `using` + `with check`; grants explícitos.
- Aditiva. Dinheiro em centavos (`bigint`). Dado pessoal: ver `docs/03-seguranca.md` (LGPD).
- Anexos: não crie bucket nem tabela de arquivo própria; referencie `app.files(id)` e use as rotas `/api/v1/files` (`docs/12-storage-e-governanca.md`), definindo `classification` e retenção na spec.

## 2. Shared — `packages/shared`
- Schemas Zod de entrada e saída (`<modulo>CreateSchema`, `<modulo>Schema`, query de listagem) e tipos inferidos.
- Atualizar a matriz de papéis compartilhada se o módulo trouxer permissão nova (`docs/05-backend-api.md`).
- Só código puro: nada de `process.env`, I/O ou `pg`.

## 3. API — `docs/05-backend-api.md`
- `apps/api/src/modules/<modulo>/`: `routes.ts` (exporta `<modulo>Router()`; `parse(schema, ...)` + `requirePermission("<modulo>:<acao>")`, permissões novas em `packages/shared/src/permissions.ts`), `service.ts` (regra de negócio), `repository.ts` (SQL parametrizado recebendo o client da transação). Molde: `modules/workspaces/`.
- Tudo dentro de `withTenantTx(req, fn)`. Resposta via `sendData` (`{ data, meta: { requestId, ... } }`); erros com `DomainError`/fábricas de `http.ts`, `code` em MAIÚSCULAS. Ação sensível grava `audit_log`.
- Montar o router em `apps/api/src/app.ts` na linha `app.use("/api/v1", authenticate(verifier), loadMembership, ...)`.

## 4. Web — `docs/06-frontend.md`
- Página(s) em `apps/web/src/pages/<modulo>/`, dados via TanStack Query (query keys com o id da organização), formulário com react-hook-form + schema de `@app/shared`.
- Estados carregando/vazio/erro em pt-BR; esconder ações que o papel não pode (a API continua sendo a barreira).
- Conferir 320–414px e desktop.

## 5. Testes — `docs/07-testes.md`
- `apps/api/src/modules/<modulo>/<modulo>.test.ts` (banco fake + `buildTestApp` de `src/test/helpers.ts`) e, se precisar de banco real, `<modulo>.int.test.ts` (fica fora do `pnpm test`): feliz, sem permissão, **outro tenant**, entrada inválida.
- Tenant de teste criado e apagado pelo próprio teste. Rodar só o arquivo, em background, ler o resumo.

## 6. Docs
- `.env.example` e `docs/09-deploy-easypanel-supabase.md` §6 se surgir variável.
- Atualizar `docs/00-INDEX.md` só se surgir doc novo.

## Divisão em agentes (opcional)
- Agente 1 (`builder`): passos 1–3 (migration, shared, API) e testes da API.
- Depois, agente 2 (`builder`): passo 4 (web), usando os schemas já prontos.
- Em seguida `reviewer` sobre o diff + `/security-review-lite`.
- Não rode 1 e 2 em paralelo se a spec ainda estiver mudando o schema.

## Pronto quando
- type-check/lint limpos, testes do módulo passando (número real), isolamento de tenant testado, tela conferida no mobile, nada commitado sem pedido.
