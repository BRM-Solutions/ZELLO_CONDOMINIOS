# Exemplo de domínio preenchido — SaaS de administração de condomínios

> **Quando ler:** só como referência de formato ao preencher [11-dominio](../11-dominio.md), ou se o seu produto for deste nicho. Não é requisito de nada.
> **Resumo:**
> - Este arquivo é um **EXEMPLO** de como preencher `docs/11-dominio.md` para um nicho concreto. Tudo aqui é hipótese; nada vira requisito sem PRD aprovado.
> - Mapeamento para o modelo genérico do kit: `organization` = administradora (ou condomínio autogerido); `workspace` = condomínio; `manager` = síndico/subsíndico; `staff` = portaria/zeladoria; `member` = morador (proprietário ou inquilino).
> - Dinheiro (cobrança, inadimplência, prestação de contas) e assembleia têm regra legal: confirmar com advogado/contador.
> - Morador é titular de dados pessoais (LGPD): mínimo necessário, base legal e retenção definidas por módulo.
> - MVP sugerido: cadastro → comunicados → cobrança simples → ocorrências; o resto depois.
> **Relacionados:** [domínio (template)](../11-dominio.md), [arquitetura](../01-arquitetura.md), [banco](../02-banco-de-dados.md), [segurança](../03-seguranca.md), [PRD template](../templates/prd-template.md)

Para usar: se o seu produto é deste nicho, copie as seções úteis para `docs/11-dominio.md` e valide cada uma com quem conhece o negócio. Se não for, use só a estrutura.

Citações legais abaixo são ponto de partida, **não parecer jurídico**. Todas `[verificar com advogado]`.

## 1. Módulos típicos

| Módulo | O que costuma ter | Complexidade |
|---|---|---|
| Cadastro | condomínios, blocos/torres, unidades, frações ideais, proprietários, moradores/inquilinos, veículos, pets | baixa |
| Taxas e rateio | taxa ordinária, extra, fundo de reserva, rateio por fração ou igualitário, consumo individual (água/gás) | média |
| Cobrança | boleto/PIX, 2ª via, baixa por webhook, multa/juros, inadimplência, acordos/parcelamento | alta |
| Contas a pagar | fornecedores, notas, aprovação do síndico, conciliação bancária | média |
| Prestação de contas | balancete mensal, demonstrativo, anexos, aprovação em assembleia | média |
| Assembleias | convocação, pauta, presença, procuração, votação (presencial/virtual), ata | alta |
| Comunicados | mural, aviso por e-mail/WhatsApp, confirmação de leitura | baixa |
| Reservas | áreas comuns, regras (antecedência, taxa, limite), calendário | média |
| Ocorrências/chamados | abertura pelo morador, triagem, status, anexos | baixa |
| Manutenção | preventiva (elevador, bomba, extintor, AVCB), calendário, fornecedor | média |
| Portaria | visitantes, prestadores, encomendas, liberação | média |
| Documentos | convenção, regimento interno, atas, contratos, apólices | baixa |

## 2. Papéis (base do kit) e matriz de permissão

Papéis vêm da tabela `memberships`, nunca de claim do JWT. `workspace_id` nulo = vale para a organização inteira.

| Papel | Quem é | Escopo |
|---|---|---|
| `owner` | dono da conta do SaaS na administradora | organização |
| `admin` | funcionário da administradora | organização |
| `manager` | síndico / subsíndico | condomínio |
| `staff` | porteiro, zelador, conselheiro `DECIDIR` | condomínio |
| `member` | proprietário ou inquilino | unidade(s) |

Matriz (C = criar/editar, L = ler, P = ler só o próprio, — = nada):

| Recurso | owner | admin | manager | staff | member |
|---|---|---|---|---|---|
| Organização, plano, faturamento do SaaS | C | L | — | — | — |
| Usuários e papéis | C | C | C (do condomínio, sem admin) | — | — |
| Cadastro de unidades/moradores | C | C | C | L (nome/unidade) | P |
| Cobranças e inadimplência | C | C | L | — | P |
| Contas a pagar | C | C | C (aprovar) | — | — |
| Prestação de contas | C | C | C | — | L (após publicação) |
| Assembleias e votação | C | C | C | — | L + votar |
| Comunicados | C | C | C | L | L |
| Reservas | C | C | C | L | C (próprias) |
| Ocorrências | C | C | C | C | C (próprias) |
| Portaria/encomendas | C | C | C | C | P |
| Audit log | L | L | L (do condomínio) | — | — |

