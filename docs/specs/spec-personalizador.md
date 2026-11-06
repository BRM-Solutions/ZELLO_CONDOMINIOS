# Spec — Personalizador do condomínio (marca e tema)

> PRD: decisões DS-1/DS-2 da dona (2026-11-05), registradas em [13-design-system](../13-design-system.md) §3.6 — Status: rascunho (bloqueado por DECIDIR-PZ) — Data: 2026-11-05
> Onda 2 ([roteiro](README.md)). Depende da Onda 1: [base visual](spec-design-system-base.md) (`BrandingContext`, predefinições em CSS) e `spec-estrutura-condominio.md` (cadastro do condomínio, endereço).
> Docs a ler para implementar: [13](../13-design-system.md), [02](../02-banco-de-dados.md) §"RLS", [05](../05-backend-api.md), [12](../12-storage-e-governanca.md), [06](../06-frontend.md), [07](../07-testes.md).

## Objetivo

Permitir que cada condomínio tenha o próprio portal (nome livre, logo, fotos, slogan, cor institucional, mosaico e tema padrão claro/escuro/sistema) sem mudar código, como o mock faz por tenant (`docs/referencias/condominio-360/src/lib/brand.ts:6-21`). No MVP, a marca do mock (Vila Gaudí) é cadastrada **como dado** por esta tela. Rodapé "uma plataforma ZELLO" é fixo.

## Estado atual

- `supabase/migrations/20261030120000_base_multitenant.sql:53-65` — `app.workspaces` (nome, `cnpj/city/state` de exemplo, status); sem campos de marca nem slug.
- `apps/api/src/modules/workspaces/routes.ts:11-23` — só `GET /workspaces` (paginado, `workspaces:read`); `repository.ts:31-40` lista sem marca.
- `packages/shared/src/permissions.ts:8-9` — `workspaces:write` (owner/admin) e `workspaces:update` (owner/admin/manager).
- `packages/shared/src/files.ts:4` — classificações `public | internal | confidential | personal`; fluxo de upload em `apps/api/src/modules/files/routes.ts:10-39` (init, complete, url, delete), só bucket `private-files`.
- [12](../12-storage-e-governanca.md) linha 59 e §"CDN e cache" — bucket opcional `public-assets` **só para logo/branding sem dado pessoal**, o único que pode ser público.
- Front (após Onda 1): `BrandingContext` com valor padrão neutro e `data-brand` no `<html>` ([spec da base visual](spec-design-system-base.md)).
- Referência de tela (zip): `docs/referencias/condominio-360/src/routes/plataforma/condominios.tsx:33-57` — formulário (nome oficial, nome do portal, cor institucional por amostras, pré-visualização com faixa da sidebar e rodapé "uma plataforma ZELLO").

## Modelo de dados

Migration nova `supabase/migrations/<timestamp>_workspace_branding.sql` (template `docs/templates/migration-template.sql`), aditiva:

- `app.workspace_branding` (1:1 com workspace): `workspace_id uuid pk`, `organization_id uuid not null`, FK composta `(organization_id, workspace_id) → app.workspaces`; `portal_name text null` (2–80), `slogan text null` (≤ 140), `color_preset text not null default 'verde' check in ('verde','azul','vinho','terracota')`, `mosaic boolean not null default false`, `default_theme text not null default 'light' check in ('light','dark','system')`, `logo_file_id`, `portal_photo_file_id`, `login_photo_file_id` (`uuid null`, FK para `app.files` do mesmo tenant), `updated_by uuid`, `created_at/updated_at`. Sem linha = padrão (verde, claro, sem imagens) — seguro para workspaces existentes.
- `app.workspaces.slug` (`text null`, `unique`, `^[a-z0-9-]{3,60}$`) — só se DECIDIR-PZ-1 = (a).
- RLS: `select` para quem tem o workspace em `app.workspace_ids()`; `insert/update` para os papéis de DECIDIR-PZ-2; sem `delete`. Índice em `organization_id`.
- Leitura pré-login (se PZ-1 = a/b): função `app.public_branding(p_slug text)` `security definer`, `set search_path = ''`, retornando **apenas** nome do portal, nome oficial, slogan, preset, mosaico, tema padrão e caminhos públicos das imagens de workspace ativo; `grant execute` só a `app_api`.
- Storage: bucket `public-assets` (público, `allowed_mime_types` png/jpeg/webp, `file_size_limit` 2 MB) criado na migration; imagens de marca com `classification = 'public'`. Ampliar o fluxo de `files` com finalidade `branding` → bucket `public-assets`; demais finalidades seguem em `private-files`. Policies de `storage.objects` para `public-assets`: escrita só via `app.can_access_object` com papel do PZ-2; leitura pública.

