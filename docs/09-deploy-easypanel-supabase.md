# Deploy — Supabase (dev/prod) + Easypanel + GitHub Actions

> **Quando ler:** ao criar os ambientes pela primeira vez, mexer em CI/CD, variáveis de ambiente, domínio ou ao fazer rollback.
> **Resumo:**
> - Dois projetos Supabase (`dev` e `prod`) e dois conjuntos de serviços no Easypanel, separados desde o dia 1.
> - Migrations só por CI (`supabase db push`): dev automático após CI verde na `main`; prod só por disparo manual (`workflow_dispatch` com `confirm=prod`). Nunca do laptop contra prod.
> - Auto-deploy por push do Easypanel **desligado**: o GitHub Actions aplica a migration e depois chama a URL de deploy de cada serviço.
> - `VITE_*` são embutidas no build do web: mudou, precisa rebuild. Segredos só no Easypanel e nos secrets do GitHub.
> - A API conecta pelo pooler com o papel `app_api` (sem BYPASSRLS); `service_role`/secret key nunca vai para o front nem para a API.
> **Relacionados:** [arquitetura](01-arquitetura.md), [storage](12-storage-e-governanca.md), [banco](02-banco-de-dados.md), [segurança](03-seguranca.md), [lições](08-licoes-aprendidas.md), [workflow Claude](10-workflow-claude.md)

Itens marcados `[verificar]` não foram confirmados na documentação oficial em 2026-10-30; confira na tela antes de confiar.

## 1. Visão geral

```
push main --CI verde--> deploy.yml (workflow_run) job deploy-dev:
   supabase db push -> Supabase DEV  -> scripts/ci-deploy.sh (api, worker, web DEV) -> smoke DEV
Actions > Deploy > Run workflow, confirm=prod (workflow_dispatch) job deploy-prod:
   supabase db push -> Supabase PROD -> scripts/ci-deploy.sh (api, worker, web PROD) -> smoke PROD
Easypanel: projeto {{SLUG}}-dev (api, web) | projeto {{SLUG}}-prod (api, web, worker opcional)
```

Ordem fixa: **migration antes do código**. Por isso toda migration é *expand/contract* (ver [banco](02-banco-de-dados.md)): o código antigo precisa continuar funcionando com o schema novo durante o deploy.

## 2. Supabase — criar os dois projetos

Faça tudo duas vezes (`{{SLUG}}-dev` e `{{SLUG}}-prod`). Guarde cada senha num gerenciador de senhas, nunca no repo.

