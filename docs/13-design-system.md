# Design system — ZELLO / portal do condomínio (REGRA DURA)

> **Quando ler:** antes de criar ou alterar qualquer tela, componente, CSS, ícone, texto de navegação ou layout em `apps/web`, e ao revisar PR que toque `apps/web`.
> **Resumo:**
> - **Regra dura:** a interface segue *estritamente* o design system contido em `docs/condominio-360-projeto-mock-v2.zip`. **Só o zip é fonte**; `docs/referencias/condominio-360/` é cópia de leitura dele (conferida idêntica, §1.1). Imagens soltas em `docs/` (ex.: `Portal Vila Gaudí.png`) e PDFs não fazem parte do design system. Valor visual que não está no zip não entra sem aprovação registrada (§9).
> - Segue-se o **visual** (tokens, fontes, raios, sombras, espaçamentos, anatomia de componentes, shells, rótulos/ícones de navegação), **não a tecnologia** do mock: nada de Tailwind, shadcn/Radix, `cva`, TanStack Start ou mini-stores ([06](06-frontend.md), [plano](plano-desenvolvimento-condominio-360.md) §1).
> - As regras de `docs/` também são duras. Quando o mock contradiz acessibilidade, mobile, segurança ou LGPD, vale o doc, **somente** na forma registrada em §8 (exceções fechadas). Nova divergência = parar e perguntar.
> - Este doc é o dono dos **valores visuais**. [06-frontend](06-frontend.md) continua dono de estrutura, roteamento, Query, formulários, a11y e regra mobile.
> **Relacionados:** [06-frontend](06-frontend.md), [plano](plano-desenvolvimento-condominio-360.md), [spec da base visual](specs/spec-design-system-base.md), [pr-checklist](templates/pr-checklist.md)

## 1. Fontes da verdade (ordem de precedência)

`R` = `docs/referencias/condominio-360/src/` (= `condominio-360/src/` dentro do zip).

| # | Fonte (dentro do zip) | O que define |
|---|---|---|
| 1 | `R/styles.css:65-105` (`:root`) e `:9-63` (`@theme inline`) | Valores de todos os tokens, raio base, sombra, gradientes |
| 2 | `R/styles.css:107-131` | Base tipográfica, `card-surface`, `hero-fade`, `mosaic-ring`, `bell-pulse` |
| 3 | `R/components/vg/ui.tsx` | Anatomia e medidas de `Card`, `CardTitle`, `Badge`, `Button`, `Field`/input, `PageTitle`, `Progress`, `DateChip` |
| 4 | `R/components/vg/AppShell.tsx`, `PlatformShell.tsx` | Shell do portal e da plataforma, navegação, rótulos, ícones, topbar, bottom nav |
| 5 | `R/components/vg/ListPage.tsx`, `MonthCalendar.tsx`, `AnexosPicker.tsx` | Padrões de lista, calendário de reserva e anexos |
| 6 | `R/routes/*.tsx` | Composição de cada tela (layout, ordem de blocos, textos, estados) |
| 7 | `R/routes/design-system.tsx` | Vitrine oficial dos componentes (conferência visual) |
| 8 | `R/components/ui/dialog.tsx`, `switch.tsx`, `sonner.tsx` (estilo shadcn "new-york", `condominio-360/components.json`) | Modal, interruptor e toast — os **únicos** componentes de `components/ui/` que as telas do mock usam (`dialog` em 13 rotas, `switch` em `configuracoes.tsx`, `sonner` em `__root.tsx:125`) |

- Se 6 e 3 divergirem (classe ad-hoc numa rota), vale o componente de 3; a variação da rota só entra se for repetida em ≥ 2 telas do mock e então vira componente aqui.
- Os demais arquivos de `R/components/ui/` (accordion, tabs, table, select etc.) vieram do gerador e não são usados por nenhuma tela: não fazem parte do design system.

### 1.1 Integridade da cópia

Conferido em 2026-11-05: `unzip` do zip em diretório temporário + `diff -rq` contra `docs/referencias/condominio-360/` = sem diferenças (166 entradas no zip). Se o zip for substituído por outra versão, repetir a conferência e reextrair **antes** de qualquer spec ou PR de tela; este doc é então revisado contra a nova versão.

## 2. O que "seguir estritamente" significa

Obrigatório:
- Usar **somente** os tokens da §3, com os valores literais do mock. Nenhuma cor, raio, sombra ou fonte nova.
- Reproduzir a anatomia dos componentes da §5 (estrutura, medidas, variantes, estados). Nenhuma variante nova sem §9.
- Shells, navegação (ordem, rótulos e ícones `lucide-react` com o mesmo nome) e bottom nav como na §6.
- Composição de tela: a tela X do produto parte da rota X do mock (§1 item 6); muda-se o dado (real, da API), não o layout.
- Textos de interface no tom do mock (pt-BR, frases curtas, sem jargão). Rótulos de módulo e de status iguais aos do mock.

