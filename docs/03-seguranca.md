# Segurança

> **Quando ler:** ao criar endpoint, policy, upload, integração/webhook, ao tocar dado pessoal, e antes de qualquer release para produção.
> **Resumo:**
> - Risco nº 1: um tenant ver ou alterar dado de outro (IDOR). Toda rota checa membership e papel no servidor; RLS repete a checagem; teste com dois tenants prova.
> - Toda borda é validada por Zod (corpo, query, params, headers, env, webhook, resposta de provedor). Nada que decide dinheiro ou permissão vem do cliente.
> - Segredo nunca no front, no repo, no log ou com default; produção não sobe sem os segredos obrigatórios.
> - Webhooks: autenticar, deduplicar, não confiar no corpo, responder rápido.
> - LGPD é requisito: minimizar, cifrar CPF/telefone, mascarar, auditar acesso, prazo de retenção.
> **Relacionados:** [arquitetura](01-arquitetura.md), [storage](12-storage-e-governanca.md), [banco](02-banco-de-dados.md), [backend](05-backend-api.md), [testes](07-testes.md), [lições](08-licoes-aprendidas.md), [workflow Claude](10-workflow-claude.md), `templates/pr-checklist.md`

## Modelo de ameaças (resumo)

| Ativo | Ameaça principal | Controle |
|---|---|---|
| Dados pessoais dos usuários finais (CPF, telefone, endereço, situação financeira) | Vazamento entre tenants, exportação indevida por usuário interno | Membership + RLS + FK composta; mascaramento; auditoria de revelação/exportação |
| Contas de usuário | Credential stuffing, sequestro de sessão, convite forjado | Supabase Auth, rate limit, MFA para papéis administrativos (DECIDIR), CSP |
| Dinheiro (boletos/PIX, quando houver) | Webhook forjado, valor adulterado pelo cliente, cobrança duplicada | Assinatura + reconsulta ao provedor + idempotência + CHECK |
| Infra e segredos | Chave vazada no repo/log/front, `service_role` exposta | Secret scanning, Zod no boot, papéis mínimos, rotação |
| Disponibilidade | Abuso de endpoint caro (OTP, IA, PDF), payload gigante | Rate limit, limite de corpo/arquivo, timeouts |
| Ameaça interna (admin da plataforma ou da organização) | Ação destrutiva ou consulta abusiva sem rastro | `audit_log`, papéis mínimos, ações sensíveis com confirmação |

## Checklist OWASP aplicado ao stack

| OWASP Top 10 | Regra aqui |
|---|---|
| A01 Controle de acesso | `authenticate` + `loadMembership` + `requirePermission`/`requireRole` (`apps/api/src/auth/require-role.ts`) em toda rota; RLS deny-by-default; 404 para recurso de outro tenant |
| A02 Falhas criptográficas | TLS em tudo; CPF/telefone cifrados (AES-256-GCM) + HMAC para busca; nada de hash puro de CPF |
| A03 Injeção | SQL sempre parametrizado (`$1`); identificador dinâmico só por allowlist; HTML sanitizado no ponto de gravação |
| A04 Design inseguro | Spec lista papéis, dados pessoais e abuso possível antes do código ([10](10-workflow-claude.md)) |
| A05 Configuração | `helmet`, CORS allowlist, Data API do Supabase desligada, rotas de dev bloqueadas em prod, erros sem stack |
| A06 Componentes vulneráveis | Lockfile congelado, `pnpm audit --prod` no CI, atualização mensal |
| A07 Autenticação | Supabase Auth, JWT verificado por JWKS (`iss`, `aud`, `exp`), rate limit, nada de auth mock em prod |
| A08 Integridade | Webhook assinado, CI com actions fixadas por versão, deploy só a partir da `main` |
| A09 Logs e monitoramento | `pino` com `redact`, `requestId`, `audit_log` para ações sensíveis e falhas de autorização |
| A10 SSRF | Servidor nunca busca URL informada pelo usuário; integrações têm host fixo em config |

## Autenticação