## Shared (`packages/shared`)

- `packages/shared/src/branding.ts` (novo): `COLOR_PRESETS`, `THEMES`, `brandingSchema` (saída), `updateBrandingSchema` (entrada: `portalName`, `slogan`, `colorPreset`, `mosaic`, `defaultTheme`, ids de arquivo), `publicBrandingSchema`. Export em `index.ts`.
- `permissions.ts`: `branding:update` com os papéis do PZ-2.

## Backend (`apps/api`)

| Método | Rota | Papel | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| GET | `/api/v1/workspaces/:workspaceId/branding` | membro do workspace | — | `brandingSchema` (padrão se não houver linha) | 404 outro tenant |
| PUT | `/api/v1/workspaces/:workspaceId/branding` | PZ-2 | `updateBrandingSchema` | `brandingSchema` | 400, 403, 404; arquivo de outro tenant ou não `available` = 400 |
| GET | `/api/v1/public/branding/:slug` | público (sem auth), rate limit | — | `publicBrandingSchema` | 404 (inexistente ou inativo — mesma resposta) |

- `apps/api/src/modules/branding/{routes,repository}.ts` (novo); `withTenantTx` nas rotas autenticadas; `audit_log` em `branding.update` com campos alterados (sem URLs).
- Upload de imagens pelo fluxo existente de `files` com finalidade `branding`.

## Frontend (`apps/web`)

- Tela `pages/configuracoes/PersonalizarPage.tsx`, rota `/o/:organizationId/configuracoes/personalizar`, item "Configurações" ([13](../13-design-system.md) §6.2) para os papéis do PZ-2. Layout do cartão "Novo condomínio" de `condominios.tsx:42-56`: `Card` + `CardTitle`, campos (`Field`), amostras das 4 cores (círculo 36 com borda 2 `--foreground` no selecionado; alvo 44 — exceção §8.1; rótulo acessível = nome da cor), interruptor "Mosaico" (`Switch`), seleção de tema padrão, três uploads no padrão de `AnexosPicker` (um arquivo cada) e **pré-visualização** ao vivo (faixa `--sidebar` com nome do portal em display e nome oficial; rodapé "uma plataforma ZELLO"), alternável entre claro e escuro.
- `BrandingContext` passa a buscar `GET .../branding` (query key com `orgId` + `workspaceId`); após salvar, invalida e reaplica `data-brand`/tema sem recarregar.
- Login: conforme PZ-1 (com slug, busca `GET /public/branding/:slug` e aplica marca e foto do login).
- Mobile: formulário e pré-visualização empilhados; amostras em linha com quebra.

## Segurança e tenant

- Só imagens de marca são públicas (bucket `public-assets`, classificação `public`); nada de dado pessoal nelas. A tela avisa: "Não envie fotos com pessoas identificáveis ou placas de veículos."
- Cor nunca é string livre: só id de predefinição validado por Zod e `check` no banco.
- Endpoint público expõe só campos de marca; 404 idêntico para inexistente e inativo (sem enumeração útil); rate limit.
- `audit_log` em toda alteração.

## Marca do MVP (Vila Gaudí, do mock)

Cadastrada pela tela no dev para teste e, em produção, pela pessoa responsável (o Claude não altera dado de prod):

