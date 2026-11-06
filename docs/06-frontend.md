# Frontend — `apps/web`

> **Quando ler:** ao criar ou alterar tela, componente, hook, formulário, CSS ou fluxo de login em `apps/web`.
> **Resumo:**
> - Front fala **só com a API** (`/api/v1`); Supabase no front serve apenas para Auth, com a anon key.
> - Dados de servidor via TanStack Query (chaves por tenant); formulários com react-hook-form + schema Zod de `@app/shared`.
> - CSS escrito à mão com tokens em CSS variables; tema claro/escuro pelo atributo `data-theme`.
> - **Regra mobile obrigatória**: toda mudança verificada em 320–414px antes de dar como pronta, ou declarado que não foi.
> - Guards de rota por papel são conveniência de UX; quem autoriza de verdade é a API.
>
> **Relacionados:** [arquitetura](01-arquitetura.md), [segurança](03-seguranca.md), [boas práticas](04-boas-praticas.md), [backend](05-backend-api.md), [testes](07-testes.md), [lições](08-licoes-aprendidas.md)

## Estrutura

Scaffold atual (cresça a partir dele; `lib/` e `styles/` passam a existir quando houver mais de um arquivo do tipo):

```
apps/web/src/
  main.tsx          QueryClient, Router, AuthProvider, Toaster
  App.tsx           tabela de rotas (/login, /o/:organizationId/...)
  api.ts            apiFetch + ApiError + setActiveOrganizationId
  supabase.ts       getSupabase() (cliente Auth)
  pages/            LoginPage, DashboardPage, OrganizationPage, HomeRedirect
  components/       Shell, OrgScope, RequireAuth, RequireRole
  hooks/            useCan, useTheme
  contexts/         AuthContext (sessão + memberships + papel na organização ativa)
  tokens.css        design tokens; styles.css  estilos base
  *.test.ts(x)      api.test.ts, RequireRole.test.tsx, csp.test.ts
```

Ao crescer: `pages/<area>/`, `lib/query-keys.ts`, `lib/format.ts`, `styles/<area>.css`.

