# ADR-010 — `organization` é o cliente pagante e `workspace` é o condomínio

> Status: aceito — Data: 2026-11-05 — Decidido por: dona do produto (resposta P1)
> Origem: [plano](../plano-desenvolvimento-condominio-360.md) §5 e §6 Fase 0 item 3; perguntas §8 itens 1 e 8.

## Contexto

O scaffold já fixa `organization → workspaces → recursos` com papéis em `memberships` (`supabase/migrations/20261030120000_base_multitenant.sql:44-83`): `owner/admin` valem para a organização inteira (`workspace_id` nulo) e `manager/staff/member` exigem `workspace_id` (`memberships_scope_check`, `:78-81`). O mock Condomínio 360 trata cada condomínio como um tenant com marca própria (`docs/referencias/condominio-360/src/lib/brand.ts:6-21`) e tem uma área de superadmin ZELLO acima de todos (`/plataforma/*`). Precisamos fixar o significado de `organization` e `workspace` antes da primeira migration de domínio (blocos, unidades, `unit_members`), porque mudar depois exige migrar dados e policies.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| A. `organization` = cliente pagante (administradora **ou** condomínio autogerido); `workspace` = condomínio | Usa o modelo base sem mudar schema; administradora gere N condomínios com um login; síndico/zelador/morador ficam presos a um condomínio pelo `workspace_id`; condomínio autogerido = organização com 1 workspace | Condomínio que troca de administradora exige transferir o workspace entre organizations (operação rara, precisa de spec própria) |
| B. `organization` = condomínio; `workspace` não usado | Isolamento máximo por condomínio; marca 1:1 com tenant | Administradora com vários condomínios precisa de N logins/memberships e não tem visão consolidada; desperdiça o nível `workspace` já implantado |
| C. `organization` = condomínio; `workspace` = bloco/torre | Bloco ganha escopo de papel | Bloco não precisa de papel próprio no mock; complica RLS sem ganho; mesma limitação da B para administradoras |

## Decisão

**Opção A**, confirmada pela dona em 2026-11-05: a conta é do cliente que paga (administradora ou condomínio autogerido) e cada condomínio é um workspace dentro dela. É a que o modelo base já suporta sem migration estrutural e a única que atende administradora com vários condomínios.

## Consequências

- Positivas: blocos/unidades/`unit_members` e todos os módulos levam `organization_id` + `workspace_id`, com policies via `app.workspace_ids()` e o novo `app.my_unit_ids()` para `member`. Marca (nome do portal, logo, foto, cores — [13](../13-design-system.md) §3.6) pertence ao **workspace**.
- Negativas/aceitas: troca de administradora vira operação de suporte (spec futura); o superadmin ZELLO não é um papel de `memberships` (precisa de mecanismo interno separado, a decidir na spec do backoffice).
- Ações decorrentes: preencher [11-dominio](../11-dominio.md) §1–3; revisar colunas de exemplo `cnpj/city/state` de `app.workspaces` na spec de onboarding; acrescentar linha na tabela de ADRs de [01-arquitetura](../01-arquitetura.md) §"Decisões" quando aceita.

## Segurança, tenant e LGPD

- Itens de [03-seguranca.md](../03-seguranca.md) afetados: isolamento entre tenants (inalterado: fronteira continua `organization_id`), autorização por papel (morador nunca só por `member`, sempre também por `unit_members`).
- Risco novo: usuário com `admin` enxerga todos os condomínios da organização. Desejado para a administradora; **não** para o conselho, que a dona também mapeou como `admin` — tratado em [11-dominio](../11-dominio.md) §3 D2.
- `super_admin` (ZELLO) fica fora deste modelo de tenant ([11-dominio](../11-dominio.md) §3 D3).

## Revisar quando

Primeiro cliente for condomínio autogerido que exige isolamento total de outra entidade, ou surgir caso de condomínio com duas administradoras simultâneas.