| Campo | Valor (fonte) |
|---|---|
| Nome do portal | "Gaudí 360°" (`brand.ts:24`; nome livre, pode mudar) |
| Nome oficial | "Condomínio Vila Gaudí" (`brand.ts:24`) |
| Slogan | "Seu condomínio conectado a você." (`brand.ts:24`) |
| Endereço | "Rua Vereador Agostinho de Paula Santos, 548 — Piratininga, Niterói - RJ" (`brand.ts:25`) — campo do cadastro do condomínio |
| Cor / mosaico / tema | Verde / ligado / claro (`brand.ts:25`) |
| Logo | `logo-gaudi-mosaico.png` — **não está no zip** (só referência a armazenamento do Lovable, `src/assets/logo-gaudi-mosaico.png.asset.json`); `docs/Mosaic Tile Letter G.png` tem o mesmo tamanho exato (2.317.378 bytes) → DECIDIR-PZ-3 |
| Foto do portal / do login | `vila-gaudi-oficial.png` / `foto-vila-gaudi.png` — **não estão no zip nem em `docs/`** → DECIDIR-PZ-3 |

Imagens otimizadas antes do upload (logo ≤ 512 px, fotos ≤ 1600 px, WebP/PNG < 2 MB).

## Fora de escopo

Cor livre (só as 4 predefinições do mock), troca de fontes, domínio próprio por condomínio, área `/plataforma` (backoffice, PZ-2/P7 do PRD), pré-visualização de outras telas além da faixa da sidebar e do rodapé.

## DECIDIR

- **PZ-1 — Marca na tela de login.** O mock mostra logo, foto e nome do condomínio antes do login.
  - (a) **Recomendado:** endereço por condomínio com slug (`/c/vila-gaudi/entrar`) + endpoint público só de marca.
  - (b) Subdomínio por condomínio (`vila-gaudi.<dominio>`): exige DNS curinga e certificado no Easypanel `[verificar]`.
  - (c) Login genérico com a marca ZELLO; marca do condomínio só depois de entrar (foge do mock).
- **PZ-2 — Quem usa o personalizador.** (a) **Recomendado:** `owner`, `admin` (administradora; conselho conforme D2 de [11-dominio](../11-dominio.md)) e `super_admin`. (b) Também o síndico (`manager`).
- **PZ-3 — Imagens do Vila Gaudí.** Confirmar que `docs/Mosaic Tile Letter G.png` é o logo oficial e enviar as duas fotos (`vila-gaudi-oficial.png`, `foto-vila-gaudi.png`), por exemplo exportadas do projeto Lovable. Sem elas, o portal fica sem foto (o bloco é omitido) até o cadastro.

## Verificação manual

1. Dev, tenant de teste: como `admin`, abrir o personalizador, trocar as 4 cores, mosaico e tema padrão; a pré-visualização e o shell mudam sem recarregar.
2. Enviar logo e fotos; conferir que vêm do bucket `public-assets` e que o tamanho > 2 MB ou MIME fora da lista é recusado com mensagem no campo.
3. Como `member` e `staff`: sem item e 403 no `PUT`; `GET` funciona.
4. Usuário de outro tenant: `GET`/`PUT` = 404.
5. Login com slug (se PZ-1 = a): marca aplicada antes de entrar; slug inexistente = tela genérica sem erro técnico.
6. Preferência de tema do usuário vence o padrão do condomínio.
7. 320/375/414/1280px, claro e escuro. Apagar o tenant de teste e seus arquivos.

## Testes automatizados

- `apps/api/src/test/branding.test.ts`: GET padrão sem linha; PUT feliz (owner/admin); 403 `manager`/`staff`/`member` (conforme PZ-2); 404 outro tenant; 400 preset inválido, nome > 80, arquivo de outro tenant ou não `available`; `audit_log` gravado.
- `apps/api/src/test/branding-public.int.test.ts`: retorna só campos de marca; 404 igual para slug inexistente e workspace inativo.
- Catálogo RLS (`supabase/tests/catalog.sql`) continua verde com a tabela nova.
- `apps/web/src/pages/configuracoes/PersonalizarPage.test.tsx`: seleção de cor atualiza a pré-visualização; erro do servidor aparece no campo.

## Critério de pronto

- [ ] DECIDIR-PZ-1 a PZ-3 respondidos.
- [ ] Type-check e lint limpos; testes listados passando com números reais.
- [ ] RLS testada com usuário de outro tenant; endpoint público sem campo além da marca.
- [ ] Tela fiel a `condominios.tsx` (comparação lado a lado) e conferida em 320px e desktop, nos dois temas.
- [ ] Verificação manual executada e dados/arquivos de teste apagados.