- Página > ~300 linhas: extraia seções em componentes. Lição: tela de admin num arquivo único de 1.000+ linhas (e CSS idem) faz toda mudança custar ler tudo (ver [lições](08-licoes-aprendidas.md#front-e-mobile)).

## Roteamento e guards

- `react-router` 6, rotas declaradas em `App.tsx`; áreas autenticadas sob um layout com `<RequireAuth>`.
- Organização ativa: a API recebe no header `X-Organization-Id` (contrato em [arquitetura](01-arquitetura.md#fluxo-de-uma-requisição-autenticada)). O front guarda a organização ativa no `AuthContext` e a reflete na URL (`/o/:organizationId/...`) para links compartilháveis; o cliente de API lê dali e envia o header.
- Guard por papel com a **mesma matriz** de permissões da API, exportada de `@app/shared`:

Real em `apps/web/src/components/RequireRole.tsx` (resumo): lê `{ role, loading }` de `useAuth()`; carregando → estado `role="status"`; sem papel ou papel fora de `roles` → mensagem `role="alert"` "Você não tem permissão…". Autenticação fica em `<RequireAuth>`; escopo de organização em `<OrgScope>` (lê `:organizationId` da URL e chama `setActiveOrganizationId`).

- `useCan("fees:write")` para esconder/desabilitar botões. Nunca matriz própria no front (lição: duplicada, divergiu do backend).

## Auth Supabase no front

- `supabase.ts` (`getSupabase()`): `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` com `persistSession` e `autoRefreshToken` (defaults do supabase-js v2) `[verificar opções na versão instalada]`.
- Só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no front. Qualquer outra chave do Supabase em `VITE_*` é vazamento (vai no bundle).
- O front **não** faz `supabase.from(...)`: as tabelas têm RLS deny-by-default e o caminho de dados é a API.
- `AuthContext`: escuta `supabase.auth.onAuthStateChange`, guarda a sessão, e após login chama `GET /api/v1/me` para obter memberships (papel vem da API, não do JWT).
- Login: e-mail/senha e magic link. Redirect do magic link aponta para `WEB_ORIGIN` do ambiente correto (dev ≠ prod); configurar URLs permitidas no painel do Supabase (ver [deploy](09-deploy-easypanel-supabase.md)).
- Logout: `supabase.auth.signOut()` + `queryClient.clear()` (não deixar dado do tenant anterior em cache).

## Cliente de API

Real em `apps/web/src/api.ts` (`apiFetch<T>(path, init)`), resumo:

- Prefixa `VITE_API_URL + "/api/v1"`; envia `Authorization: Bearer <access_token>` da sessão e `X-Organization-Id` (definido por `setActiveOrganizationId`, chamado pelo `OrgScope`).
- Sucesso: devolve o **corpo inteiro** (`{ data, meta }`); quem chama lê `.data`/`.meta`. Tipar com `paginatedSchema(...)`/tipos de `@app/shared`.
- Erro: valida o corpo com `errorResponseSchema` de `@app/shared` → `ApiError(status, code, message, details)`; corpo fora do contrato → `UNKNOWN_ERROR`; falha de rede → `ApiError(0, "NETWORK_ERROR")`; `401` faz `signOut()`.
- Ao adicionar upload: não fixe `Content-Type` com `FormData` (o scaffold só define JSON quando há `body` e nenhum `Content-Type`).

- **401**: o supabase-js já renova o token; se ainda vier 401, `apiFetch` faz `signOut()` e o `RequireAuth` redireciona para `/login?next=<rota>`. Sem loop de retry.
- **403**: mostra estado "Você não tem permissão para isso" (não desloga).
- **404**: estado "não encontrado" (pode ser recurso de outro tenant; não diferenciar).
- **409/422**: mostrar `message` da API perto do campo (`details.field`) ou em toast.
- Decida por `code` (sempre MAIÚSCULAS: `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`...), nunca por texto de `message`.
- POST com efeito externo envia `Idempotency-Key` gerado com `crypto.randomUUID()` **uma vez por intenção** (guardado no estado do formulário, reaproveitado em retry).

## TanStack Query

- Chaves em `lib/query-keys.ts`, sempre começando pela organização:

```ts
export const qk = {
  projects: (orgId: string, workspaceId: string, params?: ListParams) => ["org", orgId, "ws", workspaceId, "projects", params ?? {}] as const,
  project: (orgId: string, projectId: string) => ["org", orgId, "project", projectId] as const,
};
```

- Defaults em `main.tsx`: `retry` até 2 vezes só para erro que não seja 4xx, `staleTime: 30_000`, `refetchOnWindowFocus: false` (defaults testados em produção).
- Mutação: `onSuccess` invalida o prefixo afetado (`["org", orgId, "ws", workspaceId, "projects"]`), não a cache inteira.
- Toda tela de dados trata os quatro estados: **loading** (skeleton/`Loading`), **erro** (mensagem + "Tentar de novo"), **vazio** (`EmptyState` com ação), **dados**.
- Listas paginadas com `placeholderData: keepPreviousData`, página na URL (`?page=2`).

## Formulários

- `react-hook-form` + `zodResolver(schemaDoShared)`; o mesmo schema que a API valida.
- Erro de campo abaixo do input, ligado por `aria-describedby`; erro do servidor mapeado com `setError(details.field, ...)`.
- Botão de submit desabilitado durante `isSubmitting` (evita duplo envio, além da idempotência).
- Dinheiro: input de texto com máscara pt-BR, convertido por `parseBrlToCents` do shared; nunca `type="number"` para valor monetário.
- CPF/telefone: máscara na digitação, envio só dígitos; exibição mascarada por padrão (LGPD, ver [segurança](03-seguranca.md)).

## Design tokens e tema

> **Regra dura:** nomes e valores dos tokens, fontes, componentes e shells são os do design system do mock, definidos em [13-design-system](13-design-system.md). A lista de nomes abaixo é a do scaffold genérico e será substituída pela de [13](13-design-system.md) §3 na [spec da base visual](specs/spec-design-system-base.md). Este doc continua dono de estrutura, a11y e regra mobile; [13](13-design-system.md) é dono dos valores visuais.

- Tokens em `tokens.css` (hoje em `src/`; mova para `styles/` quando crescer) no `:root`: cores semânticas (`--bg`, `--surface`, `--surface-alt`, `--text`, `--text-muted`, `--border`, `--primary`, `--primary-contrast`, `--success`, `--warning`, `--danger` + `-soft`), raio, sombra, espaçamento, fontes.
- **Nenhuma cor literal fora de `tokens.css`.** Lição: dezenas de hex direto nos seletores fazem o tema escuro exigir primeiro auditar e tokenizar tudo.
- Tema escuro, padrão que funcionou:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #141a24; --text: #eef1f6; }
}
:root[data-theme="dark"] { --bg: #141a24; --text: #eef1f6; }
```

- `useTheme` persiste `"light" | "dark"` em `localStorage` (com `try/catch`, modo privado falha); sem preferência salva, não seta atributo e o sistema decide.
- Aplique o tema salvo **antes do React montar** (script inline mínimo no `index.html`) para não piscar o tema errado. O nginx do web envia CSP com o hash desse script em `script-src`; mudou o script, recalcule o hash (`apps/web/src/csp.test.ts` falha se divergir). Lição: CSP bloqueou script inline sem ninguém perceber. CSP completa e motivo do `style-src 'unsafe-inline'`: [segurança](03-seguranca.md) §"Headers, CORS e rate limiting".
- Contraste AA (4,5:1 texto normal) conferido nos dois temas.

## Componentes base

- `Button` (variantes primary/secondary/danger/ghost, `min-height: 44px`, estado loading), `Field` (label + input + erro), `Select`, `Modal` (foco preso, `Esc` fecha, retorna foco), `DataTable` (vira cards no mobile), `EmptyState`, `Loading`, `ConfirmDialog` para ações destrutivas.
- Ícones `lucide-react` com `aria-hidden` quando decorativos; botão só-ícone tem `aria-label`.
- Toasts com `sonner` para feedback de ação (ele injeta `<style>` em runtime, por isso a CSP tem `style-src 'unsafe-inline'`; trocar de lib permite voltar a `'self'`); erro de formulário fica no formulário, não em toast.

## Acessibilidade

- HTML semântico (`button` para ação, `a` para navegação, `label` em todo input).
- Foco visível (`:focus-visible` com outline do token), ordem de tabulação lógica, `Esc` fecha modal.
- Não usar só cor para status (ícone/texto junto). `prefers-reduced-motion` desliga animações.
- Idioma `lang="pt-BR"` no `index.html`.

## Performance

- Code-splitting por área com `React.lazy` + `Suspense` nas rotas autenticadas.
- Imagens: tamanho certo, `loading="lazy"`, `width/height` para evitar layout shift.
- Não buscar a lista inteira para filtrar no cliente: filtro e paginação no servidor.
- Medir bundle (`vite build` mostra tamanhos) antes de adicionar dependência (critérios em [boas práticas](04-boas-praticas.md#dependências)).

## Regra mobile (obrigatória)

Origem: um código copia-e-cola (pagamento, token, URL), uma linha longa sem quebra, alarga uma coluna `1fr` e faz o Chrome mobile **reduzir o zoom da página inteira**. Por isso é regra do repositório.

- Grids: `grid-template-columns: minmax(0, 1fr)` (nunca `1fr` puro em coluna que pode receber conteúdo largo); itens de grid/flex com `min-width: 0`.
- Texto longo (código, e-mail, URL, nome de workspace): `overflow-wrap: anywhere`, ou truncamento com `text-overflow: ellipsis` + botão "copiar"; blocos de código em `textarea`/`pre` com `white-space: pre-wrap; word-break: break-all`.
- Alvos de toque ≥ 44×44px (botões, links de menu, checkboxes com label clicável).
- Fonte ≥ 12px em qualquer texto no mobile; inputs com 16px para o iOS não dar zoom ao focar.
- Sem scroll horizontal da página em 320px; tabelas largas viram cards ou ficam em contêiner com `overflow-x: auto` próprio.
- Header, menu e botões principais cabem em 320px (logo reduz, ações secundárias vão para menu).
- Breakpoints mobile-first: base é o celular, `@media (min-width: 768px)` e `(min-width: 1024px)` acrescentam.

### Checklist de verificação mobile

- [ ] Abri em 320, 375 e 414px de largura (e desktop ≥ 1280).
- [ ] `document.documentElement.scrollWidth <= window.innerWidth` em 320px (console).
- [ ] Nenhum texto < 12px; nenhum alvo de toque < 44px.
- [ ] Conteúdo longo de teste (código de 200 caracteres, nome enorme, e-mail longo) não estoura.
- [ ] Header/menu abre e fecha em 320px; modal cabe e rola por dentro.
- [ ] Tema claro e escuro conferidos.

### Como verificar

- Chrome DevTools → Toggle device toolbar → "Responsive", larguras 320/375/414; ou Claude com a extensão de navegador redimensionando a janela e tirando screenshot de cada largura.
- Rodar o check de `scrollWidth` no console em cada largura.
- Se o agente não conseguiu abrir o navegador, o relatório **deve** dizer explicitamente: "mobile não verificado visualmente" — nunca afirmar que está ok por leitura de CSS.
- Quem recebe o relatório com screenshots abre as imagens antes de aprovar (lição de processo, ver [lições](08-licoes-aprendidas.md#processo-com-ia)).

## Variáveis de build

- `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` são embutidas **no build**: mudar exige rebuild, não restart.
- No Dockerfile, `ARG` **sem default**. Lição: um `ARG` com default fixo no Dockerfile sobrescreve silenciosamente o valor configurado no painel e gera builds idênticos (mesmo hash de bundle) qualquer que fosse a configuração (ver [deploy](09-deploy-easypanel-supabase.md)).
- Validar no boot do app (`main.tsx`) que as três existem e mostrar erro claro se faltar.

## Checklist de tela nova

- [ ] Rota com guard de papel; botões condicionados por `useCan`.
- [ ] Query keys com `orgId`; invalidação por prefixo após mutação.
- [ ] Estados loading/erro/vazio/dados.
- [ ] Formulário com schema do shared; erros do servidor no campo.
- [ ] Só tokens de cor; tema escuro ok.
- [ ] Checklist mobile acima cumprido ou declarado não verificado.
