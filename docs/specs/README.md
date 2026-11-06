# Specs — ondas de desenvolvimento

> Roteiro derivado do [plano](../plano-desenvolvimento-condominio-360.md) §6. Status atualizado no mesmo PR que muda a spec.
> Toda spec com tela segue [13-design-system](../13-design-system.md) (REGRA DURA; fonte única = o zip do mock) e cita a rota do mock que reproduz.

## Regras das ondas

- Uma onda só começa depois que a anterior foi **revisada e aprovada** pela dona.
- Specs ficam prontas **uma onda à frente**: enquanto uma onda é construída, as specs da seguinte são escritas e aprovadas.
- Paralelismo só entre áreas de código disjuntas ([10](../10-workflow-claude.md) §6). Dependência = sequência.
- **Arquivos compartilhados** — `packages/shared/src/permissions.ts`, `packages/shared/src/index.ts`, `apps/web/src/App.tsx`, `apps/web/src/components/shell/nav.ts`, `apps/api/src/app.ts` (registro de rotas): em cada onda, um único dono (um agente nomeado na spec ou um passo curto na sessão principal antes de liberar os agentes).
- **Fechamento de onda:**
  - [ ] reviewer sobre o diff ([pr-checklist](../templates/pr-checklist.md));
  - [ ] testes com números reais;
  - [ ] verificação 320/375/414px + desktop e comparação lado a lado com o mock do zip;
  - [ ] deploy no **dev** pelo CI verde;
  - [ ] aprovação da dona.

## Onda 0 — decisões (sem código)

| Item | Status |
|---|---|
| DECIDIR-DS-1 a DS-4 da [spec da base visual](spec-design-system-base.md) | **decidido** 2026-11-05 |
| [ADR-010](../adr/0010-tenant-organization-workspace-condominio.md) (P1 do PRD) | **aceito** 2026-11-05 |
| P2 decidido; P3 parcial (campos de unidade/pessoa) e D1–D2 de [11-dominio](../11-dominio.md) §3 | aberto |
| Escrever `spec-estrutura-condominio.md` e aprovar as duas specs da Onda 1 | a fazer |

## Onda 1 — fundação (2 agentes em paralelo)

| Trilha | Spec | Área de código | Bloqueio | Status |
|---|---|---|---|---|
| A — web | [spec-design-system-base](spec-design-system-base.md) | `apps/web` | aprovação da spec | pronta para aprovar |
| B — banco/API | `spec-estrutura-condominio.md` (workspaces, blocos, unidades, `unit_members` com histórico, papéis D1–D2, `app.my_unit_ids()`, rotas, testes A/B) | `supabase/`, `apps/api`, `packages/shared` | P3 (campos), D1, D2 | a escrever |

A e B não compartilham arquivo. Dono dos arquivos compartilhados nesta onda: trilha B (A não toca `packages/shared`).

## Onda 2 — acesso e marca (sequencial)

| Ordem | Spec | Área | Bloqueio | Status |
|---|---|---|---|---|
| 2.1 | [spec-personalizador](spec-personalizador.md) (marca e tema por condomínio; marca Vila Gaudí como dado) | `supabase/`, `apps/api`, `packages/shared`, `apps/web` | PZ-1 a PZ-3 | rascunho |
| 2.2 | `spec-cadastro-moradores.md` (página de cadastro **sem convite**, confirmação de e-mail via Resend/outbox, aprovação) | `supabase/`, `apps/api`, `packages/shared` | D4 | a escrever |
| 2.3 | `spec-telas-acesso.md` (login real, recuperar senha, cadastro, `/moradores`, aprovações, estrutura do condomínio) | `apps/web` | 2.2 + Onda 1 | a escrever |
| 2.4 | `spec-backoffice-minimo.md` (condomínios, usuários, auditoria dentro do portal; `super_admin`) | api + web | D3 | a escrever |

## Onda 3 — módulos do dia a dia (2 módulos por vez)

| Sub-onda | Spec | Rota do mock | Bloqueio | Status |
|---|---|---|---|---|
| 3a | `spec-comunicados.md` (morador vê todos) | `/comunicados` | — | a escrever |
| 3a | `spec-ocorrencias.md` | `/ocorrencias` | R7 de [11-dominio](../11-dominio.md) | a escrever |
| 3b | `spec-reservas.md` | `/reservas` | R8 de [11-dominio](../11-dominio.md) | a escrever |
| 3b | `spec-documentos.md` (morador vê todos) | `/documentos` | — | a escrever |

Cada módulo: migration própria + `apps/api/src/modules/<modulo>` + `apps/web/src/pages/<modulo>`. Os dois módulos de uma sub-onda rodam em paralelo; registro em arquivos compartilhados fica com um só dono.

## Onda 4 — Painel Geral enxuto

| Spec | Rota do mock | Bloqueio | Status |
|---|---|---|---|
| `spec-painel.md` (agrega os 4 módulos; sem tabela própria) | `/painel` | Onda 3 concluída | a escrever |

Fecha o primeiro release ([plano](../plano-desenvolvimento-condominio-360.md) §9).

## Depois da Onda 4

Fornecedores/contratos, manutenção preventiva, ordens de serviço/Minha Rotina, obras/aprovações, calendário/riscos/saúde predial, importação, financeiro e plataforma (plano §6 Fases 3–5). Ondas planejadas ao fim da Onda 4, conforme as decisões do plano §8.7–8.8.