Proibido:
- Tailwind, classes utilitárias, CSS-in-JS, shadcn/Radix, `class-variance-authority`, bibliotecas de componentes visuais.
- Cor literal fora de `apps/web/src/tokens.css` ([06](06-frontend.md) §"Design tokens e tema").
- Copiar código do mock (stores, `useStore`, troca de papel no browser, `URL.createObjectURL` para anexos, dados demonstrativos).
- Fontes via Google Fonts CDN (CSP `font-src 'self'` em `apps/web/nginx.conf:21`). As fontes são arquivos do próprio app em `apps/web/src/assets/fonts/` (Figtree 400/500/600/700 e DM Serif Display 400, subset latin, `@fontsource` 5.3.0, licença SIL OFL 1.1 ao lado — decisão DS-4, 2026-11-05).
- Expor `/design-system` em produção (plano §3): a vitrine existe só em build de desenvolvimento.

## 3. Tokens (valores exatos de `R/styles.css:65-105`)

Nomes no código: os mesmos do mock, prefixados por `--` (sem o `--color-` do `@theme`). Ex.: `var(--primary)`, `var(--sidebar-active-foreground)`.

### 3.1 Cores — tema do portal (padrão "Gaudí 360°")

| Token | Valor | Uso |
|---|---|---|
| `--background` | `oklch(1 0 0)` | fundo da página |
| `--foreground` | `oklch(0.22 0.02 150)` | texto principal |
| `--card` / `--card-foreground` | `oklch(1 0 0)` / `oklch(0.22 0.02 150)` | superfícies |
| `--popover` / `--popover-foreground` | iguais a card | menus suspensos |
| `--primary` | `oklch(0.38 0.075 155)` | verde da marca, ação principal |
| `--primary-foreground` | `oklch(0.98 0.01 85)` | texto sobre primary |
| `--primary-soft` | `oklch(0.92 0.035 150)` | fundo suave de destaque |
| `--secondary` / `--secondary-foreground` | `oklch(0.96 0.004 150)` / `oklch(0.3 0.04 155)` | rodapé da sidebar, blocos neutros |
| `--muted` / `--muted-foreground` | `oklch(0.96 0.004 150)` / `oklch(0.5 0.02 150)` | fundos neutros, texto secundário |
| `--accent` / `--accent-foreground` | `oklch(0.62 0.16 38)` / `oklch(0.98 0.01 85)` | terracota (botão Destaque, alertas) |
| `--destructive` / `-foreground` / `-soft` | `oklch(0.58 0.19 27)` / `oklch(0.98 0.01 85)` / `oklch(0.93 0.04 25)` | erro, excluir, status aberta |
| `--success` / `--success-soft` | `oklch(0.62 0.16 150)` / `oklch(0.93 0.05 150)` | concluída, tendência positiva |
| `--warning` / `--warning-soft` | `oklch(0.75 0.15 65)` / `oklch(0.94 0.05 75)` | em andamento, avisos |
| `--info` / `--info-soft` | `oklch(0.52 0.17 255)` / `oklch(0.93 0.035 255)` | programada, informativo |
| `--sun` | `oklch(0.82 0.15 85)` | amarelo do mosaico |
| `--border` | `oklch(0.91 0.006 150)` | bordas e divisores |
| `--input` | `oklch(0.87 0.008 150)` | borda de input/botão outline |
| `--ring` | `oklch(0.55 0.09 155)` | anel de foco |
| `--sidebar` / `--sidebar-foreground` | `oklch(0.33 0.065 155)` / `oklch(0.95 0.015 85)` | menu lateral |
| `--sidebar-active` / `--sidebar-active-foreground` | `oklch(0.95 0.025 85)` / `oklch(0.3 0.065 155)` | item ativo do menu |
| `--chart-1..5` | success, warning, primary, info, destructive | séries de gráfico, nessa ordem |
| `--accent-strong` | `oklch(0.53 0.16 38)` | **extensão aprovada (DS-3, 2026-11-05)**: texto do badge warning e fundo do botão Destaque |
| `--destructive-strong` | `oklch(0.53 0.19 27)` | **extensão aprovada (DS-3)**: texto do badge danger, erro de formulário e fundo do botão Excluir |
| `--success-strong` | `oklch(0.54 0.16 150)` | **extensão aprovada (DS-3)**: texto de tendência positiva |

