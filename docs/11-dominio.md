# Domínio do produto — ZELLO / portal do condomínio

> **Quando ler:** ao escrever qualquer PRD/spec, desenhar entidades de um módulo novo, definir papéis/permissões ou policies RLS.
> **Resumo:**
> - SaaS de gestão de condomínios: a conta é do cliente que paga (administradora ou condomínio autogerido); cada condomínio é um `workspace` dentro dela ([ADR-010](adr/0010-tenant-organization-workspace-condominio.md), aceita em 2026-11-05).
> - Papéis: `super_admin` (plataforma ZELLO, fora de `memberships`), `admin` (administradora e conselho), `manager` (síndico e subsíndico), `staff` (zelador/equipe), `member` (morador). Detalhes e pontos em aberto na §3.
> - Acesso de morador por **página de cadastro** (sem convites), com aprovação — §4 R6 (em aberto).
> - Seção vazia ou com `DECIDIR:` = pergunta à dona do produto, nunca suposição. Interface: [13-design-system](13-design-system.md) (REGRA DURA).
> **Relacionados:** [arquitetura](01-arquitetura.md), [banco](02-banco-de-dados.md), [segurança](03-seguranca.md), [plano](plano-desenvolvimento-condominio-360.md), [PRD estrutura e acesso](prd/estrutura-condominio-acesso.md), [workflow Claude](10-workflow-claude.md)

## Como o Claude usa este doc

- Antes de PRD/spec: ler só as seções que o módulo toca (normalmente 2, 3, 4 e 6).
- Seção em branco que o módulo precisa → perguntar ao humano (uma pergunta por vez, com opções e recomendação) e registrar a resposta aqui, não só na conversa.
- Nunca inventar regra de negócio, valor, prazo legal ou fornecedor. Fato legal/externo não confirmado leva `[verificar]`.
- Mudou o domínio → atualizar este doc no mesmo PR da spec. Decisão estrutural vira ADR.
- Nomes no código em inglês; o glossário (seção 9) liga ao termo de negócio em pt-BR.

## 1. Visão do produto

- O que o produto faz: portal do condomínio (avisos, ocorrências, reservas, documentos e, depois, operação e financeiro) com marca própria por condomínio sobre a plataforma ZELLO.
- Quem paga (`organization`): o cliente contratante — administradora (gere vários condomínios) ou condomínio autogerido (organização com um condomínio). Decisão P1, 2026-11-05.
- Quem usa no dia a dia: administradora, conselho, síndico/subsíndico, zelador/equipe, moradores.
- O que `workspace` significa aqui: **condomínio**. Blocos e unidades pertencem ao workspace.
- Fora do escopo do produto (por ora): portaria/visitantes, assembleias/votação, cobrança bancária (Fase 4 do plano).

## 2. Entidades e relações

```
organizations 1─N workspaces (condomínios) 1─N blocks 1─N units
units N─N users          (unit_members: relation = owner|tenant|dependent, starts_on/ends_on — histórico)
workspaces 1─1 workspace_branding (personalizador)
workspaces 1─N announcements 1─N announcement_reads
workspaces 1─N tickets 1─N ticket_events
workspaces 1─N common_areas 1─N reservations
workspaces 1─N documents 1─N document_versions
```

| Entidade (código) | Termo de negócio | Pertence a | Contém PII? | Notas |
|---|---|---|---|---|
| `workspaces` | Condomínio | organization | não | `cnpj/city/state` de exemplo revistos na spec de estrutura; endereço exibido no portal |
| `workspace_branding` | Personalização do portal | workspace | não | [spec-personalizador](specs/spec-personalizador.md) |
| `blocks` | Bloco/torre | workspace | não | campos: P3 (em aberto) |
| `units` | Unidade | workspace | não | campos: P3 (em aberto) |
| `unit_members` | Vínculo pessoa↔unidade | workspace | sim | proprietário, inquilino, dependente; **histórico mantido** (P3, 2026-11-05) |
| `unit_requests` (nome provisório) | Solicitação de cadastro | workspace | sim | só se R6 = cadastro com aprovação |

## 3. Papéis e matriz de permissão

Papéis de tenant vêm de `memberships`, nunca de claim do JWT. Decisão P2 (2026-11-05):

| Papel | Quem é neste produto | Escopo |
|---|---|---|
| `super_admin` | devs e donos da ZELLO; "veem tudo" | **plataforma** (todas as organizações) — não é `membership`; mecanismo em aberto (D3) |
| `owner` | `DECIDIR` (D1) | organização |
| `admin` | administradora **e** conselho | administradora: organização; conselho: ver D2 |
| `manager` | síndico(a) e subsíndico(a) | condomínio |
| `staff` | zelador e equipe | condomínio |
| `member` | morador (proprietário, inquilino, dependente) | condomínio + só as próprias unidades (`unit_members`) |

Matriz inicial (C = criar/editar, L = ler, P = só o próprio, — = nada):

| Recurso | admin | manager | staff | member |
|---|---|---|---|---|
| Condomínios, usuários, auditoria (backoffice no portal, P7) | C | L (do seu condomínio) | — | — |
| Personalizador | C | `DECIDIR` (PZ-2) | — | — |
| Blocos e unidades | C | C | L (mínimo) | P |
| Moradores e vínculos | C | C | L (mínimo, sem contato) | P |
| Comunicados | C | C | L | L (todos — decisão 2026-11-05) |
| Documentos | C | C | L | L (todos — decisão 2026-11-05) |
| Ocorrências | C | C | C (transições de zelador) | P |
| Reservas | C | C | L | P |