1. supabase.com → New project. Região **South America (São Paulo)** (latência + LGPD mais simples). Gere a senha do banco forte.
2. Anote o **Project ref** (Settings → General). Vira `SUPABASE_PROJECT_REF_DEV|PROD`.
3. **API keys** (Settings → API Keys): use as chaves novas *publishable* (`sb_publishable_...`, vai para o front como `VITE_SUPABASE_ANON_KEY`) e *secret* (`sb_secret_...`, só em script administrativo/worker se um dia precisar). As chaves legadas `anon`/`service_role` existem em paralelo durante a migração e devem ser desativadas depois.
4. **Data API desligada** (Settings → Data API / API settings, opção de habilitar a Data API `[verificar rótulo atual]`): desligue nos dois projetos e confirme que o schema `app` não está em *Exposed schemas*. Só a API fala com o banco; a chave pública só é segura com isso desligado ([segurança](03-seguranca.md) §RLS).
5. **JWT Signing Keys** (Settings → JWT Keys): migre para chave assimétrica **ES256** (botão de migração, sem downtime) e faça *rotate*. A API valida com `jose` via JWKS em `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` (cache de borda ~10 min). Não valide com o segredo HS256 legado. Só revogue o segredo legado depois de > 1h15 (expiração do token) e depois de desativar as chaves legadas.
6. **Auth → URL Configuration**: *Site URL* = URL do web daquele ambiente; *Redirect URLs* = só os domínios do próprio ambiente (dev não aceita redirect para prod e vice-versa). Inclua `http://localhost:5173/**` apenas no dev.
7. **Auth → Providers → Email**: e-mail/senha + magic link. Confirmação de e-mail ligada. `DECIDIR:` cadastro aberto ou só por convite (B2B: recomendo desligar *Allow new users to sign up* e criar usuários por convite da API).
8. **Auth → SMTP**: configure SMTP próprio (disponível em todos os planos). O SMTP embutido tem limite de envio muito baixo e não serve para produção `[verificar limite atual]`. Traduza os templates de e-mail para pt-BR.
9. **Política de senha**: mínimo 10 caracteres, exigir letras e números; ligar *leaked password protection* se o plano permitir `[verificar plano]`. Considere MFA (TOTP) para `owner`/`admin`.
10. **Storage** (regras completas em [12](12-storage-e-governanca.md)): **não crie bucket pela tela**. O bucket privado `private-files` (limite de tamanho, `allowed_mime_types`) e as policies de `storage.objects` vêm da migration `<timestamp>_files_storage.sql`, aplicada pelo `supabase db push` em cada ambiente; confira no painel que ele está *private*.
    - Storage Settings → *Global file size limit*: Free máx. 50 MB; Pro/Team até 500 GB. Ajuste para ≥ `file_size_limit` do bucket (que é ≥ `FILE_MAX_BYTES`).
    - Storage incluído: Free 1 GB, Pro 100 GB (excedente ≈ US$ 0,0213/GB-mês); egress `[verificar]`. Transformação de imagem só Pro+.
    - Backup: backups do banco (diário/PITR) **não** incluem objetos do Storage. Cópia dos objetos para fora (S3 compatível, versionado) é `DECIDIR` em [12](12-storage-e-governanca.md); se adotar, as chaves S3 (ignoram RLS) ficam só no serviço de backup.
11. **Extensões** (Database → Extensions), habilitar por migration, não pela tela: `pgcrypto`, `citext`, `pg_trgm`, `unaccent` conforme necessidade. `pg_cron` só quando houver job agendado `DECIDIR`.
12. **Backups**: Pro tem backup diário com 7 dias. **PITR** é add-on (≈ US$ 100/mês por 7 dias) — `DECIDIR` para prod quando houver cliente pagante; recomendo ligar antes de cobrar dinheiro real.
13. **Network**: a conexão direta `db.<ref>.supabase.co` é IPv6 por padrão `[verificar]`; o servidor do Easypanel normalmente é IPv4, então use sempre o **pooler (Supavisor)**.

### 2.1 Papéis de banco `app_api` e `app_worker`

Os papéis são **criados pela migration base** como `nologin nobypassrls noinherit`, com grants e policies `to app_api`/`to app_worker` (SQL e motivo em [banco](02-banco-de-dados.md) §"Papéis"). O que fica fora do git é só **ligar o login e definir a senha**, uma vez por projeto, **depois** que o CI aplicou a migration base. No SQL Editor, logado como `postgres`:

```sql
alter role app_api with login password '<gerada-no-gerenciador>';
alter role app_worker with login password '<outra-senha>';
select rolname, rolcanlogin, rolbypassrls, rolinherit from pg_roles where rolname like 'app_%';
```

- Esperado: `rolcanlogin = true`, `rolbypassrls = false`. Senha diferente em dev e prod; gerada, 32+ caracteres.
- Não use `grant authenticated to app_api` (decisão do [banco](02-banco-de-dados.md)): as policies miram `app_api` diretamente e o contexto do usuário vem de `set_config(..., true)` dentro de `withTenantTx`.
- Rotação: `alter role ... password` nova → atualizar `DATABASE_URL` no Easypanel → Deploy. Há alguns segundos de erro de conexão; faça fora do horário de pico.
- `postgres` e secret key ficam só para migration (CI) e operação manual.

### 2.2 Connection string do pooler