- Supabase Auth com e-mail/senha e magic link. A API só aceita `Authorization: Bearer <access_token>` e verifica com `jose` + JWKS (código em [01](01-arquitetura.md) §"Fluxo"). Nunca decodifique sem verificar; nunca aceite `alg: none` nem HS256 com segredo compartilhado.
- Configurar no painel (dev e prod): URLs de redirect permitidas só para os domínios do web; confirmação de e-mail ligada; senha mínima ≥ 10 caracteres; proteção contra senha vazada se o plano permitir [verificar]; rate limits de e-mail/OTP do Auth [verificar valores padrão].
- O access token vale até expirar (padrão de 1 h [verificar]); por isso papel e status vêm de `memberships` a cada requisição: revogar membership corta o acesso na próxima chamada.
- MFA: DECIDIR. Opções: (a) obrigatório para `owner`/`admin` (recomendado; eles veem dados de todos os usuários do tenant); (b) opcional para todos; (c) nenhum no MVP. O Supabase expõe o nível em `aal` no JWT; a API pode exigir `aal2` para rotas administrativas.
- Token no front: o supabase-js guarda a sessão em `localStorage` por padrão; qualquer XSS a rouba. Mitigação obrigatória: CSP estrita e nenhum `dangerouslySetInnerHTML` com conteúdo não sanitizado. Achado comum de auditoria: token de admin em `localStorage` sem CSP.
- Lição crítica: o login por código de verificação foi para produção com código fixo de mock. Regra: todo mock de autenticação/pagamento é ativado só por `NODE_ENV=test` e o `config.ts` derruba o boot se uma flag de mock estiver ligada em produção.

## Autorização (RBAC por membership)

- Matriz papel × ação vive na spec do módulo e vira testes. Papéis iniciais: `owner` > `admin` > `manager` (por workspace) > `staff` > `member`.
- Checagem no servidor em **todo** endpoint, inclusive leituras e listagens. Lição: uma listagem administrativa exigia só "estar logado" e devolvia dados de todos os organizadores a um papel de baixo privilégio.
- `organization_id` vem do membership validado, nunca do corpo. Ids no path são procurados com `where id = $1 and organization_id = $2` **e** passam pela RLS.
- Recurso de outro tenant → 404 (não 403). Papel insuficiente no próprio tenant → 403.
- Ações sobre membership: ninguém altera o próprio papel; só `owner` cria/remove `owner`; deve existir sempre ≥ 1 `owner` ativo (checar na transação).
- `member` normalmente só vê o que é dele: a policy da tabela precisa de um filtro pelo vínculo do usuário (ex.: tabela `<entidade>_members` + helper `app.my_<entidade>_ids()`), não só por workspace. O que é "dele" se define em [11](11-dominio.md) §3.
- Revelar dado completo (CPF, telefone), exportar lista e trocar configuração sensível são ações separadas, com papel próprio e `audit_log`. Achado comum de auditoria: troca de configuração sensível sem log dedicado.

## RLS como defesa em profundidade

- A API já filtra; a RLS existe para quando o handler errar. Por isso as policies nunca são `using (true)` para `app_api`.
- Data API (PostgREST) desligada nos dois projetos e schema `app` fora dos "exposed schemas". Padrão recorrente: grants para `anon`/`authenticated` sobrando de uma configuração antiga, sem uso, que só não vazam porque não há policy.
- `security definer` só nos helpers de [02](02-banco-de-dados.md), com `search_path = ''` e `execute` revogado de `public`.

## Testar isolamento entre tenants

Obrigatório em todo módulo novo ([07](07-testes.md) define a infraestrutura de teste).

1. **Nível API (supertest)**: cria organização A e B, usuário `ua` (membro de A) e `ub` (membro de B), um recurso de A. Para cada rota do módulo, `ub` com `X-Organization-Id: A` → 404; `ub` com header B tentando o id do recurso de A (GET, PATCH, DELETE) → 404; `ua` listando → não contém nada de B. Também: `member` não acessa rota de `admin` (403).
2. **Nível banco**: dentro de transação, `set local role app_api`, `set_config` com usuário de B e org A → `select count(*)` na tabela = 0; `insert` com `organization_id` de A → erro de RLS.
3. **Catálogo**: falha se alguma tabela de `app` não tiver RLS ou policy. No scaffold: `supabase/tests/catalog.sql` (deve retornar zero linhas, rodado contra o banco migrado) + a versão estática `apps/api/src/test/migrations.test.ts` (no `pnpm test`). O `deploy.yml` ainda **não** executa o `catalog.sql` após o `db push` (`DECIDIR` em [07](07-testes.md) §"Teste de migrations").