### 3.2 Cores — tema da plataforma (superadmin ZELLO)

| Token | Valor |
|---|---|
| `--platform` | `oklch(0.26 0.045 230)` |
| `--platform-foreground` | `oklch(0.97 0.01 85)` |
| `--platform-accent` | `oklch(0.78 0.13 75)` |

A plataforma usa os demais tokens do portal (fundo, cartões, badges); só a sidebar/logo trocam (`R/components/vg/PlatformShell.tsx:18-38`).

### 3.2.1 Tema escuro — extensão aprovada (DS-1, 2026-11-05)

O zip não tem tema escuro; a dona aprovou criá-lo. Regras: mesmos nomes de token, mesmos matizes do mock, só luminosidade/croma ajustados; tema claro continua o padrão. Aplicado em `:root[data-theme="dark"]` e em `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` quando a preferência é "sistema". Mudar qualquer valor abaixo = §9.

| Token | Escuro | | Token | Escuro |
|---|---|---|---|---|
| `--background` | `oklch(0.18 0.015 150)` | | `--success` / `-soft` | `oklch(0.74 0.15 150)` / `oklch(0.3 0.06 150)` |
| `--foreground` | `oklch(0.95 0.01 85)` | | `--warning` / `-soft` | `oklch(0.8 0.14 70)` / `oklch(0.32 0.06 70)` |
| `--card`, `--popover` | `oklch(0.22 0.018 150)` | | `--info` / `-soft` | `oklch(0.74 0.12 255)` / `oklch(0.3 0.06 255)` |
| `--card-foreground`, `--popover-foreground` | `oklch(0.95 0.01 85)` | | `--sun` | `oklch(0.82 0.15 85)` |
| `--primary` / `-foreground` | `oklch(0.72 0.11 155)` / `oklch(0.18 0.03 155)` | | `--border` | `oklch(0.32 0.012 150)` |
| `--primary-soft` | `oklch(0.3 0.05 155)` | | `--input` | `oklch(0.4 0.015 150)` |
| `--secondary` / `-foreground` | `oklch(0.26 0.015 150)` / `oklch(0.9 0.02 150)` | | `--ring` | `oklch(0.68 0.1 155)` |
| `--muted` / `-foreground` | `oklch(0.26 0.012 150)` / `oklch(0.74 0.02 150)` | | `--sidebar` / `-foreground` | `oklch(0.21 0.03 155)` / `oklch(0.93 0.015 85)` |
| `--accent` / `-foreground` | `oklch(0.72 0.14 40)` / `oklch(0.18 0.03 40)` | | `--sidebar-active` / `-foreground` | `oklch(0.32 0.05 155)` / `oklch(0.95 0.02 85)` |
| `--destructive` / `-foreground` | `oklch(0.7 0.17 27)` / `oklch(0.18 0.03 27)` | | `--platform` / `-foreground` / `-accent` | `oklch(0.2 0.035 230)` / `oklch(0.95 0.01 85)` / `oklch(0.78 0.13 75)` |
| `--destructive-soft` | `oklch(0.32 0.08 25)` | | `--accent-strong` / `--destructive-strong` / `--success-strong` | `oklch(0.78 0.13 45)` / `oklch(0.78 0.13 27)` / `oklch(0.78 0.14 150)` |

Sombras, overlays e gradientes: mesmos valores do claro. Contraste medido (WCAG 2.1, 2026-11-05), todos ≥ 4,5:1: texto/fundo 16,2; muted/card 7,5; primary-foreground/primary 7,9; accent-foreground/accent 7,2; destructive-foreground/destructive 6,6; badges success 5,6 · warning 6,2 · danger 6,2 · info 5,9; sidebar 14,3; item ativo 10,7; plataforma 15,6.

### 3.3 Forma, sombra e efeitos