Em aberto:
- **D1 — `owner`:** a resposta P2 cita "owner.. super_admin". O `owner` do kit é o contratante da conta **dentro** do tenant (ex.: sócio da administradora, faturamento). Opções: (a) manter `owner` como contratante do cliente e criar `super_admin` à parte para a ZELLO — recomendado; (b) não usar `owner` no tenant.
- **D2 — Conselho como `admin`:** no schema atual `admin` vale para a organização inteira (`memberships_scope_check`, `supabase/migrations/20261030120000_base_multitenant.sql:78-81`). Numa administradora com vários condomínios, um conselheiro do condomínio A veria o condomínio B. Opções: (a) papel novo `council` restrito ao condomínio, com as mesmas telas do `admin` — recomendado; (b) permitir `admin` com `workspace_id` e revisar todas as policies que usam `app.has_org_role(['admin'])`; (c) aceitar o acesso a todos os condomínios da administradora.
- **D3 — `super_admin` "vê tudo":** exige mecanismo fora da RLS por tenant (tabela de operadores da plataforma + funções `security definer` auditadas). Para LGPD, recomendado: acesso a dado pessoal só com motivo registrado em `audit_log` e somente leitura por padrão `[verificar com jurídico]`. Entra na spec do backoffice.

## 4. Regras de negócio

| # | Regra | Fonte | Status |
|---|---|---|---|
| R1 | Um usuário pode ter acesso a vários condomínios e vínculo com várias unidades | plano §5 | confirmada (P1) |
| R2 | Morador só acessa com `memberships.member` **e** `unit_members` ativo | plano §5 | confirmada |
| R3 | Vínculo tem tipo (proprietário, inquilino, dependente) e histórico; encerrar preenche data de fim, não apaga | dona, P3 | confirmada |
| R4 | Comunicados e documentos: todo morador do condomínio vê tudo | dona, 2026-11-05 | confirmada |
| R5 | Backoffice (condomínios, usuários, auditoria) dentro do portal para `admin` | dona, P7 | confirmada |
| R6 | Acesso por página de cadastro, sem convites. Como o cadastro vira acesso (aprovação, código do condomínio, escolha da unidade) | dona, P5 | `DECIDIR` (D4) |
| R7 | Protocolo de ocorrência sequencial por condomínio e ano; morador vê só as próprias | mock | `DECIDIR` (Onda 3) |
| R8 | Reservas: áreas, valor/caução, aprovação, prazo de cancelamento | — | `DECIDIR` (Onda 3) |

- **D4 — Cadastro sem convite:** recomendado: página de cadastro do condomínio (link com slug), a pessoa informa nome, e-mail, bloco/unidade e tipo de vínculo, confirma o e-mail e fica **pendente** até aprovação de síndico ou administradora; só então ganha `member` + `unit_members`. Alternativa: aprovação automática por código secreto do condomínio (mais rápida, menos segura). Equipe (`staff`) e síndico entram cadastrados pela administradora.
- Valores monetários: centavos (`bigint`).

## 5. Integrações

| Integração | Para quê | Provedor | Obrigatória no MVP? |
|---|---|---|---|
| E-mail transacional | confirmação de cadastro, recuperação de senha, avisos | **Resend** (P6, 2026-11-05) | sim |
| Pagamento | cobranças (Fase 4) | `DECIDIR` | não |
| WhatsApp/push | avisos (Fase 5) | `DECIDIR` | não |
| Arquivos/PDF | anexos, documentos, marca | Supabase Storage (`private-files`; `public-assets` só marca) | sim |

Padrão: adapter + outbox/worker ([arquitetura](01-arquitetura.md) §"Integrações, outbox e webhooks"). Chave do Resend só no worker, nome em `.env.example` e no doc 09.

## 6. LGPD e retenção por tabela

| Tabela | Dados pessoais | Base legal | Retenção | Cifrado/mascarado? |
|---|---|---|---|---|
| `unit_members` / perfil | nome, e-mail, (telefone/CPF: P3) | `DECIDIR` `[verificar com jurídico]` | `DECIDIR` | e-mail mascarado em log |
| solicitação de cadastro | nome, e-mail, unidade declarada | `DECIDIR` | curta após decisão (`DECIDIR`) | — |

- Controlador: o condomínio/administradora; ZELLO: operador `[verificar com jurídico]`. Acesso do `super_admin` a dado pessoal é tratamento pelo operador — precisa de justificativa e trilha (D3).

## 7. Ordem de MVP

Ver [specs/README](specs/README.md) (ondas 0–4).

## 8. Perguntas ao PO

- [x] Quem paga — cliente contratante, administradora com vários condomínios (P1).
- [x] Papéis e perfis (P2), com D1–D3 em aberto.
- [ ] P3 — campos obrigatórios: unidade (bloco? andar? fração ideal?) e pessoa (telefone? CPF?).
- [ ] D4 — fluxo da página de cadastro.
- [ ] Ocorrências (R7) e reservas (R8) — antes da Onda 3.
- [ ] Financeiro no lançamento e superadmin/planos (plano §8.7–8.8).

## 9. Glossário

| Termo de negócio (pt-BR) | Nome no código | Definição |
|---|---|---|
| Cliente / conta | `organization` | administradora ou condomínio autogerido (tenant) |
| Condomínio | `workspace` | condomínio gerido pela conta |
| Bloco | `block` | torre/bloco do condomínio |
| Unidade | `unit` | apartamento/casa/sala |
| Vínculo | `unit_member` | pessoa↔unidade com tipo e período |
| Administradora / Conselho | `admin` (conselho: D2) | gestão da conta / fiscalização |
| Síndico / Subsíndico | `manager` | gestor do condomínio |
| Zelador / equipe | `staff` | operação |
| Morador | `member` | proprietário, inquilino ou dependente |
| Superadministrador | `super_admin` | operador da plataforma ZELLO |