```sql
select c.relname as tabela_sem_protecao
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'app' and c.relkind = 'r'
  and (not c.relrowsecurity
       or not exists (select 1 from pg_policies p where p.schemaname = 'app' and p.tablename = c.relname));
```

4. Testes de banco também podem ser escritos em pgTAP e rodados com `supabase test db` (arquivos em `supabase/tests/`).

## Validação nas bordas (Zod)

- Corpo, query, params e headers usados pela rota passam por schema de `@app/shared` com `.strict()` (rejeita campo extra) e limites (`max` em strings e arrays).
- `express.json({ limit: "64kb" })`; rota que precisa de mais declara o próprio limite.
- URLs aceitas só `https:` (`z.string().url().refine(u => u.startsWith("https://"))`). Lição: um schema de URL aceitava `javascript:` e `data:`.
- Valores calculados (total, juros, multa, saldo) são recalculados no servidor; o que vier do cliente é ignorado.
- Env validado por Zod no boot com `superRefine` de produção: segredo obrigatório sem default. Lições: chave de cifragem com default público e segredo de webhook opcional em produção (achados típicos de auditoria).
- Resposta de provedor externo também é validada antes de usar.

## HTML e uploads

- HTML de usuário (avisos, comunicados): sanitizar com `sanitize-html` num **ponto único** de gravação, allowlist pequena de tags e nenhum atributo (`allowedAttributes: {}`), `disallowedTagsMode: "discard"`. O front só renderiza o que veio sanitizado. Preferir texto puro ou markdown restrito quando bastar.
- Uploads: o dono do assunto é [12](12-storage-e-governanca.md) (fluxo, policies de `storage.objects`, credenciais, retenção, legal hold, quarentena, testes). Aqui ficam só as regras de ameaça:
  - MIME do cliente é mentira fácil: allowlist **e** magic bytes (`file-type`) no `complete`; tamanho limitado na API, no bucket e no plano. Imagem que vai a outros usuários é reencodada (`sharp`, descarta EXIF com localização).
  - O front tem publishable key + JWT e pode chamar o Storage direto: as policies de `storage.objects` são a barreira real, não a API.
  - Nome do objeto gerado pelo servidor (`<organization_id>/<workspace_id|org>/<file_id>/<nome-sanitizado>`); nome original só em coluna.
  - Bucket privado; URL assinada de 60–300 s, auditada, nunca em log; `Content-Disposition: attachment` para tipos que o navegador executaria. Nunca URL pública de dado `confidential|personal`.
  - Antivírus e backup de objetos: `DECIDIR` em [12](12-storage-e-governanca.md).
- Nunca buscar no servidor uma URL informada pelo usuário (lição: SSRF confirmado num campo de URL de logo usado para gerar PDF). Se precisar de imagem externa, o usuário faz upload.

## Headers, CORS e rate limiting