| Token | Valor | Observação |
|---|---|---|
| `--radius` | `0.875rem` (14px) | base |
| `--radius-sm` / `-md` / `-lg` / `-xl` / `-2xl` | 10px / 12px / 14px / 18px / 22px | `calc(var(--radius) ± n)` como no `@theme` |
| `--shadow-card` | `0 1px 2px oklch(0.3 0.03 150 / 6%), 0 8px 24px -12px oklch(0.3 0.03 150 / 18%)` | cartões e menus |
| `--shadow-sm` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` | item ativo do menu, topbar (classe `shadow-sm` do Tailwind v4 usada pelo mock) |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | modal, toast, polegar do switch (`shadow-lg`) |
| `--overlay-modal` | `rgb(0 0 0 / 0.8)` | fundo do modal (`bg-black/80`, `dialog.tsx:24`) |
| `--overlay-drawer` | `color-mix(in oklab, var(--foreground) 40%, transparent)` | fundo do drawer (`bg-foreground/40`, `AppShell.tsx:148`) |
| `--gradient-hero-fade` | `linear-gradient(90deg, var(--background) 0%, color-mix(in oklab, var(--background) 85%, transparent) 35%, transparent 70%)` | sobre a foto do hero |
| `--gradient-mosaic` | `conic-gradient(from 30deg, var(--success), var(--sun), var(--accent), var(--info), var(--success))` | anel de mosaico |

Atenção à conversão das classes do mock: no Tailwind v4 com o `@theme` do mock, `rounded-xl` = **18px** e `rounded-2xl` = **22px** (não os 12/16px padrão do Tailwind). `rounded-lg` = 14px, `rounded-full` = pílula.

### 3.4 Tipografia

| Papel | Família | Pesos | Onde |
|---|---|---|---|
| Display | "DM Serif Display", Georgia, serif | 400 | `h1`, `h2`, `.font-display` (saudação, nome do portal, logo ZELLO) |
| Interface | "Figtree", system-ui, sans-serif | 400 / 500 / 600 / 700 | todo o resto |

Escala (equivalência das classes do mock): 12 (`text-xs`), 14 (`sm`), 15 (itens de menu), 16 (`base`), 18 (`lg`), 20 (`xl`), 24 (`2xl`), 30 (`3xl`), 36 (`4xl`), 48 (`5xl`), 60px (`6xl`). Nenhum tamanho fora dessa lista; abaixo de 12px é proibido (§8).

### 3.5 Espaçamento

Múltiplos de 4px (escala do mock): 4, 6, 8, 10, 12, 16, 20, 24, 32, 40px. Largura máxima do conteúdo: 1400px. Gaps de grade de cartões: 16px.

### 3.6 Personalizador (marca por condomínio e tema) — decisões DS-1/DS-2, 2026-11-05

O que o personalizador muda, por condomínio (`workspace`), seguindo o modelo do mock (`R/lib/brand.ts:6-21`) e a tela de cadastro com pré-visualização (`R/routes/plataforma/condominios.tsx:14-57`):

| Campo | Regra |
|---|---|
| Nome do portal | **livre** (sem o padrão "<Nome> 360°"); vazio = nome oficial do condomínio |
| Nome oficial, endereço | do cadastro do condomínio |
| Slogan | texto curto opcional (login) |
| Logo | imagem; sem logo = círculo `--primary` com a inicial do portal |
| Foto do portal (sidebar/hero) e foto do login | imagens opcionais; sem foto, o bloco é omitido |
| Cor institucional | **uma das 4 predefinições do mock** (`condominios.tsx:14`), não cor livre; troca só `--primary` e `--sidebar`, nos dois temas (tabela abaixo) |
| Mosaico | liga/desliga o anel `--gradient-mosaic` (`brand.ts:20`) |
| Tema padrão do condomínio | claro (padrão) / escuro / sistema; cada usuário pode sobrescrever para si |

| Predefinição | `--primary` claro | `--sidebar` claro | `--primary` escuro | `--sidebar` escuro |
|---|---|---|---|---|
| Verde (padrão) | `oklch(0.38 0.075 155)` | `oklch(0.33 0.065 155)` | `oklch(0.72 0.11 155)` | `oklch(0.21 0.03 155)` |
| Azul | `oklch(0.45 0.1 230)` | `oklch(0.33 0.08 235)` | `oklch(0.72 0.11 230)` | `oklch(0.21 0.035 235)` |
| Vinho | `oklch(0.45 0.12 340)` | `oklch(0.35 0.1 340)` | `oklch(0.72 0.12 340)` | `oklch(0.21 0.04 340)` |
| Terracota | `oklch(0.52 0.13 40)` | `oklch(0.38 0.09 40)` | `oklch(0.72 0.12 40)` | `oklch(0.21 0.035 40)` |

Colunas claras = valores do zip; colunas escuras = extensão aprovada (DS-1), mesmo matiz, `--primary-foreground` escuro com o matiz da predefinição (`oklch(0.18 0.03 <H>)`). Contraste medido ≥ 4,5:1 em todas (pior: Terracota claro 5,5; Vinho escuro 6,6 sobre cartão).

- **Fixo, não personalizável:** rodapé "uma plataforma ZELLO" (sidebar e login), demais tokens, fontes, componentes e layout.
- Aplicação: variáveis CSS no elemento raiz do shell, a partir de um **id de predefinição** validado no servidor (nunca string de cor vinda do cliente).
- Marca do MVP: a do mock (Vila Gaudí), configurada **como dado** do condomínio pelo personalizador, nunca fixa no código ([spec do personalizador](specs/spec-personalizador.md)).

## 4. Ícones

`lucide-react` (já em `apps/web/package.json`), com o **mesmo ícone** que o mock usa para cada módulo (§6.2). Tamanhos: 20px em menu/cabeçalho de cartão, 16px inline em texto/menu de usuário, 24px em alertas. Decorativo → `aria-hidden`; botão só-ícone → `aria-label` ([06](06-frontend.md) §"Componentes base").

## 5. Componentes (anatomia de `R/components/vg/ui.tsx` e afins)

Medidas em px. "Exceção §8" indica onde a regra de `docs/` altera o mock.

| Componente | Anatomia obrigatória |
|---|---|
| `Card` (`ui.tsx:5`) | `card-surface`: fundo `--card`, borda 1px `--border`, raio 18px, `--shadow-card`; padding 20 |
| `CardTitle` (`ui.tsx:9`) | linha flex com espaço entre; ícone opcional em círculo 40 `--primary`/`--primary-foreground`; título 18 semibold truncado; ação à direita; margem inferior 16 |
| `Badge` (`ui.tsx:21`) | pílula, padding 4×12, 12px medium, sem quebra. Tons: `success` (bg `--success-soft`, texto `--primary`), `warning` (`--warning-soft`/`--accent`), `danger` (`--destructive-soft`/`--destructive`), `info` (`--info-soft`/`--info`), `neutral` (`--muted`/`--muted-foreground`). Contraste: exceção §8.3 |
| `Button` (`ui.tsx:37`) | raio 18px, 14px medium, gap 8, transição de cor; hover = fundo a 90%; desabilitado opacidade .5. Variantes: `primary`, `accent` (Destaque), `outline` (borda `--input`, fundo `--card`, hover `--muted`), `ghost` (hover `--muted`), `danger`. Tamanhos: `sm` 32 / px 12, `md` 40 / px 16, `lg` 48 / px 24 / 16px. Altura mínima de toque: exceção §8.1. Estado loading: exigido por [06](06-frontend.md); visual = mesmo botão desabilitado com spinner 16px no lugar do ícone |
| `Field` + input (`ui.tsx:54-62`) | label 14 medium, espaço 6; input/select altura 44, raio 18, borda `--input`, fundo `--card`, padding-x 12, texto 14, foco = anel 2px `--ring`. Fonte do input: exceção §8.2. Mensagem de erro: 14px `--destructive` abaixo do campo (padrão do alerta de login, `R/routes/index.tsx`) |
| `PageTitle` (`ui.tsx:64`) | grid `minmax(0,1fr) auto`, alinhado à base, gap 16, margem inferior 24; `h1` display 30 → 36 a partir de 768; subtítulo `--muted-foreground`, margem 4 |
| `Progress` (`ui.tsx:76`) | trilho 8 `--muted` pílula; preenchimento `--primary` / `--success` / `--destructive` |
| `DateChip` (`ui.tsx:85`) | caixa 48×48, raio 18, `--muted`; dia 18 semibold; mês caixa alta `--muted-foreground` (tamanho: exceção §8.2) |
| Lista (`ListPage.tsx`) | estatísticas em grade 2 → 4 colunas (≥ 768), cartão com rótulo 14 muted e valor 24 bold; lista dentro de `Card`, divisores `--border`, linha grid `minmax(0,1fr) auto`, padding vertical 12, título medium truncado, subtítulo 14 muted truncado, à direita valor semibold + `Badge` |
| Calendário (`MonthCalendar.tsx`) | navegação com botões 44 raio 18 borda; título do mês 18 semibold; grade 7 colunas gap 4; dia 44 de altura, raio 14, 16 medium. Estados: disponível (`--success-soft`, texto `--primary`, hover anel `--primary`), ocupada (`--destructive-soft`, `--destructive`, riscado), indisponível (`--muted`), passada (`--muted-foreground` 50%), selecionada (`--primary`/`--primary-foreground`). Legenda com amostras 16 |
| Anexos (`AnexosPicker.tsx`) | área tracejada 2px, raio 18, padding 16, texto `--primary` 16 medium com ícone `Paperclip`; dica 12 muted com extensões e limite; item em grid `auto minmax(0,1fr) auto`, miniatura 56 raio 14, nome truncado, botão remover `Trash2` `--destructive`. Arquivo vem do fluxo `/api/v1/files` + URL assinada ([12](12-storage-e-governanca.md)), nunca `createObjectURL` persistido |
| Alerta de página (`R/routes/painel.tsx`) | faixa raio 22, fundo `--warning-soft`, borda `--accent` 40%, ícone 24 `--accent`, ação primária 40 à direita |
| Erro de formulário (`R/routes/index.tsx`) | bloco `role="alert"`, raio 18, fundo `--destructive-soft`, texto 14 `--destructive` (contraste: exceção §8.3) |
| `NotificationBell` (`AppShell.tsx:81`) | botão circular 40 (exceção §8.1), ícone 20, `--primary` quando há não lidas; contador pílula `--destructive` 20 com `bell-pulse` (desligado com `prefers-reduced-motion`) |
| Menu do usuário (`AppShell.tsx:95`) | avatar 40 circular `--primary` com iniciais; nome semibold + cargo/unidade 12 muted (oculto < 640); menu `card-surface` 224 de largura, itens 14 com ícone 16, "Sair" em `--destructive` |
| `HeroBanner` (`AppShell.tsx:199`) | altura 224 → 256 (≥ 768), foto `cover` alinhada à direita, `--gradient-hero-fade` por cima, título display 36 → 60, subtítulo 16 → 18, máx. 448 |
| Logo da plataforma (`PlatformShell.tsx:18`) | quadrado 40 raio 18 `--platform-accent` com "Z" display 24 `--platform`; nome "ZELLO" display 24 com espaçamento |
| Logo do condomínio (`AppShell.tsx:61`) | imagem `contain`; sem logo → círculo `--primary` com a inicial do portal em display |

| `Modal` (`R/components/ui/dialog.tsx:18-90`) | overlay `--overlay-modal`; caixa centralizada, largura total até 512 (`sm:max-w-xl` = 576 em `equipe.tsx:154`), gap 16, borda `--border`, fundo `--background`, padding 24, `--shadow-lg`, raio 14 a partir de 640 (sem raio abaixo); nas telas, altura máx. 90vh com rolagem interna (`ocorrencias.tsx:93` e outras). Cabeçalho: título 18 semibold sem entrelinha extra, descrição 14 muted; centralizado < 640, à esquerda ≥ 640. Rodapé: botões empilhados em ordem inversa < 640, em linha à direita com gap 8 ≥ 640. Fechar: ícone `X` 16 no canto (16 do topo/direita), opacidade .7 → 1 no hover (alvo: exceção §8.1). Animação fade + zoom 95% (200ms; desligada com `prefers-reduced-motion`). `ConfirmDialog` = este `Modal` com botão `danger` |
| `Switch` (`R/components/ui/switch.tsx:8-26`) | trilho 36×20 pílula, borda 2 transparente; ligado `--primary`, desligado `--input`; polegar 16 `--background` com `--shadow-lg`, desloca 16; foco anel 2 `--ring` com afastamento 2; desabilitado opacidade .5 (alvo: exceção §8.1) |
| Toast (`R/components/ui/sonner.tsx`, `R/routes/__root.tsx:125`) | `sonner` no canto **superior direito**, `richColors`; toast com fundo `--background`, texto `--foreground`, borda `--border`, `--shadow-lg`; descrição muted; botão de ação `--primary`, cancelar `--muted` |

Componentes exigidos por [06](06-frontend.md) que o zip não desenha (`EmptyState`, `Loading`, `DataTable` mobile) são compostos **só** com as peças acima: `EmptyState` = texto 14 muted dentro de `Card` (como "Nenhum anexo." em `AnexosPicker.tsx:45`); `Loading` = linhas `--muted` com raio 14 no formato do conteúdo; `DataTable` no mobile = `ListCard`.

## 6. Shells e navegação

### 6.1 Portal do condomínio (`R/components/vg/AppShell.tsx:125-197`)

- **≥ 1024px:** sidebar fixa 256 `--sidebar`, padding-x 12, rolável. Topo: logo 80, nome do portal display 30, nome jurídico 12 a 80%. Itens: raio 18, padding 10×16, 15px, ícone 20, gap 12, texto `--sidebar-foreground` 90%, hover fundo `--sidebar-foreground` 10%; ativo `--sidebar-active` / `--sidebar-active-foreground`, semibold, sombra leve. Rodapé: foto 96 de altura + bloco `--secondary` 12px (nome, endereço, "uma plataforma ZELLO").
- **Topbar ≥ 1024:** "pílula" flutuante à direita, sticky a 16 do topo, raio 22, borda, fundo `--card` 90% com blur; mostra dia da semana (14, capitalizado) e data longa (12 muted), sino e menu do usuário.
- **< 1024:** topbar sticky de largura total com borda inferior: botão de menu, logo 32 + nome do portal display 20, sino. Drawer 288 `--sidebar` sobre overlay; fecha por botão, overlay e `Esc`.
- **Bottom nav < 1024:** fixa, fundo `--card`, borda superior, 5 colunas (Início, Avisos, Reservas, Ocorrências, Perfil) ou 3 para equipe operacional (Minha Rotina, Avisos, Perfil); ícone 20 + rótulo; ativo `--primary` semibold. Conteúdo com folga inferior de 112.
- **Conteúdo:** máx. 1400, padding-x 16 → 24 (≥ 768), padding-top 24.

### 6.2 Ordem, rótulos e ícones do menu (`AppShell.tsx:14-39`)

| Rótulo | Rota | Ícone | | Rótulo | Rota | Ícone |
|---|---|---|---|---|---|---|
| Minha Rotina | `/minha-rotina` | `ClipboardCheck` | | Ocorrências do Condomínio | `/ocorrencias` | `FileText` |
| Feedback do Portal | `/feedback` | `MessageSquareHeart` | | Reservas de Áreas | `/reservas` | `CalendarCheck` |
| Painel Geral | `/painel` | `Home` | | Central de Documentos | `/documentos` | `Folder` |
| Avisos à Comunidade | `/comunicados` | `Bell` | | Regras de Convivência | `/regras` | `FileText` |
| Riscos e Pendências | `/riscos` | `AlertTriangle` | | Moradores | `/moradores` | `Building2` |
| Saúde Predial | `/saude-predial` | `HeartPulse` | | Fornecedores | `/fornecedores` | `Briefcase` |
| Financeiro | `/financeiro` | `BarChart3` | | Equipe e Escalas | `/equipe` | `UserCog` |
| Fluxo de Aprovações | `/aprovacoes` | `Gavel` | | Relatórios | `/relatorios` | `LineChart` |
| Calendário | `/calendario` | `CalendarDays` | | Configuração e Importação | `/importacao` | `FileUp` |
| Manutenção Preventiva | `/manutencoes` | `Wrench` | | Configurações | `/configuracoes` | `Settings` |
| Ordens de Serviço | `/ordens-servico` | `ClipboardList` | | Perfis e Permissões | `/perfis-permissoes` | `ShieldCheck` |
| Obras e Instalações | `/obras` | `HardHat` | | | | |

- Item só aparece quando o módulo existe no produto **e** o papel tem a permissão correspondente em `PERMISSIONS` (`packages/shared/src/permissions.ts:3`). A lista de papéis do mock **não** é copiada; o mapeamento decidido ([11-dominio](11-dominio.md) §3) é: `superadmin` → `super_admin`; `admin` (Administração) → `owner`/`admin`; `conselho` → `council`; `sindico` → `manager`; `zelador` → `staff`; `morador` → `member`. A visibilidade de cada item segue a do mock para o papel equivalente.
- "Design System" (`/design-system`) não entra no menu de produção.
- Rotas no app real ficam sob `/o/:organizationId/...` ([06](06-frontend.md) §"Roteamento e guards"); o segmento final mantém o nome do mock.

### 6.3 Plataforma (`R/components/vg/PlatformShell.tsx:40-75`)

Sidebar 256 `--platform`, logo ZELLO + slogan "Gestão inteligente. Cuidado em cada detalhe." (12, 75%). Itens como o portal, ativo `--platform-accent` / `--platform`. Menu: Feedback do Portal, Visão geral, Condomínios, Planos e Assinaturas, Usuários e Convites, Perfis e Permissões, Auditoria, Configurações (ícones do arquivo citado). Mobile: header com menu e "ZELLO" display 20. Conteúdo com padding-top 32, título 30 → 36. O chip "Dados demonstrativos" **não** existe em produção; o chip "Ambiente ZELLO" fica.

### 6.4 Login (`R/routes/index.tsx`)

Duas colunas ≥ 1024 (foto do condomínio com degradê de `--sidebar` 90% e nome do portal display 48 + slogan; formulário à direita, máx. 384). Logo 96, título display 36, nome jurídico muted, campos E-mail/Senha, link "Esqueci minha senha", botão `lg` largura total "Entrar", rodapé fixo "uma plataforma ZELLO" (nome do sistema, não personalizável). O bloco "Ambiente de demonstração" e os usuários fictícios **não** existem em produção.

## 7. Estados obrigatórios de tela

Toda tela tem carregando, erro, vazio e dados ([06](06-frontend.md) §"Checklist de tela nova"), compostos com §5. Mensagens em pt-BR no tom do mock (ex.: "E-mail ou senha incorretos. Confira os dados e tente de novo.").

## 8. Exceções fechadas (onde `docs/` prevalece sobre o mock)

São as **únicas** divergências autorizadas. Qualquer outra exige §9.

### 8.1 Alvo de toque ≥ 44px ([06](06-frontend.md) §"Regra mobile")
- Base (mobile-first): `Button` `sm`/`md`, sino, botão de menu, itens da bottom nav e botão fechar do `Modal` com `min-height: 44px` (e largura 44 nos só-ícone). `Switch` mantém o desenho 36×20, mas a área clicável é a linha inteira com o rótulo (≥ 44 de altura).
- Em `@media (min-width: 1024px) and (pointer: fine)` volta à medida do mock (32 / 40).

### 8.2 Fonte ≥ 12px e input 16px no mobile ([06](06-frontend.md) §"Regra mobile")
- Textos de 10–11px do mock sobem para **12px**: mês do `DateChip`, contador do sino, rótulos da bottom nav.
- `input`, `select` e `textarea` usam **16px** abaixo de 1024px (evita zoom do iOS) e 14px (mock) a partir de 1024px.

### 8.3 Contraste AA 4,5:1 ([06](06-frontend.md) §"Design tokens e tema")
Medição dos pares do mock (WCAG 2.1, conversão oklch → sRGB, 2026-11-05):

| Par (texto sobre fundo) | Razão | Situação para texto < 18,66px bold / 24px |
|---|---|---|
| `--foreground` / `--background` | 17,2 | ok |
| `--muted-foreground` / `--background` · `--muted` | 5,9 · 5,3 | ok |
| `--primary-foreground` / `--primary` | 9,1 | ok |
| `--sidebar-foreground` / `--sidebar` | 10,3 | ok |
| `--platform-foreground` / `--platform` | 14,1 | ok |
| `--info` / `--info-soft` (badge info) | 4,56 | ok (no limite) |
| `--primary` / `--success-soft` (badge success) | 8,0 | ok |
| `--accent-foreground` / `--accent` (botão Destaque) | **3,68** | falha |
| `--destructive-foreground` / `--destructive` (botão Excluir) | **4,44** | falha |
| `--accent` / `--warning-soft` (badge warning) | **3,25** | falha |
| `--destructive` / `--destructive-soft` (badge danger, erro de formulário) | **3,75** | falha |
| `--success` / `--background` (seta de tendência) | **3,40** | falha para texto; ok para ícone (≥ 3:1) |

Decisão DS-3 (2026-11-05, opção b): os tokens do mock ficam; os cinco pares usam os tokens `-strong` da §3.1 — badge warning (texto `--accent-strong`, 4,74), botão Destaque (fundo `--accent-strong`), badge danger e erro de formulário (texto `--destructive-strong`, 4,64), botão Excluir (fundo `--destructive-strong`), tendência positiva em texto (`--success-strong`, 4,66). Ícones e texto grande continuam com os tokens originais.

### 8.4 Tema escuro
O zip não define tema escuro (`R/styles.css:5` só declara a variante). Decisão DS-1 (2026-11-05): tema claro e escuro, com a paleta escura da §3.2.1 como extensão aprovada, escolhidos no personalizador (§3.6). Claro é o padrão.

### 8.5 Movimento
`bell-pulse` e transições respeitam `prefers-reduced-motion: reduce` ([06](06-frontend.md) §"Acessibilidade").

### 8.6 Segurança e dados
Sem CDN de fontes (CSP), sem `createObjectURL` como URL persistida, sem dados demonstrativos, sem papel decidido no browser, nomes/condomínio/endereço vindos da API — nunca fixos no código (o mock já faz assim via `tenant`, `AGENTS.md` do mock).

## 9. Como pedir uma divergência

1. Parar a implementação na parte afetada.
2. Registrar `DECIDIR-DS-n` na spec da feature: o que o mock faz (arquivo:linha), qual regra conflita, opções, recomendação.
3. Só seguir após aprovação humana explícita; a decisão aprovada é acrescentada à §8 deste doc no mesmo PR.

## 10. Checklist de fidelidade (usar em toda tela)

- [ ] Partiu da rota correspondente do mock; layout, ordem de blocos, rótulos e ícones iguais.
- [ ] Só tokens da §3; nenhuma cor/raio/sombra/fonte nova; nenhum literal fora de `tokens.css`.
- [ ] Componentes da §5, sem variante nova; exceções só as da §8.
- [ ] Shell e menu conforme §6; itens filtrados por `PERMISSIONS`, não por lista de papéis do mock.
- [ ] Comparação lado a lado com o mock (screenshot do mock rodando ou da vitrine `/design-system` em dev) em 375px e ≥ 1280px.
- [ ] Checklist mobile de [06](06-frontend.md) cumprido.
