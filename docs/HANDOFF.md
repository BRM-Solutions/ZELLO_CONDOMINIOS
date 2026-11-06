# Handoff — análise Condomínio 360 / ZELLO

> Atualizado em 05-11-2026. Este arquivo permite continuar a partir do ponto atual se a sessão encerrar.

## Entrega concluída nesta sessão

- As instruções Markdown em `docs/` e `CLAUDE.md` foram revisadas para orientar o plano.
- O arquivo `docs/condominio-360-projeto-mock-v2.zip` foi validado com `unzip -t` e extraído sem erros em `docs/referencias/condominio-360/` (151 arquivos).
- Foi analisado o mock Lovable: 38 rotas, componentes de navegação, módulos de estado e testes de regras do protótipo.
- O plano detalhado, inclusive a tabela de todas as telas e a ordem sugerida, está em `docs/plano-desenvolvimento-condominio-360.md`.

## Achados importantes

- O projeto atual é um scaffold: há placeholders `{{PROJETO}}`/`{{SLUG}}`, e `docs/11-dominio.md` continua vazio.
- O mock é referência visual/produto, não código reaproveitável. Ele usa React 19/TanStack Start/Tailwind e stores em memória; o destino é React 18/Vite, Express, `pg`, Zod, Supabase, RLS e CSS por tokens já presentes no repositório.
- O domínio mais seguro para começar é: organization (cliente SaaS) → workspace (condomínio) → block → unit; usuário morador precisa de `unit_members` além de `memberships`.
- Não foram instaladas dependências do mock, aplicadas migrations, alterados arquivos de código nem executados testes nesta sessão. A extração e estes dois documentos são as únicas mudanças persistentes.

## Próxima ação recomendada

Antes de programar, conduzir as perguntas da seção 8 de `docs/plano-desenvolvimento-condominio-360.md`, uma por vez, e registrar as respostas em `docs/11-dominio.md`. A primeira spec recomendada é **onboarding de condomínio, blocos, unidades e `unit_members`**, seguida de convites/memberships.

## Roteiro para o próximo agente

1. Ler `CLAUDE.md`, `docs/00-INDEX.md`, `docs/11-dominio.md` e o plano acima.
2. Não tratar as hipóteses de `docs/exemplos/dominio-condominios.md` como decisão confirmada.
3. Após decisões do PO, criar o PRD em `docs/prd/` pelo template e somente então uma spec em `docs/specs/`.
4. Para a primeira implementação, ler também `docs/01-arquitetura.md`, `02-banco-de-dados.md`, `03-seguranca.md`, `05-backend-api.md`, `06-frontend.md` e `07-testes.md` conforme o índice.
5. Manter migrations forward-only, RLS deny-by-default, `withTenantTx`, testes A/B de tenant, dados pessoais minimizados e verificação mobile. Não copiar os mini-stores/roles do mock para produção.

## Atualização 05-11-2026 — início das specs

- Regra dura de design system criada: `docs/13-design-system.md` (dono dos valores visuais; exceções fechadas na §8), amarrada em `CLAUDE.md`, `docs/00-INDEX.md`, `docs/06-frontend.md`, `docs/templates/pr-checklist.md`, `docs/templates/agent-prompt-template.md` e `.claude/agents/{builder,reviewer}.md`.
- Roteiro das specs: `docs/specs/README.md`.
- Escritos: `docs/specs/spec-design-system-base.md` (rascunho; DECIDIR-DS-1 a DS-4), `docs/adr/0010-tenant-organization-workspace-condominio.md` (proposto), `docs/prd/estrutura-condominio-acesso.md` (rascunho; perguntas P1–P7).
- Nenhum código, migration ou dependência alterados. Próximo passo: respostas da dona aos DECIDIR-DS e às perguntas P1–P3, depois aprovar a spec da base visual e escrever `spec-estrutura-condominio.md`.
- Fonte única do design system = o zip; cópia em `docs/referencias/condominio-360/` conferida idêntica por `diff -rq` (doc 13 §1.1). Incorporados `dialog`, `switch` e `sonner` do zip; `Portal Vila Gaudí.png` deixou de ser fonte.
- Decisões de 05-11-2026 registradas: DS-1 a DS-4 (tema claro/escuro, personalizador, tokens `-strong`, fontes OFL baixadas em `apps/web/src/assets/fonts/`), ADR-010 aceita, papéis P2, cadastro sem convite, Resend, backoffice no portal, comunicados/documentos visíveis a todos. Pendências em `docs/11-dominio.md` (P3 campos, D1–D4) e `docs/specs/spec-personalizador.md` (PZ-1 a PZ-3). Nova spec: `docs/specs/spec-personalizador.md`.
- 05-11-2026 (tarde): P3, D1–D4, PZ-1 a PZ-3, R6–R8 decididos (regra geral: como no protótipo do zip). Nova spec `docs/specs/spec-estrutura-condominio.md` (Onda 1B). Specs 1A e 1B prontas para aprovação. Repositório público: https://github.com/tiago-brm/ZELLO_CONDOMINIOS (commit inicial b9ceffd; mudanças posteriores ainda não commitadas).
- 05-11-2026 (noite): Onda 1 implementada (branch local `feat/onda-1`, nada commitado): base visual em `apps/web` (1A) e estrutura do condomínio em banco/API/shared (1B). Banco de teste local = Postgres 17 portátil (`pnpm test:local`, `scripts/test-db.mjs`). Verificação final: type-check limpo; shared 37, web 48, api 185 testes passando (7 de integração no PG17 local). VS Code: `.vscode/launch.json` ("1. Ver o visual do sistema (sem login)") e `tasks.json`; guia em `docs/GUIA-MILENA.md`. Vitrine standalone em `apps/web/design-system.html` (só dev).
- Mudança de regra na verificação local: vínculo encerrado perde o acesso **na data de término** (`ends_on > hoje`), não no fim do dia; corrigido em migration, repository, teste PGlite e spec.
- Pedido da dona: criar super-admins locais `tiagopereiraramos@gmail.com` e `milena.leite.rj@gmail.com` (senha `admin123`, só no banco local) quando o papel `super_admin` existir (spec 2.4). Cuidado: o repositório é público; guardar essas credenciais só num seed local não versionado e recusar rodar contra host que não seja `127.0.0.1`.
