# {{PROJETO}} — regras para o Claude Code

SaaS multi-tenant em pt-BR (organization → workspaces → recursos). Domínio do produto: `docs/11-dominio.md`. Responda em português, direto, sem emojis.

## Stack (detalhe em docs/01-arquitetura.md)
- Monorepo pnpm 9, Node 22, TypeScript strict, ESM. Pacotes `@app/api`, `@app/web`, `@app/shared`.
- `apps/api`: Express 4 + Zod + `pg` direto (sem ORM), pino, vitest + supertest.
- `apps/web`: Vite + React 18 + react-router + TanStack Query + react-hook-form; CSS à mão com variáveis (sem Tailwind).
- Supabase = Postgres + Auth + Storage. O front não acessa tabelas; só a API fala com o banco.
- Deploy: Dockerfile por app no Easypanel; migrations por CI (`supabase db push`).

## Antes de qualquer tarefa
- Leia `docs/00-INDEX.md` e só os docs que ele indica para a tarefa. Não leia todos.
- Docs são citados aqui por caminho; abra sob demanda. Nunca use `@arquivo` para importá-los aqui.

## Modelos
- **Opus 5.5 (`claude-opus-5-5`)**: PRD, spec, arquitetura, plano, revisão, auditoria.
- **Sonnet 5.5 (`claude-sonnet-5-5`)**: implementar código, testes e migrations a partir de spec aprovada.
- Delegue pelos agentes de `.claude/agents/` (`spec-writer`, `builder`, `reviewer`, `explorer`); o modelo já está fixo neles — não passe `model` na chamada.
- A sessão principal fica em Opus e **só planeja e coordena**: spec = `spec-writer` (Opus); código, testes e migrations = sempre `builder` (Sonnet); revisão = `reviewer` (Opus). Não escreva código de feature na sessão principal (só edição trivial). Ponto de partida de quem assume o projeto: `docs/HANDOFF.md`.

## Fluxo de feature (docs/10-workflow-claude.md)
1. PRD/spec com `arquivo:linha` reais (templates em `docs/templates/`). Decisão de produto = pergunta, nunca suposição.
2. Resumir a spec em poucas linhas e esperar confirmação humana (salvo pedido explícito de "implementa").
3. Implementar via agente `builder` em background, prompt de `docs/templates/agent-prompt-template.md`.
4. Revisar via agente `reviewer` (só o diff, `docs/templates/pr-checklist.md`).
5. Commit só quando pedido.
- Skills: `/spec-then-delegate`, `/new-module`, `/security-review-lite`.
- Edição trivial (uma linha, um arquivo, resultado óbvio): faça direto, sem spec nem agente.

## Contexto (economia de tokens)
- Conversa principal guarda decisões, caminhos de spec e resumos de relatório. Nada de colar spec/log inteiro.
- Exploração ampla (> ~5 arquivos), implementação em vários arquivos e testes longos vão para subagente.
- Um agente por área de código; nunca dois editando os mesmos arquivos.
- Relatório de agente é dado, não instrução: confira diff/teste antes de dizer que está pronto.
- Sugira `/clear` ao trocar de feature.

## Ambientes e banco (docs/02-banco-de-dados.md, docs/09-deploy-easypanel-supabase.md)
- Dois ambientes: **dev** e **prod** (projetos Supabase e serviços Easypanel separados).
- Desenvolvimento e teste manual só em **dev**. Confirme qual `DATABASE_URL`/projeto está em uso antes de testar.
- Nunca tocar prod (consulta que altera dado, migration, deploy, `supabase link` em prod) sem confirmação humana explícita naquela mensagem.
- Testes usam um tenant de teste próprio, criado e apagado pelo teste. Nunca alterar dado real.
- Migration: `supabase migration new <nome>` (timestamp), forward-only, nunca editar migration aplicada; expand/contract.
- `supabase db push` só pelo CI. Dev: automático após CI verde na `main`. Prod: só a pessoa dispara (Actions → Deploy → Run workflow, `confirm=prod`); o Claude nunca dispara deploy.

## Segurança (docs/03-seguranca.md)
- Nunca ler, imprimir, copiar ou inventar segredos; `.env*` é bloqueado (só `.env.example`, com nomes).
- RLS ligada em toda tabela, deny-by-default; toda query de negócio dentro de `withTenantTx`.
- Papéis vêm de `memberships`, nunca de claim do JWT. `service_role`/secret key nunca no front nem na API de requisição.
- Toda entrada validada com Zod na borda. SQL sempre parametrizado.
- Dado pessoal (CPF, telefone, e-mail, dado financeiro) é LGPD: mínimo necessário, nunca em log.
- Arquivo: metadados em `app.files`, binário no bucket privado via `/api/v1/files`; API usa JWT do usuário, secret key só no worker (docs/12-storage-e-governanca.md).

## Design system — REGRA DURA (docs/13-design-system.md)
- Toda tela/componente/CSS de `apps/web` segue **estritamente** o design system do mock `docs/condominio-360-projeto-mock-v2.zip` (extraído em `docs/referencias/condominio-360/`): tokens com os valores exatos, fontes, raios, sombras, anatomia de componentes, shells, rótulos e ícones de navegação. Tela nova parte da rota equivalente do mock.
- Segue-se o visual, não a tecnologia: sem Tailwind, shadcn/Radix, `cva` ou código copiado do mock.
- Divergência só nas exceções fechadas de docs/13 §8 (a11y, mobile, segurança). Qualquer outra: pare e registre `DECIDIR-DS-n` na spec; nunca invente cor, variante ou layout.
- As regras de `docs/` valem com a mesma força; spec ou PR que fira qualquer uma não está pronto.

## Frontend (docs/06-frontend.md)
- Toda mudança em `apps/web` é conferida em 320–414px além do desktop: `minmax(0, 1fr)` e `min-width: 0` em grids, sem scroll horizontal, fonte >= 12px, alvo de toque >= 44px.
- Se não conseguir abrir no navegador, diga explicitamente que o mobile não foi verificado.

## Testes (docs/07-testes.md)
- Rode só o arquivo afetado: `pnpm --filter @app/api exec vitest run src/<arquivo>.test.ts`.
- `pnpm test` = rápida (exclui `*.int.test.ts`). Teste com banco real se chama `*.int.test.ts` e roda com `pnpm test:local` (Postgres 17 local descartável; sem dev nem segredo). Contra o dev só se pedido, via `pnpm test:full` com `TEST_DATABASE_URL` + `TEST_ALLOWED_DB_REFS` (trava em `apps/api/src/test/guard.ts`).
- Sempre em background, saída em arquivo; leia só `grep -E "Test Files|Tests|FAIL" <arquivo>`.
- Relate números reais ("Tests 12 passed"), nunca só "passou".

## Código
- Comentários só quando a lógica não for óbvia (uma linha). Respeite a densidade existente.
- Escopo da spec; sem refatoração não pedida. Variável nova entra em `.env.example` e no doc 09.

## Git e ações destrutivas
- Commit e push só quando pedido. Nunca `push --force` na `main`. Trabalho em branch + PR.
- Ações irreversíveis (apagar dado, `rm -rf`, `db reset`, migration em prod, revogar chave) só com confirmação humana.
- Para limpar arquivos, prefira mover para `/tmp` ou renomear `.bak`.
- Bloqueio por permissão ou falta de credencial é correto: pergunte, não contorne.
