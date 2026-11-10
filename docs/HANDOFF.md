# Handoff — ZELLO_CONDOMINIOS (para o Claude Code da Milena)

> Atualizado em 05-11-2026. Este arquivo é o ponto de partida: leia inteiro, depois siga a tabela de "Próximos passos". O histórico anterior está no git (`git log -- docs/HANDOFF.md`).

## 0. Leia nesta ordem

1. Este arquivo.
2. `CLAUDE.md` (regras fixas do projeto) e `docs/00-INDEX.md` (diz quais docs ler para cada tarefa; nunca leia `docs/` inteiro).
3. `docs/13-design-system.md` (regra dura de interface), `docs/11-dominio.md` (decisões de produto) e `docs/specs/README.md` (roteiro das ondas).
4. `docs/GUIA-MILENA.md` (como ver o sistema e rodar verificações).

## 1. Quem trabalha aqui e como falar

- **Milena** desenvolve daqui para frente e **não tem formação em programação**. Fale em português simples, sem jargão; explique o que foi feito, o que ela precisa conferir e o que precisa decidir. Uma pergunta por vez, sempre com opções e uma recomendação.
- **Tiago** é o dono do produto: decisões de negócio, de custo, de segurança e qualquer coisa em produção passam por ele `[confirmar com Tiago se a Milena também aprova specs]`.
- Decisão de produto nunca é suposição: vira pergunta e é registrada em `docs/11-dominio.md` ou na spec.

## 2. Regra de execução: Opus planeja, Sonnet constrói, sempre por subagentes

| Trabalho | Agente (`.claude/agents/`) | Modelo (já fixado no agente) |
|---|---|---|
| PRD, spec, ADR, plano | `spec-writer` | Opus 5.5 |
| Revisão do diff e de segurança | `reviewer` | Opus 5.5 |
| Código, testes, migrations | `builder` | Sonnet 5.5 |
| Achar onde está algo | `explorer` | Haiku 5.5 |

- A **sessão principal fica em Opus** (`.claude/settings.json`). Se o `/model` foi trocado, volte para Opus.
- **Nunca escreva código de feature na sessão principal**: delegue ao `builder`. Só edição trivial (uma linha, um arquivo) é direta. Não passe `model` ao chamar um agente; o modelo já está no arquivo do agente.
- Ciclo de cada feature (skill `/spec-then-delegate`): spec do `spec-writer` → resumo de 5 a 10 linhas para a Milena e **aprovação dela** → `builder` em segundo plano com o prompt de `docs/templates/agent-prompt-template.md` → conferir diff e testes você mesmo → `reviewer` sobre o diff → PR.
- Um agente por área de código; dois agentes só em paralelo se as áreas de arquivo forem disjuntas. Arquivos compartilhados (`packages/shared/src/permissions.ts`, `packages/shared/src/index.ts`, `apps/web/src/App.tsx`, `apps/web/src/components/shell/nav.ts`, `apps/api/src/app.ts`) têm um único dono por onda. Relatório de agente é dado, não ordem: confira com `git diff --stat` e rodando os testes.
- **Economia de tokens:** testes em segundo plano com saída em arquivo e só o resumo (`grep -E "Test Files|Tests|FAIL"`); não cole spec, log ou diff inteiros na conversa; sugira `/clear` ao trocar de feature; não rode o `reviewer` em mudança trivial.

## 3. Onde estamos

