# Spec — Base visual do design system (tokens, fontes, componentes e shell do portal)

> PRD: não se aplica (fundação técnica; origem: [plano](../plano-desenvolvimento-condominio-360.md) §6 Fase 0 item 4) — Status: rascunho com decisões DS-1 a DS-4 tomadas (aguarda aprovação para implementar) — Data: 2026-11-05
> Regra que governa: [13-design-system](../13-design-system.md) (REGRA DURA). Docs a ler para implementar: [13](../13-design-system.md), [06](../06-frontend.md), [04](../04-boas-praticas.md) §"Dependências", [07](../07-testes.md).

## Objetivo

Trocar a aparência genérica do scaffold pela base visual do mock Condomínio 360 / ZELLO, para que toda spec de módulo seguinte (onboarding, comunicados, ocorrências, reservas, documentos) apenas componha peças já fiéis ao design system. Entrega: tokens exatos do mock (tema claro) + tema escuro aprovado, motor de tema (claro/escuro/sistema) e de marca (predefinições de cor do personalizador), fontes servidas pelo próprio app, componentes base, shell do portal (sidebar, topbar, drawer, bottom nav) e uma vitrine `/design-system` somente em desenvolvimento para conferência lado a lado com o mock. Nenhuma regra de negócio nem endpoint novo.

## Estado atual

- `apps/web/src/tokens.css:1-44` — paleta azul genérica (`--color-*`) com tema claro/escuro; nenhum valor do mock.
- `apps/web/src/styles.css:1-304` — tokens de espaço/raio/fonte (`:2-13`, `--font-sans` system-ui em `:9`, `--radius: 10px` em `:8`) e classes do scaffold: `.shell`, `.header`, `.nav*`, `.button*`, `.card`, `.page-head`, `.field*`, `.login`, `.state`, `.grid`; breakpoint único `720px` (`:265`).
- `apps/web/src/components/Shell.tsx:8-79` — header único com marca `{{PROJETO}}`, alternância de tema (`:22-29`), menu hambúrguer, links "Workspaces"/"Organização" (`:41-48`), seletor de organização (`:49-65`), e-mail e "Sair".
- `apps/web/src/App.tsx:11-33` — rotas `/login`, `/o/:organizationId` (Dashboard) e `/o/:organizationId/organizacao` (owner/admin).
- `apps/web/src/pages/LoginPage.tsx` (74 linhas), `DashboardPage.tsx` (41), `OrganizationPage.tsx` (8) — usam as classes de `styles.css`.
- `apps/web/src/hooks/useTheme.ts:19-36` — alterna `data-theme` e persiste em `localStorage`.
- `apps/web/index.html:8` — script inline que aplica o tema salvo; hash na CSP em `apps/web/nginx.conf:21`, conferido por `apps/web/src/csp.test.ts:7-15`.
- `apps/web/nginx.conf:21` — `font-src 'self' data:` (CDN de fontes bloqueada).
- `apps/web/src/main.tsx:28` — `<Toaster position="top-center" richColors />` (o mock usa `top-right` + `richColors` com classes próprias: `docs/referencias/condominio-360/src/routes/__root.tsx:125`, `components/ui/sonner.tsx`).
- `apps/web/src/hooks/useCan.ts:4-7` e `packages/shared/src/permissions.ts:3-13` — matriz de permissões usada pelos guards.
- `apps/web/package.json` — já tem `lucide-react` e `sonner`.
- `apps/web/src/assets/fonts/` — **já baixados** (2026-11-05): `figtree-latin-{400,500,600,700}-normal.woff2`, `dm-serif-display-latin-400-normal.woff2` (de `@fontsource/*` 5.3.0) e `OFL-Figtree.txt`, `OFL-DMSerifDisplay.txt`.
- Referência visual: **somente** o conteúdo de `docs/condominio-360-projeto-mock-v2.zip`, lido pela cópia idêntica `docs/referencias/condominio-360/` — `src/styles.css`, `components/vg/ui.tsx`, `components/vg/AppShell.tsx`, `components/ui/dialog.tsx`, `components/ui/switch.tsx`, `components/ui/sonner.tsx`, `routes/design-system.tsx`, `routes/index.tsx` (detalhado em [13](../13-design-system.md) §1). Imagens/PDFs soltos em `docs/` não são referência.

