# Spec — <Título>

> Salvar em `docs/specs/spec-<nome-kebab>.md`. Escrita pelo Opus depois de ler o código real.
> PRD: `docs/prd/<modulo>.md` — Status: rascunho | aprovada — Data: AAAA-MM-DD

## Objetivo
<!-- O que muda e por quê, em termos do problema do usuário. Citar o pedido original se ajudar. 3–6 linhas. -->

## Estado atual
<!-- O que existe hoje, com arquivo:linha. Ex.: `apps/api/src/modules/workspaces/routes.ts:42` — handler de listagem. -->
- `caminho/arquivo.ts:NN` —

## Modelo de dados
<!-- Migration nova `supabase/migrations/<AAAAMMDDHHMMSS>_<nome>.sql` (usar docs/templates/migration-template.sql). -->
- Tabelas/colunas, tipos, defaults e por que o default é seguro para dados existentes:
- RLS + policies (por papel):
- Índices (sempre `organization_id`, e o filtro principal):
- Expand/contract: é aditiva? Se remove/renomeia algo, em qual PR seguinte:

## Shared (`packages/shared`)
<!-- Schemas Zod e tipos novos. Nome do export. -->
- `packages/shared/src/<arquivo>.ts` —

## Backend (`apps/api`)
<!-- Arquivo por arquivo, com nomes reais de função. Rotas com método, caminho, papel exigido, erros. -->

| Método | Rota | Papel | Entrada (schema) | Saída | Erros |
|---|---|---|---|---|---|
|  | `/api/v1/...` |  |  |  |  |

- `apps/api/src/...:NN` —

## Frontend (`apps/web`)
<!-- Página/componente, estado (TanStack Query keys), formulários (react-hook-form + zod), onde entra na navegação. -->
- `apps/web/src/...` —
- Mobile 320–414px: o que muda no layout pequeno:

## Segurança e tenant
<!-- Quem pode o quê; como o tenant é garantido (withTenantTx + policy); dado pessoal exposto? audit_log? -->

## Fora de escopo
<!-- O que deliberadamente não será feito e por quê. -->
-

## DECIDIR
<!-- Decisões que só a dona pode tomar. Opções + recomendação. Não implementar enquanto aberto. -->
-

## Verificação manual
<!-- Passos concretos no ambiente DEV, com tenant de teste, terminando na limpeza dos dados criados. -->
1.

## Testes automatizados
<!-- Arquivos de teste e casos: feliz, sem permissão (403), outro tenant (404/vazio), validação (400). -->
- `apps/api/src/.../x.test.ts`:

## Critério de pronto
- [ ] Type-check e lint limpos.
- [ ] Testes listados acima passando (número real no relatório).
- [ ] Policy RLS testada com usuário de outro tenant.
- [ ] Tela conferida em 320px e desktop.
- [ ] Verificação manual executada e dados de teste apagados.
- [ ] Docs/`.env.example` atualizados se algo mudou.