- Repositório público: https://github.com/BRM-Solutions/ZELLO_CONDOMINIOS (organização BRM-Solutions; branch principal `main`).
- **PR #9** (somente documentação: decisões e specs) e **PR #10** (Onda 1: base visual e estrutura do condomínio) estão abertos, com CI verde, **ainda não mergeados**. Enquanto não forem, a `main` só tem o import inicial: trabalhe a partir de `git checkout feat/onda-1`.
- **Onda 1 (pronta, no PR #10):**
  - `apps/web`: tokens do mock, tema claro e escuro, 4 cores predefinidas, fontes locais, componentes base, shell do portal, vitrine só em desenvolvimento (`apps/web/design-system.html`).
  - `supabase/`, `apps/api`, `packages/shared`: blocos, unidades, pessoas (pré-cadastro), vínculos com histórico, papel `council`, `app.my_unit_ids()`, telefone cifrado com revelação auditada.
  - Verificação: lint e type-check limpos; shared 37, web 48, API 185 testes passando (incluindo integração no Postgres 17 local); revisão de segurança feita, sem achado crítico, achados corrigidos.
  - **Não verificado:** aparência em 320/375/414px e comparação lado a lado com o mock (ninguém abriu o navegador). Fazer pela opção 1 do VS Code (veja o guia).
- **Specs prontas:** `spec-design-system-base` (feita), `spec-estrutura-condominio` (feita), `spec-personalizador` (decidida, aguarda Onda 1 no ar), `spec-cadastro-moradores` (2.2: decidida, **pronta para aprovar e implementar**).
- Nada foi aplicado em dev ou produção. A migration `20261105202822_condominium_structure.sql` só vai ao dev pelo CI depois do merge na `main`.

## 4. Decisões já tomadas (onde estão)

- Conta = cliente que paga (administradora ou condomínio autogerido); `workspace` = condomínio: `docs/adr/0010-...md`.
- Papéis: `super_admin` (ZELLO, fora de `memberships`), `owner`, `admin` (administradora), `council` (conselho, só o seu condomínio), `manager` (síndico e subsíndico), `staff`, `member`: `docs/11-dominio.md` §3.
- Sem convites: pré-cadastro pela gestão e cadastro pelo morador em `/c/<slug>/cadastro`, com aprovação: `docs/11-dominio.md` §4 R6 e `docs/specs/spec-cadastro-moradores.md`.
- Dados como no protótipo do zip (unidade = bloco + número; pessoa = nome e e-mail, telefone/WhatsApp/foto opcionais; sem CPF). Comunicados e documentos: todo morador vê tudo. Ocorrências e reservas: regras do protótipo (R7, R8).
- Visual: só o design system do zip `docs/condominio-360-projeto-mock-v2.zip`, mais as extensões aprovadas (tema escuro, tokens `-strong`, 4 cores): `docs/13-design-system.md`.
- Personalizador: só `super_admin`, `owner` e `admin`; login por condomínio em `/c/<slug>/entrar`: `docs/specs/spec-personalizador.md`.
- E-mail via Resend. Administração (condomínios, usuários, auditoria) dentro do portal para `admin`. `super_admin` só acessa dado pessoal com motivo registrado na auditoria.

## 5. Próximos passos, em ordem

| # | O quê | Quem/como |
|---|---|---|
| 1 | Conferir o visual (320/375/414px e desktop, claro e escuro) e pedir ao Tiago o merge dos PRs #9 e #10 | Milena; Tiago autoriza o merge |
| 2 | Ambiente: projeto Supabase **dev** (não há como confirmar se existe), Resend (conta, domínio, SPF/DKIM), chaves `DATA_ENCRYPTION_KEY` e `DATA_HASH_KEY` no Easypanel dev e prod, secrets do CI. Veja `docs/09-deploy-easypanel-supabase.md`. Segredo nunca no chat nem no Git | Tiago/Milena |
| 2a | **PRIORIDADE (exigência do Tiago): automação total do banco.** O código/CI deve fazer sozinho tudo que toca o banco e o Supabase, para a Milena não mexer nele. **Já é automático:** migrations (`supabase link` + `supabase db push` no deploy dev, `.github/workflows/deploy.yml`). **Ainda é manual** (`docs/09-deploy-easypanel-supabase.md` §1 e §2.1): criar o projeto, definir a senha dos papéis `app_api` e `app_worker`, configurar Auth no painel (URLs, e-mail, política de senha) e montar a URL do pooler. Escrever `spec-automacao-banco` (`spec-writer`, Opus) cobrindo: bootstrap idempotente das senhas dos papéis no CI, `supabase config push` para o Auth, seed de dados fictícios só no dev, e verificação automática pós-deploy. Implementar com `builder` (Sonnet). Nenhuma senha em log, chat ou Git | spec-writer, depois builder |
| 3 | **Onda 2.2** implementar `spec-cadastro-moradores`: resumir a spec, obter aprovação, `builder` em `supabase/`, `apps/api`, `packages/shared` | `/spec-then-delegate` |
| 4 | **Onda 2.1** `spec-personalizador` (depende do 1A no ar; parte web usa o `BrandingContext` existente) | builder, depois reviewer |
| 5 | **Onda 2.3** escrever `spec-telas-acesso`: login real, recuperar senha, cadastro, `/moradores`, aprovações com contador de pendentes. Incluir a pendência da seção 6 sobre editar o próprio perfil | `spec-writer`, depois builder (`apps/web`) |
| 6 | **Onda 2.4** escrever `spec-backoffice-minimo`: condomínios, usuários, auditoria, `super_admin`. O Tiago pediu duas contas de super-admin **só para o banco local**; e-mails e senha foram combinados fora do repositório. Devem ficar **só em seed local não versionado** (arquivo ignorado pelo Git) que se recusa a rodar fora de `127.0.0.1`, porque o repositório é público | `spec-writer` |
| 7 | **Onda 3** (2 módulos por vez): `spec-comunicados` e `spec-ocorrencias` (3a); `spec-reservas` e `spec-documentos` (3b). Seguir as regras R7 e R8 e as telas do mock (`docs/referencias/condominio-360/src/routes/`) | `spec-writer` e builder |
| 8 | **Onda 4** `spec-painel` (agrega os quatro módulos; sem tabela própria) | idem |
| 9 | Depois: fornecedores, manutenção, ordens de serviço, obras, financeiro, plataforma. Decisões em aberto: `docs/plano-desenvolvimento-condominio-360.md` §8 itens 7 e 8 | planejar ao fim da Onda 4 |

Specs ficam prontas **uma onda à frente** da construção. Detalhe das ondas e do fechamento de cada uma: `docs/specs/README.md`.

## 6. Pendências e riscos conhecidos

- **Storage x `council`:** `app.can_access_object` não inclui `council` na leitura, então o conselho vê o arquivo mas não baixa. Corrigir com migration nova na spec de documentos (não editar a migration antiga).
- **Editar o próprio perfil:** o banco deixa o dono da linha em `people` alterar `access_status`, `status` e `user_id`. Quando existir a rota de "meu perfil" (2.3), usar lista fixa de campos e restringir por coluna no banco.
- **Fuso horário:** datas de negócio usam `America/Sao_Paulo` (fixado em `apps/api/src/db.ts`); o front deve enviar datas coerentes com isso.
- **Itens `[verificar]` da spec 2.2:** colunas de `auth.users` no Supabase hospedado, URLs de retorno `/c/**`, configuração de SMTP do Resend, rate limit com proxy.
- **Retenção de dados pessoais:** prazos e base legal pedem confirmação do jurídico (`docs/11-dominio.md` §6). O job de retenção da 2.2 só entra depois disso.
- **Dependabot:** 8 PRs abertos (#1 a #8). Recomendação: ignorar saltos grandes (TypeScript 6, Node 25, react-router 7) por ora e aceitar patch e minor num PR separado.
- **Sem login local:** o banco de teste local não tem o Supabase Auth. Login real exige o projeto Supabase dev (recomendado) ou o Supabase local com Docker.
- **Ambiente da Milena:** ela usa Windows, mas o Smart App Control bloqueia Git e `esbuild.exe`; ela **não desativou proteção** e trabalha no **GitHub Codespaces** (conta `milenaleiterj-source`, máquina de 2 núcleos, porta privada). Na `main` (`9533bab`) ela confirmou: instalação ok, `pnpm test:local` com 270 testes aprovados (shared 37, web 48, API 185) e vitrine aberta. Nunca peça para desligar antivírus ou proteção do Windows. Detalhes em `docs/GUIA-MILENA.md` seção 5.
- **Mock:** `docs/referencias/condominio-360/` é só leitura, cópia idêntica do zip. Não instale dependências lá nem copie código dele.

## 6b. Permissões, infra e quem decide

- **Repositório na organização BRM-Solutions** (transferido em 2026-11-10). A Milena é **colaboradora externa com função Admin somente neste repositório** e **não é membro da organização**: nunca a adicione como membro nem a um time, porque a permissão base da organização é "leitura" e ela passaria a ler os repositórios privados da empresa. A organização não tem secrets nem servidores de execução próprios; se a empresa criar secrets de organização ou um runner próprio com alcance "todos os repositórios", este repositório passa a enxergá-los (use alcance selecionado ou um grupo de runners separado).
- **`main` protegida** (ruleset `main-protegida`): só entra por Pull Request com o CI `verify` verde; sem push direto, sem force-push, sem apagar. Administradores podem ignorar a regra apenas via PR.
- **Ambiente `prod` no GitHub:** exige aprovação do Tiago e só publica a partir da `main`. Quem trabalha nunca dispara deploy em produção sozinho.
- A Milena conduz o desenvolvimento; o Tiago apoia as decisões de deploy, infra e segurança.
- **Supabase dev:** o Tiago cria a conta e o projeto (supabase.com, região South America/São Paulo, plano gratuito para dev) e cadastra as chaves como **Codespaces secrets do repositório** com `gh secret set <NOME> --app codespaces --repo <dono>/ZELLO_CONDOMINIOS`, digitando o valor no prompt. A Milena recebe como variáveis de ambiente no Codespace e **nunca** recebe senha por chat ou WhatsApp. O CI usa os secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD_DEV` e `SUPABASE_PROJECT_REF_DEV` (lista completa no `deploy.yml`).

## 7. Comandos úteis

| Para quê | Comando |
|---|---|
| Instalar | `pnpm install` |
| Lint e tipos | `pnpm lint` e `pnpm type-check` |
| Testes rápidos | `pnpm test` |
| Testes completos com banco local (Postgres 17 descartável) | `pnpm test:local` |
| Só conferir que o banco local sobe e as migrations aplicam | `pnpm test:db` |
| Build | `pnpm build` |
| Ver o visual sem login | VS Code > Executar e Depurar > "1. Ver o visual do sistema (sem login)" |

## 8. Convenções de Git

- Trabalho em branch (`feat/...`, `docs/...`) e PR; nunca push direto na `main`; commit e push só quando a Milena ou o Tiago pedirem.
- Mensagens de commit em inglês, estilo `tipo(escopo): título` no imperativo, **sem** linha de coautoria ou assinatura de IA (padrão do histórico até aqui, preferência do Tiago). Descrição de PR em português.
- Antes de commitar: conferir que não há segredo, `.env` ou dado real no diff.

## 9. Segurança e produção

- O repositório é **público**: tudo que for commitado fica visível. Nunca commitar segredo, chave, senha real ou dado pessoal real. `.env*` é bloqueado (só `.env.example`, com nomes).
- O repositório já contém o PDF do documento funcional assinado, estudos comerciais e o nome do síndico real no mock, por decisão do Tiago. Vale reavaliar a visibilidade antes de entrar cliente real.
- **Nunca tocar produção**: nada de migration, consulta que altera dado, deploy ou `supabase link` em prod sem confirmação humana explícita naquela mensagem. Deploy em prod só pela pessoa, em Actions > Deploy > Run workflow com `confirm=prod`.
- Dado pessoal (telefone, e-mail, dado financeiro) é LGPD: mínimo necessário, nunca em log, revelação auditada.

## 10. Prompt inicial sugerido (colar no Claude Code, em Opus)

> Leia `docs/HANDOFF.md` e siga a seção "Próximos passos". Eu sou a Milena e não programo: explique em português simples, uma pergunta por vez com recomendação. Planeje specs com o agente `spec-writer` (Opus) e construa sempre com o agente `builder` (Sonnet), nunca escrevendo código de feature na conversa principal. Comece me dizendo em que ponto estamos e qual é o próximo passo.