## Modelo de dados

Nenhuma migration. Os dados de marca do condomínio são persistidos pela [spec do personalizador](spec-personalizador.md) (Onda 2); aqui o front já lê marca de um contexto com valores padrão.

## Shared (`packages/shared`)

Nenhuma mudança. A navegação usa `Permission`/`can` existentes (`packages/shared/src/permissions.ts:15-23`).

## Backend (`apps/api`)

Nenhuma mudança.

## Frontend (`apps/web`)

### Tokens e CSS
- `apps/web/src/tokens.css` — reescrever com **exatamente** os tokens de [13](../13-design-system.md) §3.1–3.3 (nomes sem prefixo `--color-`). Único arquivo com cor literal. Inclui os tokens `-strong` (§3.1), a paleta escura em `:root[data-theme="dark"]` e em `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` (§3.2.1, padrão de [06](../06-frontend.md)), e as 4 predefinições de cor em `:root[data-brand="azul|vinho|terracota"]` (+ variantes escuras) trocando só `--primary`, `--primary-foreground` (escuro) e `--sidebar` (§3.6). Verde = sem atributo.
- `apps/web/src/styles.css` — base: fontes (§3.4), escala tipográfica, `h1/h2` display, foco visível com `--ring`, utilitários de layout já existentes que continuam úteis, `prefers-reduced-motion`. Remover `--font-sans` system-ui e `--radius: 10px` (substituídos pelos tokens do mock).
- `apps/web/src/styles/components.css` (novo) — classes dos componentes base (`.card`, `.card-title`, `.badge--{tone}`, `.btn--{variant}`, `.btn--{size}`, `.field`, `.input`, `.page-title`, `.progress`, `.date-chip`, `.stat-card`, `.list-card`, `.alert`, `.modal`, `.empty-state`, `.skeleton`), com as exceções de [13](../13-design-system.md) §8.1–8.2 (44px mobile-first; volta a 32/40 em `(min-width: 1024px) and (pointer: fine)`; input 16px abaixo de 1024).
- `apps/web/src/styles/shell.css` (novo) — sidebar, drawer, topbar, bottom nav ([13](../13-design-system.md) §6.1). Breakpoints 768 e 1024 (o `720px` atual sai).
- Atualizar seletores das páginas existentes para as novas classes; nenhuma classe antiga órfã.

### Fontes
- `@font-face` em `styles.css` apontando para os arquivos já presentes em `apps/web/src/assets/fonts/` (Vite gera hash; CSP `font-src 'self'` atende), `font-display: swap`. **Sem dependência npm nova.** Licença OFL 1.1 aceita (DS-4) e registrada em [04](../04-boas-praticas.md) §"Dependências"; manter os `OFL-*.txt` junto dos arquivos.

### Componentes (`apps/web/src/components/ui/`)
Anatomia e medidas: [13](../13-design-system.md) §5. Sem dependência nova; sem `cva`.
- `Card.tsx` — `Card`, `CardTitle` (ícone opcional, título, ação).
- `Badge.tsx` — `tone: "success" | "warning" | "danger" | "info" | "neutral"`.
- `Button.tsx` — `Button`, `IconButton` (só ícone, `aria-label` obrigatório), `variant: "primary" | "accent" | "outline" | "ghost" | "danger"`, `size: "sm" | "md" | "lg"`, `loading` (desabilita, `aria-busy`, spinner 16px). Também `ButtonLink` para navegação (`<Link>` com as mesmas classes; ação = `button`, navegação = `a`).
- `Field.tsx` — `Field` (label, campo, mensagem de erro com `aria-describedby`/`aria-invalid`), integrável com react-hook-form (`forwardRef` no input).
- `PageTitle.tsx`, `Progress.tsx`, `DateChip.tsx`.
- `StatCard.tsx` e `ListCard.tsx` — padrão de `ListPage.tsx` do mock (estatísticas + lista com badge), recebendo dados por props.
- `Alert.tsx` — faixa de aviso da página e erro de formulário.
- `Modal.tsx` e `ConfirmDialog.tsx` — visual de `components/ui/dialog.tsx` do zip ([13](../13-design-system.md) §5, linha `Modal`), implementado à mão sem Radix: foco preso, `Esc` fecha, devolve foco, `role="dialog"` + `aria-modal` + título ligado por `aria-labelledby` ([06](../06-frontend.md) §"Componentes base").
- `Switch.tsx` — visual de `components/ui/switch.tsx` do zip, sobre `<button role="switch" aria-checked>`; área clicável = linha com rótulo ≥ 44px ([13](../13-design-system.md) §8.1).
- `States.tsx` — `EmptyState`, `LoadingRows`, `ErrorState` (mensagem + "Tentar de novo").
- Ícones `lucide-react` com `aria-hidden` quando decorativos.