Supabase → Connect → *Transaction pooler*. Troque usuário e senha:

```
postgresql://app_api.<project_ref>:<senha-url-encoded>@<host-do-pooler>:6543/postgres
```

- Usuário no formato `papel.<project_ref>`; porta **6543** = modo transação (API e worker). 5432 no pooler = modo sessão (ferramentas administrativas).
- Senha com símbolo precisa de *percent-encoding*.
- Modo transação não mantém estado de sessão: por isso o contexto do usuário é sempre `set local`/`set_config(..., true)` dentro de `withTenantTx`. `SET` sem `local` vaza entre requisições — proibido.

## 3. Easypanel — projetos e serviços

Pré-requisito: Easypanel instalado num servidor (VPS) com o painel atrás de domínio HTTPS (a URL de deploy carrega um token; não use o painel em `http://IP:3000`). Em Settings → GitHub, conecte uma conta/token com acesso ao repo.

Crie **dois projetos**: `{{SLUG}}-dev` e `{{SLUG}}-prod`. Em cada um, serviços do tipo **App**:

| Campo | api | web | worker (opcional) |
|---|---|---|---|
| Source | GitHub → repo, branch `main` | idem | idem |
| Build | Dockerfile `apps/api/Dockerfile` | `apps/web/Dockerfile` | mesma imagem da api, comando `node dist/worker.js` (o `CMD` padrão é `node dist/index.js`) `[verificar campo de comando no Easypanel]` |
| Build path (contexto) | `/` (raiz do monorepo) | `/` | `/` |
| Porta do domínio | valor de `API_PORT` (imagem expõe `3000`) | `8080` (nginx sem root) | sem domínio |
| Domínio | `api.<dominio>` / `api-dev.<dominio>` | `app.<dominio>` / `app-dev.<dominio>` | — |
| Réplicas | 1 (subir depois) | 1+ | **exatamente 1** |
| Volume | não precisa (stateless) | não | não |
| Auto Deploy | **desligado** | **desligado** | **desligado** |

