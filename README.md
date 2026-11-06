# {{PROJETO}} — COMECE AQUI

Kit inicial genérico para SaaS multi-tenant em pt-BR: base técnica (monorepo, API, web, banco com isolamento por cliente, CI/CD) + regras para o Claude Code trabalhar gastando poucos tokens. Serve para qualquer nicho. **Não traz features de produto**: o seu domínio entra em `docs/11-dominio.md` e nos seus PRDs.

Modelo de dados base: `organization` (tenant, o cliente do SaaS) → `workspaces` (subdivisão opcional: filial, unidade, projeto, loja...) → recursos do seu domínio. Papéis iniciais: `owner`, `admin`, `manager`, `staff`, `member`.

## O que tem aqui

| Pasta/arquivo | Para quê |
|---|---|
| `CLAUDE.md` | regras curtas que o Claude lê em toda sessão |
| `.claude/agents/` | agentes com modelo fixo: `spec-writer` e `reviewer` (Opus), `builder` (Sonnet), `explorer` (Haiku) |
| `.claude/skills/` | receitas: `/spec-then-delegate`, `/new-module`, `/security-review-lite` |
| `.claude/settings.json` | permissões: bloqueia `.env`, chaves, `push --force`, `db push/reset` local |
| `docs/00-INDEX.md` | mapa: "para a tarefa X, leia só Y e Z" |
| `docs/01`–`08` | arquitetura, banco, segurança, boas práticas, API, front, testes, lições |
| `docs/09-deploy-easypanel-supabase.md` | criar ambientes e deploy passo a passo |
| `docs/12-storage-e-governanca.md` | arquivos: bucket privado, upload/download, retenção, LGPD |
| `docs/10-workflow-claude.md` | como trabalhar com o Claude neste repo |
| `docs/11-dominio.md` | **template em branco** do domínio do seu produto (você preenche) |
| `docs/exemplos/dominio-condominios.md` | exemplo de `11-dominio.md` preenchido (SaaS de condomínios) |
| `docs/templates/` | PRD, spec, prompt de agente, ADR, checklist de PR, migration |
| `scripts/init-project.mjs` | troca os placeholders do kit pelo nome do seu projeto |
| `apps/api`, `apps/web`, `packages/shared`, `supabase/`, `.github/` | código e CI |

## Pré-requisitos

- Conta GitHub, conta Supabase, um servidor (VPS) com Easypanel instalado, um domínio com acesso ao DNS.
- Na máquina: Node 22 (`nvm`), pnpm 9 (`corepack enable`), Git, Supabase CLI, Claude Code.
- Um gerenciador de senhas. Nenhuma senha vai para o repositório.

## Primeiros 60 minutos

1. **Copiar e inicializar** (5 min): copie o conteúdo desta pasta para a raiz de um repositório novo e vazio e rode:
   ```bash
   node scripts/init-project.mjs --name "Meu SaaS" --slug meu-saas --scope @meu-saas
   pnpm install
   ```
   O script troca, em todos os arquivos de texto, o nome do produto, o slug técnico e o escopo dos pacotes pelos valores que você passou (os comandos deste README já saem com o seu escopo), recusa nomes com caracteres perigosos, apaga o lockfile para ele ser regenerado e imprime os próximos passos. Rode uma vez só, logo após copiar.
2. **Repo** (5 min): `git init`, primeiro commit, crie o repositório **privado** no GitHub e faça push.
3. **Conferir** (10 min): `pnpm type-check`, `pnpm lint`, `pnpm test` (rápida, sem banco). Copie `.env.example` para `.env` (ele documenta todas as variáveis), preencha só os valores do **dev** e confira com `pnpm check-env`. Testes com banco real (`*.int.test.ts`, via `pnpm test:full`) exigem `TEST_DATABASE_URL` do dev + `TEST_ALLOWED_DB_REFS` ([testes](docs/07-testes.md)).
4. **Supabase** (15 min): crie os projetos `dev` e `prod` seguindo [deploy](docs/09-deploy-easypanel-supabase.md) §2 (região, Data API desligada, chaves ES256, SMTP). O bucket de arquivos vem pela migration, não pela tela.
5. **Secrets do GitHub** (5 min): cadastre os nomes da §4.1 do doc 09. A cada push na `main` com CI verde, o `deploy.yml` aplica as migrations e publica no **dev** sozinho. **Prod nunca é automático**: Actions → Deploy → Run workflow, digitando `prod` no campo `confirm`; o job ainda confere pela API do GitHub que o CI daquele commit está verde (doc 09 §4.3).
6. **Easypanel** (15 min): projeto `dev` com serviços `api` e `web` (§3 do doc 09), primeiro deploy, `curl .../health` e `/ready`. Copie as URLs de deploy para os secrets e desligue o Auto Deploy. Prod fica para quando o dev estiver estável.
7. **Domínio** (5 min): abra `docs/11-dominio.md` e escreva, mesmo que em rascunho, o que o produto faz e quem usa. A primeira sessão com o Claude parte daí.

Travou em algum passo? Abra o Claude Code na pasta e pergunte citando o passo do doc 09.

## Primeira sessão com o Claude

Abra o terminal na raiz do repo e rode `claude`. O modelo padrão já é Opus 5.5 (definido em `.claude/settings.json`). Cole:

```text
Estou começando um projeto novo a partir deste kit. Leia CLAUDE.md e docs/00-INDEX.md (só eles por enquanto).
Depois:
1. Confirme em 5 linhas o que entendeu da stack e das regras.
2. Leia docs/11-dominio.md (o que eu já preenchi) e me faça, uma por vez, as perguntas que faltam
   para fechar entidades, papéis x permissões, regras de negócio, LGPD e a ordem do MVP.
   Vá preenchendo docs/11-dominio.md com as respostas.
3. Com o domínio fechado, proponha o PRD do primeiro módulo em docs/prd/ (template em docs/templates/prd-template.md).
Não escreva código nesta sessão.
```

Depois do PRD aprovado: peça "escreva a spec do módulo X" (o Claude usa `/spec-then-delegate`) e, aprovada a spec, "implementa" — o agente `builder` (Sonnet) faz o código, o `reviewer` (Opus) revisa o diff, e você decide o commit.

Dicas que economizam dinheiro: `/clear` ao trocar de assunto; não cole documentos no chat, salve em `docs/` e passe o caminho; peça resumos, não arquivos inteiros. Detalhes em [workflow Claude](docs/10-workflow-claude.md).

## Onde pôr as suas specs

| Tipo | Pasta | Template |
|---|---|---|
| Domínio do produto | `docs/11-dominio.md` | já é o template (exemplo em `docs/exemplos/`) |
| PRD (o quê e por quê) | `docs/prd/<modulo>.md` | `docs/templates/prd-template.md` |
| Spec técnica (como) | `docs/specs/spec-<nome>.md` | `docs/templates/spec-template.md` |
| Decisão de arquitetura | `docs/adr/NNNN-<nome>.md` | `docs/templates/adr-template.md` |
| Material bruto (planilhas, prints, normas) | `docs/referencias/` | — (não commitar dado pessoal real) |

## Supabase por ambiente: dados + Auth + Storage governados juntos

Cada ambiente (`dev`, `prod`) precisa do **seu próprio projeto Supabase**, e esse projeto concentra as três coisas: tabelas (Postgres), usuários (Auth) e arquivos (Storage). A mesma membership que libera uma linha libera um arquivo, e auditoria, classificação, retenção e eliminação LGPD ficam num lugar só. Nunca aponte o dev para o Storage do prod, nem crie bucket pela tela: ele vem pela migration. Detalhes, limites por plano e decisões em aberto (antivírus, backup dos arquivos): [storage e governança](docs/12-storage-e-governanca.md).

## Regras que valem desde o dia 1

- Dev e prod separados. Teste nunca em prod; teste cria e apaga o próprio tenant de teste.
- Migration só pelo CI. Nunca edite migration já aplicada.
- Toda tabela com RLS e `organization_id`. Dado pessoal é LGPD desde o primeiro campo.
- Toda tela conferida no celular (320–414px).

## Mobile: ainda não verificado no navegador

O scaffold do `apps/web` passou em type-check, lint, testes e build, mas **ninguém abriu as telas num navegador** (login, shell, dashboard, organização). Faça isto uma vez antes da primeira feature e depois a cada mudança de tela:

1. `pnpm --filter @app/web dev`; abra `http://localhost:5173`. O `vite.config.ts` usa `envDir: "../.."`, então as `VITE_*` vêm do `.env` da raiz.
2. DevTools → modo dispositivo (Ctrl/Cmd+Shift+M) → larguras **320**, **375** e **414** px, além do desktop.
3. Em cada largura: sem scroll horizontal; header, menu e botões cabem; fonte >= 12px; alvos de toque >= 44px; textos longos quebram ou truncam.
4. Achou problema: grids com `minmax(0, 1fr)` e `min-width: 0` nos itens (detalhe em [frontend](docs/06-frontend.md) §"Regra mobile").

## Como reutilizar este kit em um novo projeto

1. Copie a pasta do kit (sem `node_modules`, `.git` e `.env`) para a raiz do repositório novo.
2. Rode `node scripts/init-project.mjs --name "..." --slug ... --scope @...` e `pnpm install`.
3. Crie projetos Supabase e serviços Easypanel **novos** (`dev` e `prod`) para esse projeto; nunca reaproveite banco, chave ou URL de deploy de outro projeto.
4. Cadastre os secrets do GitHub do repositório novo (doc 09 §4.1).
5. Preencha `docs/11-dominio.md` (use `docs/exemplos/` como referência de formato) e escreva o primeiro PRD.
6. Se o produto não precisar de `workspaces`, mantenha a tabela sem uso ou decida removê-la numa ADR antes da primeira feature.

## Como atualizar o kit

- Depois de copiado, os docs passam a ser **do seu projeto**: edite à vontade. Não existe "upstream" a sincronizar.
- Mudou uma decisão estrutural? Registre uma ADR em `docs/adr/` (template em `docs/templates/adr-template.md`) e atualize o doc dono do assunto (o [índice](docs/00-INDEX.md) diz qual é).
- Lição nova de produção entra em [lições](docs/08-licoes-aprendidas.md) no formato Sintoma → Causa → Regra → Onde.
- Mantenha o `CLAUDE.md` curto (≤ ~90 linhas): detalhe vai para `docs/`, que carrega sob demanda.