- API: `app.disable("x-powered-by")`, `helmet()`; `app.set("trust proxy", 1)` atrás do proxy do Easypanel para o IP real chegar ao rate limit [verificar número de hops].
- Web (nginx, `apps/web/nginx.conf`): CSP mínima; ajuste só o necessário. Texto atual do scaffold:
  `default-src 'self'; script-src 'self' 'sha256-<hash do script inline de tema>'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: <VITE_SUPABASE_URL>; font-src 'self' data:; connect-src 'self' <VITE_API_URL> <VITE_SUPABASE_URL>; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`
  + `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. As URLs entram no build (placeholders `__API_URL__`/`__SUPABASE_URL__` substituídos no Dockerfile).
  - `script-src` continua sem `'unsafe-inline'`: o único script inline (tema, em `index.html`) entra por hash; mudou o script, recalcule (o teste `apps/web/src/csp.test.ts` falha).
  - `style-src 'unsafe-inline'` é **exceção consciente**: o `sonner` injeta `<style>` em runtime. Risco residual baixo (CSS inline não executa script), mas permite injeção de CSS. `DECIDIR:` manter (recomendado enquanto usar `sonner`) ou trocar por toast próprio e voltar a `style-src 'self'`. Nunca estender `'unsafe-inline'` para `script-src`.
- CORS: `origin` = lista exata de `WEB_ORIGIN` (separada por vírgula), sem `*`, sem refletir o `Origin` recebido; `credentials: false` (auth por Bearer, não cookie); `exposedHeaders: ["X-Request-Id"]`.
- Rate limit global por IP + limites mais duros em: convite, reenvio de magic link/OTP, exportação, geração de PDF, qualquer rota que chame IA ou provedor pago. Lição: criação de desafio de verificação sem rate limit era vetor de abuso e custo.
- Rate limit em memória (`Map`) não funciona com várias réplicas. DECIDIR: (a) `express-rate-limit` com store em Postgres (recomendado no início, sem infra nova); (b) Redis quando houver Redis por outro motivo; (c) memória só enquanto houver 1 réplica, documentado.

## Segredos

- Nunca no front: o web só recebe `VITE_API_URL`, `VITE_SUPABASE_URL` e a chave pública (anon/publishable). A chave pública é segura **porque** a Data API está desligada e a RLS nega tudo a `anon`.
- `service_role`/secret key do Supabase: nunca no front, nunca na API de requisição; só em CI/operação manual quando estritamente necessário.
- Nunca no repo: `.env` no `.gitignore`; `.env.example` só com nomes e placeholders. Lição: uma credencial real de broker foi commitada no `.env.example` e ficou no histórico; precisou rotação. Rodar secret scanning (ex.: gitleaks) no CI e no pre-commit.
- O Claude não lê `.env`: `.claude/settings.json` nega `Read(.env*)`, `Read(.secrets/**)` e chaves; ver [10](10-workflow-claude.md). Nunca peça para colar segredo no chat.
- Rotação: inventário de segredos em [09](09-deploy-easypanel-supabase.md) com dono e data; rotacionar ao sair alguém com acesso, a cada incidente e no mínimo anualmente. Segredo vazado: rotacionar primeiro, investigar depois.
- Comparação de token/segredo sempre em tempo constante (`timingSafeEqual` sobre hashes de mesmo tamanho).

## Criptografia de campos sensíveis

- Disco do banco é cifrado pelo provedor [verificar], mas isso não protege contra dump, log ou acesso SQL indevido.
- CPF, telefone e outros identificadores: AES-256-GCM na API (`node:crypto`), chave `DATA_ENCRYPTION_KEY` (32 bytes, env), formato `v1:<iv>:<tag>:<ciphertext>` para permitir rotação por versão. Busca por igualdade via HMAC-SHA256 com chave separada (`DATA_HASH_KEY`).
- DECIDIR: cifrar na API (recomendado: chave nunca chega ao banco nem a logs de query) vs `pgp_sym_encrypt` no SQL (mais simples, mas a chave trafega como parâmetro de query).
- Respostas retornam o dado mascarado; o endpoint que revela o completo é separado, restrito e auditado.

## Webhooks

1. Autenticar antes de tudo: assinatura HMAC do corpo bruto (`express.raw` só nessa rota), mTLS ou token, conforme o provedor; segredo **obrigatório** em produção (boot falha sem ele).
2. Anti-replay: rejeitar timestamp fora de ±5 min quando o provedor assina tempo; deduplicar por id do evento (`app.inbound_events` com UNIQUE).
3. Não confiar no corpo: reconsultar o provedor para status/valor; conferir valor recebido = valor esperado.
4. Responder 2xx rápido; processar assíncrono. Fluxo completo: [01](01-arquitetura.md) §"Integrações".

## Logs, auditoria e erros

- `pino` com `redact` para `authorization`, cookies, `cpf`, `phone`, `email`, `password`, `token` e qualquer campo marcado como PII. Nunca logar corpo de requisição inteiro nem payload de webhook em claro.
- Erro 500 devolve mensagem genérica + `requestId`; stack só no log.
- `audit_log` registra: mudanças de membership/papel, revelação/exportação de dado pessoal, configuração sensível, ações destrutivas, negações de autorização repetidas. Achado comum de auditoria: falha de login sem rastro (no Supabase, usar também os logs de Auth).

## LGPD

- Papéis [verificar com jurídico]: o tenant (cliente do SaaS) tende a ser **controlador** dos dados dos usuários finais e o SaaS **operador**; o SaaS é controlador dos dados das contas dos próprios clientes. Isso define contrato (DPA) e responsabilidades.
- Base legal por finalidade, registrada na spec: execução de contrato, obrigação legal (ex.: registros financeiros), legítimo interesse (com teste de balanceamento). Consentimento só quando nenhuma outra base cabe.
- Minimização: não coletar CPF/data de nascimento sem finalidade escrita na spec.
- Situação financeira (dívida, atraso) é dado sensível na prática: nunca expor a outros usuários finais. DECIDIR com jurídico o que pode aparecer em relatórios compartilhados [verificar].
- Direitos do titular (art. 18): acesso, correção, anonimização/eliminação, portabilidade, informação sobre compartilhamento. Ter fluxo para atender (mesmo que manual no início) com prazo; resposta completa em até 15 dias [verificar].
- Incidente com risco relevante: comunicar ANPD e titulares; prazo de 3 dias úteis pela Resolução CD/ANPD nº 15/2024 [verificar]. Manter registro de incidentes mesmo sem comunicação.
- Encarregado (DPO): exigido em regra; agente de pequeno porte pode ter dispensa (Resolução CD/ANPD nº 2/2022), mas precisa de canal de contato [verificar]. DECIDIR quem é.
- Retenção e anonimização: [02](02-banco-de-dados.md) §"LGPD no schema". Arquivos (classificação, retenção, legal hold, eliminação a pedido do titular por purga auditada): [12](12-storage-e-governanca.md) §"Governança".
- Exclusão de organização x trilha de auditoria: no scaffold, `audit_log` cai em cascata com a organização (necessário para a limpeza de testes). `audit_log` não guarda PII, então a LGPD não exige apagá-lo junto; perder a trilha é que é risco (prova de acesso/alteração). `DECIDIR` antes do go-live, recomendação em [02](02-banco-de-dados.md) §"Modelo base multi-tenant" (trocar para `set null` + `workspaces` `restrict`).

## Incidentes e backups

- Runbook mínimo: conter (revogar chave/sessão, desligar rota), preservar logs, avaliar dados afetados por tenant, comunicar (cliente controlador, ANPD quando cabível), corrigir, registrar lição em [08](08-licoes-aprendidas.md).
- Backups e restore testado: [02](02-banco-de-dados.md) §"Backups".

## Dependências e supply chain

- `pnpm install --frozen-lockfile` no CI; lockfile sempre commitado; versões exatas para pacotes críticos.
- `pnpm audit --prod` no CI (informativo no PR, bloqueante para crítico/alto antes de release); Dependabot ou Renovate semanal.
- Revisar pacote novo: manutenção, downloads, scripts de `postinstall`; preferir o que já está no stack.
- GitHub Actions fixadas por versão (ou SHA) e com `permissions:` mínimas.

## Checklist de revisão antes de produção

- [ ] Data API desligada; schema `app` não exposto; nenhum grant para `anon`/`authenticated` em `app`.
- [ ] Teste de catálogo (RLS + policy em toda tabela) verde; testes de isolamento A/B em todo módulo.
- [ ] Toda rota com `authenticate`, `loadMembership` (ou isenção justificada) e papel mínimo.
- [ ] Nenhum mock/simulação ativável em produção; rotas de dev bloqueadas por `NODE_ENV` e por flag.
- [ ] Boot falha sem segredos obrigatórios; nenhum segredo com default; `.env.example` só placeholders; secret scanning ativo.
- [ ] `service_role` ausente de API, worker e web.
- [ ] CORS allowlist, `helmet`, CSP no nginx, HSTS, `trust proxy` correto.
- [ ] Rate limit em auth/OTP/convite/exportação/rotas caras, com store compartilhado se houver mais de uma réplica.
- [ ] Uploads conforme o checklist de go-live de [12](12-storage-e-governanca.md) (bucket privado, policies sem update, secret key só no worker, URL ≤ 300 s, magic bytes).
- [ ] Webhooks com assinatura obrigatória, deduplicação e reconsulta.
- [ ] Logs com `redact` verificado (procurar CPF/telefone/token num log real de dev).
- [ ] PII inventariada, cifrada, mascarada, com retenção definida; fluxo de direitos do titular e canal do encarregado publicados.
- [ ] Backup/PITR ligado em prod e um restore testado.
- [ ] `pnpm audit --prod` sem crítico/alto.
- [ ] Redirect URLs do Supabase Auth só com domínios próprios; MFA decidido para papéis administrativos.