`DECIDIR:` conselho fiscal como papel próprio (`council`)? Inquilino vota? (em geral só com procuração do proprietário `[verificar]`).

## 3. Regras de negócio e legais (hipóteses)

- **Código Civil, arts. 1.331–1.358** regem o condomínio edilício; a **Lei 4.591/64** ficou subsidiária nessa parte `[verificar]`.
- **Contribuição**: obrigação do condômino na proporção da fração ideal, salvo convenção diferente (CC art. 1.336, I) `[verificar]`.
- **Multa e juros**: multa de até **2%** e juros moratórios convencionados ou, se não previstos, **1% ao mês** (CC art. 1.336, §1º); correção monetária conforme convenção `[verificar efeito da Lei 14.905/2024 sobre juros]`. O sistema deve ter esses valores **configuráveis por condomínio**, com teto validado.
- **Cobrança judicial**: a contribuição condominial é título executivo extrajudicial (CPC art. 784, X) `[verificar]` → histórico de cobrança e boleto precisam ser íntegros e auditáveis.
- **Condômino antissocial / reiterado**: multas até 5x/10x a contribuição (CC art. 1.337) — exige deliberação em assembleia `[verificar]`.
- **Síndico**: mandato até 2 anos, renovável; dever de prestar contas anualmente e quando exigido (CC arts. 1.347–1.348) `[verificar]`.
- **Quóruns**: alteração da convenção 2/3; outras matérias variam (CC arts. 1.351–1.353). O sistema registra votos e calcula resultado por fração ou por unidade conforme a convenção — **configurável**.
- **Assembleia virtual**: a **Lei 14.309/2022** incluiu no CC a assembleia eletrônica/híbrida e a sessão permanente (art. 1.354-A e alteração do 1.353) — requisitos de convocação, identificação e registro `[verificar texto e se a convenção precisa autorizar]`.
- **Acordos**: parcelamento de dívida gera novo cronograma; débito original não some (auditoria).
- **Fundo de reserva**: percentual definido em convenção/assembleia; contabilmente separado.

## 4. LGPD aplicada

- Dados típicos: nome, CPF, telefone, e-mail, unidade, placa, foto/biometria da portaria, situação de inadimplência.
- **Biometria/foto facial é dado sensível** (LGPD art. 5º, II; art. 11): `DECIDIR` se o produto armazena; se sim, base legal específica e segregação `[verificar]`.
- Base legal provável: execução de contrato/obrigação legal para cobrança; legítimo interesse para portaria; consentimento só quando não houver outra `[verificar]`.
- **Inadimplência não pode ser exposta** a outros moradores (lista pública de devedores é risco jurídico) `[verificar jurisprudência]` → `member` só vê o próprio débito.
- Papéis: o condomínio (ou administradora) é controlador; o SaaS é **operador** → contrato/DPA, registro de operações, atendimento a titular (acesso, correção, exclusão quando cabível).
- Retenção: documentos fiscais/contábeis têm prazo legal; dado de visitante deve expirar `DECIDIR prazo`.
- Técnicas: CPF cifrado ou mascarado na UI, `audit_log` de acesso a dado sensível, export do titular. Ver [segurança](../03-seguranca.md).

## 5. Entidades candidatas (esboço, sem SQL)

Todas com `organization_id`; `workspace_id` quando aplicável; `uuid`, `created_at/updated_at`.

```
organizations 1─N workspaces 1─N blocks 1─N units
units N─N users         (unit_members: relation = owner|tenant|dependent, starts_on/ends_on — ver 5.1)
people 0─1 auth user    (memberships liga user ↔ org/condomínio/papel)
workspaces 1─N fee_rules           (tipo, base de rateio, vencimento, multa/juros)
units 1─N charges 1─N payments        (charge: competência, valor, status; payment: origem, webhook id)
charges N─1 agreements (acordos) 1─N agreement_installments
workspaces 1─N suppliers 1─N bills (contas a pagar) ─ approvals
workspaces 1─N ledger_entries      (lançamentos p/ prestação de contas)
workspaces 1─N assemblies 1─N agenda_items 1─N votes (por unit, com proxy opcional)
assemblies 1─1 minutes (ata, documento)
workspaces 1─N announcements 1─N announcement_reads
workspaces 1─N common_areas 1─N reservations
workspaces 1─N tickets (ocorrências) 1─N ticket_events
workspaces 1─N maintenance_plans 1─N maintenance_tasks
workspaces 1─N visitors / deliveries
workspaces 1─N documents (storage path, categoria, visibilidade)
audit_log, outbox (infra)
```