### Shell do portal (`apps/web/src/components/shell/`)
- `nav.ts` — tabela única com **todos** os itens de [13](../13-design-system.md) §6.2 na ordem do mock: `{ key, label, segment, icon, permission, available }`. `available: false` para módulos ainda não implementados (não aparecem). Nesta spec ficam disponíveis apenas:
  - "Painel Geral" (`Home`) → `/o/:organizationId` (página atual `DashboardPage`), permissão `organization:read`.
  - "Configurações" (`Settings`) → `/o/:organizationId/organizacao` (página atual `OrganizationPage`), permissão `organization:manage` — substitui o link "Organização" de `Shell.tsx:44-48`, usando o rótulo/ícone do mock mais próximo, até a spec de configurações.
  - Função pura `visibleNavItems(role)` filtrando por `available && can(role, permission)`.
- `AppShell.tsx` — substitui `components/Shell.tsx` (mesmo papel de layout com `<Outlet />`): sidebar ≥ 1024, drawer < 1024 (fecha por botão, overlay, `Esc` e navegação; `aria-expanded`/`aria-controls`), topbar (pílula ≥ 1024 com dia da semana e data em pt-BR; barra cheia < 1024), bottom nav < 1024 mostrando só os itens da bottom nav do mock que estiverem disponíveis (nesta spec: Início; sem itens disponíveis suficientes, a bottom nav não é renderizada e o conteúdo não reserva a folga de 112px).
- `apps/web/src/contexts/BrandingContext.tsx` (novo) — `BrandingProvider` + `useBranding()` com o tipo `Branding { portalName, legalName, address, slogan, logoUrl, portalPhotoUrl, loginPhotoUrl, colorPreset: "verde" | "azul" | "vinho" | "terracota", mosaic, defaultTheme: "light" | "dark" | "system" }`. Nesta spec a fonte é um valor padrão neutro (`colorPreset: "verde"`, sem logo/fotos, `defaultTheme: "light"`, nomes = nome do workspace/organização já disponível); a spec do personalizador troca a fonte pela API sem mudar os consumidores. Aplica `data-brand` no `<html>`. **Nenhum nome de condomínio fixo no código.**
- `Brand.tsx` — logo (sem logo: círculo `--primary` com inicial), nome do portal e nome oficial vindos de `useBranding()`. Rodapé da sidebar: foto só se houver; texto fixo "uma plataforma ZELLO".
- `UserMenu.tsx` — avatar com iniciais do e-mail (nome real chega na spec de perfil), "Meu perfil" (indisponível ainda: não renderizar), seletor de organização ativa (move o `select` de `Shell.tsx:49-65`, estilizado como `Field`), "Sair" em `--destructive` (usa `signOut` de `AuthContext`).
- `NotificationBell.tsx` — **não** entra nesta spec (sem módulo de notificações; plano §3 "depois").
- Tema: `useTheme` (`hooks/useTheme.ts`) passa a ter `"light" | "dark" | "system"`; preferência do usuário em `localStorage` (com `try/catch`) sobrescreve `branding.defaultTheme`; `system` remove `data-theme`. Escolha no menu do usuário ("Aparência: Claro / Escuro / Sistema", `select` no visual de `Field`). O script inline do `index.html` continua aplicando a preferência salva antes do React; se o script mudar, recalcular o hash em `nginx.conf:21` (`csp.test.ts` confere).