- **Domínios + HTTPS**: aponte um registro A do DNS para o IP do servidor, adicione o domínio no serviço, protocolo HTTPS com o resolvedor de certificado padrão (Let's Encrypt). A porta de destino é a porta em que o processo escuta **dentro** do container.
- **Variáveis**: a aba Environment usa sintaxe `.env` e é entregue ao build e ao container. No web, as `VITE_*` precisam existir como `ARG` no Dockerfile (o scaffold já faz) e mudar qualquer uma exige **rebuild** (Deploy, não Restart). Configure antes do primeiro deploy.
- **Healthcheck em `/health`**: liveness sem banco (se o banco cair, o container não deve ser reiniciado em loop; quem checa banco é `/ready`). A doc do App Service do Easypanel não descreve um campo de healthcheck `[verificar na tela]`; por isso o Dockerfile da api traz `HEALTHCHECK` chamando `GET /health` (o Docker Swarm, que o Easypanel usa, aplica o healthcheck da imagem `[verificar]`). Se o painel tiver campo próprio, configure o mesmo caminho `/health`. O smoke do CI checa `/ready`.
- **Volumes**: nenhum. Arquivos vão para o Supabase Storage. Seed de volume no Easypanel não é confiável: não dependa de disco do container.
- **Worker/réplicas**: processo que consome fila/outbox ou faz polling roda com 1 réplica até ter lock (`for update skip locked`): duas instâncias de um poller duplicam efeitos.
- Se renomear o repo no GitHub, reconecte a origem em cada serviço — o Easypanel continua apontando para o nome antigo.

### 3.1 URL de deploy (o que o CI chama)

Confirmado na doc oficial do App Service: a aba **Deployments** mostra uma **Deployment Trigger URL**; "enviar uma requisição para essa URL inicia um deploy", feita para CI e webhooks. A URL contém um token secreto; **gerar uma nova invalida a antiga**. O método HTTP não está documentado `[verificar]` — use `POST` e teste uma vez à mão:

```bash
curl -fsS -X POST "$EASYPANEL_DEPLOY_URL_API_DEV"
```

Se retornar 404/405, teste `GET`. Copie cada URL (4 no mínimo: api/web × dev/prod) para os secrets do GitHub. O toggle **Auto Deploy** (deploy a cada push via webhook do GitHub) também existe, mas fica desligado: com ele o código sobe antes da migration.

## 4. GitHub Actions

### 4.1 Secrets e variables (nomes finais)

Repo → Settings → Secrets and variables → Actions → **Repository secrets** (secrets de *Environment* em repo privado exigem plano Pro/Team). Os jobs declaram `environment: dev`/`environment: prod` só para histórico de deploy no GitHub; **não** há reviewers configurados e o gate é o `workflow_dispatch` (4.3).

| Secret | Onde obter |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens (escopo nos 2 projetos) |
| `SUPABASE_PROJECT_REF_DEV` / `_PROD` | Settings → General de cada projeto |
| `SUPABASE_DB_PASSWORD_DEV` / `_PROD` | senha do `postgres` definida na criação |
| `EASYPANEL_DEPLOY_URL_API_DEV` / `_WEB_DEV` | Easypanel → serviço → Deployments → Deployment Trigger |
| `EASYPANEL_DEPLOY_URL_API_PROD` / `_WEB_PROD` | idem, projeto prod |
| `EASYPANEL_DEPLOY_URL_WORKER_DEV` / `_PROD` | só se houver worker |

Repository **variables** (não secretas): `SMOKE_API_URL_DEV`, `SMOKE_API_URL_PROD`, `SMOKE_WEB_URL_DEV`, `SMOKE_WEB_URL_PROD`.

Estes nomes **não** são variáveis do `.env`: o `.env.example` só os cita num bloco de comentário ("são GitHub Secrets/Variables").

### 4.2 `ci.yml` (em PR e push na `main`)

Versões do scaffold (2026-10): TypeScript ^5.8.3, ESLint 10, vitest 5, Express 4.22, React 18, Vite 6, zod 3.25, tsup 9. Dependabot (`.github/dependabot.yml`) propõe atualizações; major só em PR próprio.

`actions/checkout@v7` + `pnpm/action-setup@v6` + `actions/setup-node@v7` (Node 22, cache pnpm) → `pnpm install --frozen-lockfile` → `type-check` → `lint` → `test` → `build` → `pnpm audit --prod` com `continue-on-error: true`. O `pnpm test` do CI não usa banco (exclui `*.int.test.ts`). Testes de integração rodam com `pnpm test:full` contra o **dev** (`TEST_DATABASE_URL` + `TEST_ALLOWED_DB_REFS`), com tenant de teste próprio, nunca prod ([testes](07-testes.md)); `DECIDIR:` job noturno no CI com esses secrets do dev. `DECIDIR:` validar migrations num Postgres efêmero do CI com `supabase db start` (padrão da doc do Supabase; é Docker no runner do CI, não na máquina de ninguém).

### 4.3 `deploy.yml`

- Gatilho dev: `workflow_run` do CI concluído com sucesso na `main` (checkout de `github.event.workflow_run.head_sha`). Gatilho prod: `workflow_dispatch` com input `confirm` que precisa ser exatamente `prod`.
- `concurrency: deploy-${{ ambiente }}` sem cancelamento, para dois deploys não aplicarem migration ao mesmo tempo.
- Job de migration (padrão oficial do Supabase):

```yaml
env:
  SUPABASE_CLI_VERSION: 2.122.0
# no job: SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD (=_DEV|_PROD), SUPABASE_PROJECT_REF (=_DEV|_PROD)
- uses: supabase/setup-cli@v3
  with:
    version: ${{ env.SUPABASE_CLI_VERSION }}
- run: |
    supabase link --project-ref "$SUPABASE_PROJECT_REF"
    supabase db push --dry-run
    supabase db push
```

  - CLI fixado em `2.122.0` (última release estável em 2026-10-23). Suba a versão de propósito, num PR próprio.
  - A action: `supabase/setup-cli@v3` (a versão que o README oficial usa hoje; `v1`/`v2` são branches antigas), já assim no `deploy.yml` do scaffold. `[verificar]` no primeiro run que o `link`/`db push` passa.
- Job de deploy: `scripts/ci-deploy.sh` — `curl -X POST` (cai para `GET` se falhar) na URL da api e do worker, espera `SMOKE_API_URL/ready` = 200 (até 10 min), dispara o web, espera o web = 200 e confere `/health`. URL de deploy vazia = serviço ainda não criado: pula sem falhar (primeiro deploy).
- **Gate de prod (implementado)**: job `deploy-prod` só roda em `workflow_dispatch` com input `confirm` exatamente `prod` e `ref = main` (Actions → Deploy → Run workflow). Só quem tem write no repo dispara. *Required reviewers* de GitHub Environment só funcionam em repo **público** nos planos Free/Pro/Team (em privado, só Enterprise), por isso não são o gate. `DECIDIR:` se o repo for público ou Enterprise, adicionar reviewers ao environment `prod` como segunda trava.
- **Job `verify-release` (requisito do `deploy-prod`)**: antes de qualquer migration em prod, consulta a API do GitHub para o `GITHUB_SHA` e falha se (a) não houver run do `ci.yml` com conclusão `success` para esse commit, ou (b) o commit status `deploy/dev` não estiver `success`. O `deploy-dev` grava esse status ao terminar (permissão `statuses: write` no workflow). Ou seja: prod só aceita um commit que passou no CI **e** já subiu no dev. O gate humano continua sendo o `workflow_dispatch` com `confirm=prod`.
- Supabase Branching (banco por PR, ≈ US$ 0,013/h por branch) é opcional; não é necessário para começar.

## 5. Primeiro deploy (ordem)

1. Supabase dev: seção 2 inteira.
2. Push do scaffold na `main`; CI verde; `deploy.yml` aplica migrations no dev (as chamadas ao Easypanel falham até o passo 5 — esperado).
3. 2.1 (login/senha dos papéis) e 2.2 (connection string). Easypanel dev: criar api com envs → Deploy → `curl https://api-dev.<dominio>/health` e `/ready`.
4. Criar web com `VITE_API_URL` apontando para a api já no ar → Deploy.
5. Copiar as Deployment Trigger URLs para os secrets; desligar Auto Deploy.
6. Repetir 1–5 para prod, disparando `deploy.yml` manual com `confirm=prod`.

## 6. Variáveis por serviço (só nomes)

| Serviço | Variável | Tipo | Onde obter |
|---|---|---|---|
| api | `NODE_ENV` | runtime | `production` em dev e prod do Easypanel |
| api | `API_PORT` | runtime | mesma porta do domínio do serviço |
| api | `WEB_ORIGIN` | runtime | URL do web do ambiente (allowlist CORS, vírgula se várias) |
| api | `DATABASE_URL` | runtime, secreta | pooler 6543, usuário `app_api.<ref>` (2.2) |
| api | `SUPABASE_URL` | runtime | Settings → API |
| api | `SUPABASE_JWKS_URL` | runtime | `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` |
| api | `LOG_LEVEL` | runtime | `info` (prod), `debug` só em dev |
| api | `SUPABASE_PUBLISHABLE_KEY` | runtime, pública | chave *publishable* do ambiente; usada com o JWT do usuário ([12](12-storage-e-governanca.md)) |
| api | `STORAGE_BUCKET` | runtime | `private-files` (default) |
| api | `STORAGE_SIGNED_URL_TTL_SECONDS` | runtime | `120` (default; 60–300) |
| api | `FILE_MAX_BYTES`, `FILE_ALLOWED_MIME` | runtime | ≤ limite do bucket; lista separada por vírgula ⊆ `allowed_mime_types` do bucket |
| web | `VITE_API_URL` | **build** | `https://api.<dominio>` (sem `/api/v1`: o `apiFetch` acrescenta) |
| web | `VITE_SUPABASE_URL` | **build** | Settings → API |
| web | `VITE_SUPABASE_ANON_KEY` | **build**, pública | chave *publishable* |
| api | `DATA_ENCRYPTION_KEY`, `DATA_HASH_KEY` | runtime, secretas | geradas (32 bytes, base64), quando o primeiro campo cifrado entrar ([segurança](03-seguranca.md)) |
| worker | `NODE_ENV`, `LOG_LEVEL` | runtime | idem api |
| worker | `WORKER_POLL_INTERVAL_MS`, `WORKER_BATCH_SIZE` | runtime, opcionais | defaults no `config.ts` |
| worker | `DATABASE_URL` | runtime, secreta | pooler 6543, usuário `app_worker.<ref>` |
| worker | `SUPABASE_URL`, `STORAGE_BUCKET` | runtime | idem api |
| worker | `SUPABASE_SECRET_KEY` | runtime, **secreta** | chave *secret* (`sb_secret_...`); **só no worker**, para purga e reconciliação de arquivos. Nunca na api nem no web |

Local: `.env.example` (raiz) documenta as variáveis de runtime/build desta tabela (os secrets de CI da §4.1 aparecem lá só como comentário); copie para `.env`. O `apps/web/vite.config.ts` usa `envDir: "../.."`, então o web em dev lê as `VITE_*` do mesmo `.env` da raiz.

Nunca: `service_role`/secret key em `VITE_*`; mesmo `DATABASE_URL` em dev e prod; segredo em build arg do web (vai parar no JS público). Quando e-mail/pagamento entrarem, as novas variáveis entram em `.env.example` e nesta tabela no mesmo PR. Com o módulo `files` em uso o worker deixa de ser opcional: é ele quem purga e reconcilia arquivos.

## 6.1 Inventário e rotação de segredos

Mantenha esta tabela preenchida (dono e data) num lugar privado — o modelo vem aqui, os valores nunca. Regras de quando rotacionar: [segurança](03-seguranca.md) §Segredos.

| Segredo | Onde vive | Como rotacionar | Impacto |
|---|---|---|---|
| Senha `postgres` (dev/prod) | gerenciador + secret do GitHub | Supabase → Database → reset password → atualizar `SUPABASE_DB_PASSWORD_*` | só CI |
| Senha `app_api`/`app_worker` | gerenciador + Easypanel | `alter role ... password` → `DATABASE_URL` → Deploy | segundos de erro |
| `SUPABASE_ACCESS_TOKEN` | secret do GitHub | criar token novo → trocar secret → revogar antigo | nenhum |
| JWT signing key | Supabase | criar standby → rotate → revogar após > 1h15 | nenhum se JWKS em cache curto |
| Secret key / legadas | Supabase | criar nova → trocar `SUPABASE_SECRET_KEY` no worker → revogar | purga de arquivos para até trocar |
| Deployment Trigger URLs | Easypanel + secret do GitHub | regenerar no serviço (invalida a antiga) → trocar secret | deploy falha até trocar |
| `DATA_ENCRYPTION_KEY` | Easypanel | **nunca só trocar**: nova versão de chave + re-cifrar (formato `v1:`) | dados ilegíveis se errar |
| `DATA_HASH_KEY` | Easypanel | recalcular todos os hashes de busca | busca quebra até recalcular |
| SMTP / provedores | Easypanel | gerar nova no provedor → trocar → revogar | envio |

Padrão recorrente: a chave de cifra de dados não pode ser trocada sem migração de re-cifragem; e credencial real commitada em `.env.example` exigiu rotação ([lições](08-licoes-aprendidas.md)).

## 7. Rollback

- **Código**: o Easypanel mostra histórico de deploys mas não documenta botão de rollback `[verificar]`. Caminho seguro: `git revert` do commit na `main` → pipeline normal. Emergência: apontar o serviço para o commit/tag anterior e Deploy `[verificar campo]`.
- **Banco**: migrations são forward-only. Desfazer = **nova** migration corretiva. Por isso nunca `drop`/rename no mesmo deploy que muda o código (expand → deploy → contract em PR seguinte).
- **Dado**: restore de backup diário ou PITR (se contratado) cria cenário de perda; só com decisão humana.
- `Force Rebuild` refaz sem cache (útil quando dependência mudou e o cache enganou).

## 8. Custos aproximados (2026-10, US$/mês)

| Item | Valor | Nota |
|---|---|---|
| Supabase Pro (org) | 25 | inclui US$ 10 de compute (1 Micro) |
| 2º projeto (dev) Micro | +10 | ou dev em org Free separada (pausa após 1 semana parado, 500 MB, sem backup) |
| PITR 7 dias (prod) | +100 | opcional, recomendado com cliente pagante |
| Easypanel | 0 a 15–38 | Free: até 3 projetos; pagos Hobby/Growth/Business por servidor |
| VPS (2–4 vCPU, 4–8 GB) | 10–40 | dev e prod podem dividir o servidor no início |
| SMTP transacional | 0–20 | por volume |

## 9. Alternativa: Supabase self-hosted no Easypanel

O Easypanel tem template de Supabase `[verificar disponibilidade/versão]`.

| Prós | Contras |
|---|---|
| custo fixo, sem limite por projeto | backup, PITR, restore testado: tudo por sua conta |
| dados no seu servidor | atualizações de ~10 containers (Auth, Storage, Realtime, Kong...) manuais |
| sem pausa de projeto | Studio exposto exige proteção forte; SMTP, chaves e JWKS assimétrico manuais `[verificar suporte a signing keys]` |
| | um servidor caído derruba banco + app juntos |

**Recomendação:** Supabase Cloud enquanto o produto valida (o custo extra é menor que uma noite restaurando backup). Reavaliar self-hosted só com equipe de operação e restore testado.

## Checklist pré-go-live

- [ ] Dois projetos Supabase, região SP, senhas no gerenciador; chaves legadas desativadas.
- [ ] JWT ES256 ativo; API valida por JWKS; Site URL/Redirect URLs só do próprio ambiente.
- [ ] SMTP próprio + templates pt-BR testados (cadastro, magic link, reset).
- [ ] `app_api`/`app_worker` com `rolbypassrls = false`; `DATABASE_URL` usa pooler 6543.
- [ ] Data API desligada nos dois projetos; schema `app` não exposto.
- [ ] Todas as tabelas com RLS ligada (`migrations.test.ts` verde e `supabase/tests/catalog.sql` retornando zero linhas no dev e no prod); buckets privados.
- [ ] Checklist de go-live de [12](12-storage-e-governanca.md) (bucket pela migration, `SUPABASE_SECRET_KEY` só no worker, limites por plano, backup de objetos decidido).
- [ ] Inventário de segredos (6.1) preenchido com dono e data.
- [ ] Checklist "antes de produção" de [segurança](03-seguranca.md) concluído.
- [ ] Auto Deploy desligado; 4+ Deployment Trigger URLs nos secrets; painel em HTTPS.
- [ ] Backups conferidos; `DECIDIR` PITR; restore testado ao menos uma vez em dev.
- [ ] Domínios com HTTPS; CORS só com os domínios do ambiente.

## Checklist pós-deploy

- [ ] `GET /health` = 200 (`{ status: "ok", service: "{{SLUG}}-api" }`) e `GET /ready` = 200 (banco ok) no ambiente certo.
- [ ] Web abre, login funciona, chamada autenticada à API retorna dados do tenant de teste.
- [ ] Logs da api sem erro em loop (Easypanel → Logs); nenhum segredo nos logs.
- [ ] Teste em celular (320–414px) da tela alterada.
