<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Branding is per tenant via `src/lib/brand.ts` (Tenant + PLATFORM_BRAND); portal UI reads `useStore().tenant`, never hardcoded condo names — so new condos need no new code.
- Superadmin area lives under `/plataforma/*` with its own `PlatformShell`; condo portals use `AppShell`.
- Module demo state (equipe, contratos, moradores, permissões, financeiro) lives in `src/lib/<modulo>.ts` via `createMiniStore` (no backend yet) — keeps `store.tsx` small and lets pages share state; replace with Lovable Cloud tables when real auth is enabled.
- Financial expenses ("Notas Fiscais e Recibos") and monthly reconciliation live in `src/lib/despesas.ts` (pure `conciliar`) and never mutate imported balancete lines — keeps manual records and imports independent and testable.
- Operational modules (ordens, obras, propostas, preventiva) live in src/lib/<modulo>.ts mini-stores and the Risks panel derives from them read-only — one record shared across profiles, no duplication.