### Páginas
- `LoginPage.tsx` — layout de [13](../13-design-system.md) §6.4 sem o bloco de demonstração; coluna da foto só se houver foto (sem foto: coluna única centralizada). "Esqueci minha senha" fica fora (spec de recuperação de senha).
- `DashboardPage.tsx` e `OrganizationPage.tsx` — só trocam para `PageTitle`/`Card`/`ListCard`/estados; mesmo conteúdo e mesmas queries.
- `pages/DesignSystemPage.tsx` (novo) — vitrine equivalente a `docs/referencias/condominio-360/src/routes/design-system.tsx` com os componentes reais (cores, tipografia, botões, status, progresso, formulários, data, modal, interruptor), com seletores de tema e de predefinição de cor para conferir as 8 combinações. Rota registrada **somente** quando `import.meta.env.DEV` (fora do bundle de produção via import dinâmico condicionado).
- `main.tsx` — `Toaster` igual ao do mock: `position="top-right"`, `richColors` e `toastOptions.classNames` equivalentes às de `components/ui/sonner.tsx` (fundo `--background`, texto `--foreground`, borda, `--shadow-lg`, ação `--primary`, cancelar `--muted`).

### Mobile 320–414px
Sidebar vira drawer; topbar com logo 32 + nome display 20 truncado (`min-width: 0`, `text-overflow: ellipsis`); grades de cartões em `minmax(0, 1fr)`; botões/itens ≥ 44px; nenhum texto < 12px; inputs 16px. Nome de condomínio/organização de 200 caracteres não estoura header, drawer nem menu.

## Segurança e tenant

Sem dados novos. Itens de menu escondidos são só UX; a autorização continua na API (`require-role`) e no `RequireRole` existente. Sem CDN externa (CSP inalterada, exceto o hash se o script de tema mudar). Predefinição de cor aplicada por atributo com valor de lista fechada; nenhuma string de cor vinda de dado. Vitrine fora do build de produção. Nenhum dado pessoal novo exibido (iniciais derivadas do e-mail já mostrado hoje em `Shell.tsx:66-68`).

## Fora de escopo

- Shell da plataforma (`PlatformShell`) — entra com a spec do backoffice, depois da decisão do plano §8 item 8.
- Sino/notificações, hero com foto, "Minha Rotina", calendário (`MonthCalendar`) e anexos (`AnexosPicker`) — entram nas specs dos módulos que os usam, seguindo [13](../13-design-system.md) §5.
- Persistência da marca, upload de logo/fotos e tela do personalizador → [spec-personalizador](spec-personalizador.md) (Onda 2).
- Tela de recuperação de senha, perfil e configurações de usuário.
- Renomear `{{PROJETO}}`/`{{SLUG}}` (plano §6 Fase 0 item 1).

## Decisões tomadas (2026-11-05)

- **DS-1 — Tema escuro:** criar tema claro e escuro, escolhidos no personalizador. Paleta escura = extensão aprovada em [13](../13-design-system.md) §3.2.1; claro é o padrão.
- **DS-2 — Marca por condomínio:** marca do mock (Vila Gaudí) no MVP, mas como **dado** parametrizável no personalizador ([13](../13-design-system.md) §3.6). Nome do portal **livre**; rodapé fixo com o nome do sistema ("uma plataforma ZELLO").
- **DS-3 — Contraste:** opção (b), tokens `-strong` só onde o par falha ([13](../13-design-system.md) §8.3).
- **DS-4 — Fontes:** baixadas e licenciadas (OFL 1.1, gratuitas, sem alternativa necessária) em `apps/web/src/assets/fonts/`.

## Verificação manual