### 5.1 Unidade e o papel `member` (necessário desde a base)

O filtro do `member` depende da unidade, não só do condomínio ([segurança](../03-seguranca.md) §Autorização). Proposta:

- `app.units(id, organization_id, workspace_id, block_id, code, ideal_fraction numeric, ...)` com FK composta para `workspaces`.
- `app.unit_members(id, organization_id, workspace_id, unit_id, user_id, relation, starts_on, ends_on, status)` — `relation` in (`owner`, `tenant`, `dependent`) `DECIDIR`; um usuário pode estar em várias unidades; histórico mantido por `ends_on` (troca de inquilino não apaga).
- `memberships` continua com `role = 'member'` + `workspace_id` (dá acesso ao condomínio); `unit_members` diz **quais unidades** ele enxerga.
- Helper na migration base, no mesmo padrão de `app.workspace_ids()` ([banco](../02-banco-de-dados.md)): `app.my_unit_ids()` → `setof uuid` das unidades ativas do usuário atual na org atual.
- Policy típica de tabela por unidade (cobranças, ocorrências, encomendas):
  - staff+: `workspace_id in (select app.workspace_ids(array['owner','admin','manager','staff']))`;
  - member: `unit_id in (select app.my_unit_ids())`.
- Tabelas de condomínio inteiro (comunicados, documentos públicos, áreas comuns) ficam só no filtro por condomínio.
- Proprietário que não mora (só cobrança) e inquilino (só ocorrências/reservas): diferenciar por `relation` na policy ou no service `DECIDIR`.

Pontos a decidir: pessoa pode ter várias unidades e vários condomínios; valores monetários em centavos (`bigint`); competência como `date` (dia 1); status como `text` + `check`.

## 6. Ordem de MVP sugerida

1. Base multi-tenant + convite de usuários + cadastro (condomínio, bloco, unidade, pessoa).
2. Comunicados (valor rápido, baixo risco, testa permissões e notificação).
3. Ocorrências/chamados.
4. Cobrança simples: gerar cobranças por competência, boleto/PIX via adapter, baixa por webhook idempotente.
5. Inadimplência + acordos.
6. Reservas, documentos.
7. Prestação de contas e contas a pagar.
8. Assembleias virtuais (maior risco legal; deixar para quando as regras estiverem validadas).

`DECIDIR:` se o cliente-alvo é administradora (multi-condomínio, financeiro forte) ou condomínio autogerido (simplicidade) — muda a ordem.

## 7. Perguntas para o PRD

1. Quem paga o SaaS: administradora, condomínio ou ambos? Preço por unidade?
2. Quem usa no dia a dia: administradora, síndico, morador, portaria? Qual a primeira tela de cada um?
3. Morador acessa o app? Inquilino tem login próprio?
4. O sistema emite cobrança ou só controla? Qual banco/gateway? Conta do condomínio ou da administradora?
5. Rateio: por fração ideal, igualitário, misto? Consumo individual?
6. Multa/juros/correção vêm da convenção de cada condomínio?
7. Precisa de contabilidade de verdade (plano de contas) ou só demonstrativo de caixa?
8. Assembleia virtual é requisito do MVP? Votação por fração ou por unidade?
9. Portaria com biometria/foto? Integração com hardware?
10. Canais de notificação: e-mail, WhatsApp, push?
11. Importação de dados de outro sistema (planilha)? De qual?
12. Requisitos de nota fiscal do SaaS e de relatório para contador?
13. Volume esperado: quantos condomínios/unidades no primeiro ano?

## 8. Integrações prováveis

| Integração | Padrão |
|---|---|
| Boleto/PIX (bancos, gateways) | adapter por provedor + webhook idempotente (chave = id do evento) + outbox |
| WhatsApp (gateway de WhatsApp) | adapter + fila/outbox, opt-in do morador, retry com limite |
| E-mail transacional | SMTP/API, templates pt-BR, mesmo outbox |
| PDF (boleto, balancete, ata) | geração no servidor, guardado no Storage privado, URL assinada |
| Conciliação bancária (OFX/CNAB) | importação de arquivo, nunca credencial do banco no sistema `DECIDIR` |
| Assinatura eletrônica de ata | provedor externo `DECIDIR` |

Detalhe do padrão adapter/webhook/outbox: [arquitetura](../01-arquitetura.md) e [backend](../05-backend-api.md).
