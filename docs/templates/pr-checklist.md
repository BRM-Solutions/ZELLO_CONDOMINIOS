# Checklist de PR

> Usado pelo agente `reviewer` e pela skill `/security-review-lite`. Marque N/A quando não se aplica.
> Antes do primeiro deploy em produção (e a cada mudança de auth/infra), rode também o "Checklist de revisão antes de produção" de [03-seguranca.md](../03-seguranca.md). Este arquivo é o recorte por PR.

## Segurança
- [ ] Nenhum segredo, token, senha, connection string ou dado real no diff (inclui testes e fixtures).
- [ ] Toda entrada nova validada com Zod na borda (body, params, query, webhook).
- [ ] Rotas novas atrás de `authenticate` + `loadMembership`; checagem de papel explícita.
- [ ] Erros no formato `{ error: { code, message } }` sem stack/SQL vazando.
- [ ] Nada de `service_role`/secret key na API de requisição ou no web; `VITE_*` só com valor público.
- [ ] SQL parametrizado (`$1`), nunca concatenação de string.
- [ ] Upload/arquivo ([12](../12-storage-e-governanca.md)): bucket privado, MIME/tamanho/quota validados na API, binário direto ao Storage, URL assinada ≤ 300 s e fora de log.
- [ ] Storage: API usa JWT do usuário + publishable; `SUPABASE_SECRET_KEY` só no worker; policies de `storage.objects` sem UPDATE; nenhum grant novo a `authenticated` além de `app.can_access_object`.
- [ ] Arquivo: `classification` definida, `audit_log` (`file.upload_init|complete|download|delete|purge`), delete respeita `legal_hold`/`retention_until`.
- [ ] Webhook: assinatura verificada + idempotência por id do evento.
- [ ] Log sem CPF, telefone, e-mail completo ou token.

## Multi-tenant
- [ ] Toda query de negócio dentro de `withTenantTx`.
- [ ] Tabela nova com `organization_id` (e `workspace_id` se aplicável), RLS ligada, policies, índice.
- [ ] Policies usam `(select app.current_user_id())`/`app.current_org_id()`, nunca `auth.uid()`; `to app_api`.
- [ ] Tabela com dado pessoal filtra pelo vínculo do usuário para `member` (não só por workspace).
- [ ] Teste de catálogo (tabela de `app` sem RLS/policy) continua passando.
- [ ] Teste com usuário de **outro tenant** retorna 404/vazio, não 403 com dado (inclui objeto no Storage: `app.can_access_object` = false).
- [ ] Nenhum `id` vindo do cliente é usado sem conferir que pertence ao tenant.
- [ ] `audit_log` em ação sensível (financeiro, papel, exclusão, export de dados pessoais).

## Banco / migration
- [ ] Migration nova com timestamp e `set lock_timeout`; nenhuma migration antiga editada; sem senha nem dado real.
- [ ] Aditiva (expand); remoção/rename só em PR posterior (contract).
- [ ] Defaults seguros para linhas existentes; `not null` em coluna nova tem default ou backfill.
- [ ] Índice criado para o filtro/join novo; `create index concurrently` fora de transação se tabela grande `[verificar suporte no db push]`.
- [ ] Grants explícitos para `app_api`/`app_worker` só no necessário.

## Design system (regra dura, [13](../13-design-system.md))
- [ ] Tela parte da rota equivalente do mock; layout, rótulos, ícones e status iguais.
- [ ] Só tokens de [13](../13-design-system.md) §3; nenhuma cor/raio/sombra/fonte nova; nenhuma cor literal fora de `tokens.css`.
- [ ] Componentes de [13](../13-design-system.md) §5 sem variante nova; divergências só as da §8 (outra = `DECIDIR-DS` aprovado).
- [ ] Sem Tailwind, shadcn/Radix, `cva` ou código copiado do mock; sem dados demonstrativos.
- [ ] Comparação lado a lado com o mock (375px e ≥ 1280px) anexada ou declarada "não verificada".

## Frontend / mobile
- [ ] Conferido em 320px, 375px, 414px e desktop; sem scroll horizontal.
- [ ] Grids com `minmax(0, 1fr)` e `min-width: 0`; textos longos quebram/truncam.
- [ ] Fonte >= 12px; alvos de toque >= 44px.
- [ ] Estados de carregando, vazio e erro; mensagens em pt-BR.
- [ ] Sem dado de outro papel exposto na UI (ex.: `member` vendo débito de outro usuário).

## Testes
- [ ] Teste do caso feliz, sem permissão, outro tenant, entrada inválida.
- [ ] Testes criam e apagam o próprio tenant; nunca dependem de dado de prod.
- [ ] Resultado real informado (`Tests N passed`).

## Geral
- [ ] Diff limitado ao escopo da spec; nada de refatoração não pedida.
- [ ] Comentários só onde não-óbvio.
- [ ] `.env.example` e docs atualizados se mudou variável/fluxo.
- [ ] CI verde.