1. `pnpm --filter @app/web dev` no ambiente **dev**; entrar com usuário de teste do dev.
2. Abrir `/design-system` (só existe em dev) e a rota do mock equivalente lado a lado: mock rodando a partir do **zip** extraído em diretório temporário (`unzip docs/condominio-360-projeto-mock-v2.zip -d <scratch>` e lá `bun install && bun run dev`; nunca instalar dependências dentro de `docs/`) ou, sem bun, os arquivos de [13](../13-design-system.md) §1. Comparar, no tema claro e predefinição Verde (iguais ao zip), cores, raios, tipografia, botões, badges, inputs, progresso, data, modal (abrir o de `/ocorrencias` do mock), interruptor (`/configuracoes`) e toast em 375px e 1280px; registrar screenshots dos dois.
3. Navegar Painel Geral → Configurações (owner/admin) e conferir: item ativo com `--sidebar-active`; `member` não vê Configurações; drawer abre/fecha (botão, overlay, `Esc`); topbar com data em pt-BR.
4. Em 320, 375, 414 e ≥ 1280px: `document.documentElement.scrollWidth <= window.innerWidth`; nenhum texto < 12px; alvos ≥ 44px; organização com nome de 200 caracteres não estoura.
5. Teclado: tab percorre menu, menu do usuário e conteúdo com foco visível `--ring`; modal da vitrine prende foco e devolve ao fechar.
6. `prefers-reduced-motion: reduce` no DevTools: sem animação.
6.1. Na vitrine, alternar claro/escuro/sistema e as 4 predefinições: nenhum texto ilegível; recarregar a página mantém a preferência sem piscar o tema errado.
7. `pnpm --filter @app/web build` e confirmar que o bundle de produção não contém `DesignSystemPage` (grep no `dist/`), e que nenhuma requisição sai para `fonts.googleapis.com`/`fonts.gstatic.com`.
8. Nenhum dado criado; nada a limpar além do usuário de teste já existente.

## Testes automatizados

- `apps/web/src/components/shell/nav.test.ts` — `visibleNavItems`: ordem igual à de [13](../13-design-system.md) §6.2; `available: false` nunca aparece; `member` não recebe "Configurações"; `owner`/`admin` recebem; `undefined` (sem papel) recebe lista vazia.
- `apps/web/src/components/shell/AppShell.test.tsx` — abre drawer (`aria-expanded=true`), fecha com `Esc` e com clique no overlay; link ativo marcado com `aria-current="page"`.
- `apps/web/src/components/ui/Button.test.tsx` — `loading` desabilita e põe `aria-busy`; variante/tamanho geram as classes esperadas; `IconButton` exige `aria-label` no tipo e é encontrado por `getByRole("button", { name })`.
- `apps/web/src/components/ui/Field.test.tsx` — erro liga `aria-invalid` e `aria-describedby`.
- `apps/web/src/hooks/useTheme.test.ts` — preferência do usuário vence o padrão do condomínio; `system` remove `data-theme`; `localStorage` indisponível não quebra.
- `apps/web/src/contexts/BrandingContext.test.tsx` — predefinição inválida cai em `verde`; `data-brand` aplicado/removido; sem logo, `Brand` mostra a inicial.
- `apps/web/src/design-tokens.test.ts` — varre `apps/web/src/**/*.{css,tsx,ts}` e falha se houver cor literal (`#hex`, `rgb(`, `hsl(`, `oklch(`) fora de `tokens.css`; falha se `tokens.css` não tiver cada token de [13](../13-design-system.md) §3 com o valor exato do mock, inclusive `--shadow-sm`, `--shadow-lg`, `--overlay-modal`, `--overlay-drawer`, os `-strong`, a paleta escura e as predefinições (lista de pares nome→valor no teste).
- Existentes continuam verdes: `RequireRole.test.tsx`, `api.test.ts`, `csp.test.ts`.
- Comando: `pnpm --filter @app/web exec vitest run > /tmp/web.log 2>&1` em background e `grep -E "Test Files|Tests|FAIL" /tmp/web.log`.

## Critério de pronto

- [ ] Decisões DS-1 a DS-4 implementadas conforme [13](../13-design-system.md) §3.1, §3.2.1, §3.6 e §8.
- [ ] `tokens.css` com os valores exatos do mock; teste de tokens passando; nenhuma cor literal fora dele.
- [ ] Componentes e shell conforme [13](../13-design-system.md) §5–6; comparação lado a lado registrada (screenshots mock × app em 375 e 1280px).
- [ ] Type-check limpo (`pnpm --filter @app/web type-check`); testes listados passando com número real.
- [ ] Checklist mobile de [06](../06-frontend.md) cumprido em 320/375/414 e desktop, ou declarado "mobile não verificado visualmente".
- [ ] Build de produção sem a vitrine e sem fonte externa.
- [ ] Nenhuma dependência npm nova; fontes locais com licença OFL ao lado.
