# Domínio do produto — ZELLO / portal do condomínio

> **Quando ler:** ao escrever qualquer PRD/spec, desenhar entidades de um módulo novo, definir papéis/permissões ou policies RLS.
> **Resumo:**
> - SaaS de gestão de condomínios: a conta é do cliente que paga (administradora ou condomínio autogerido); cada condomínio é um `workspace` dentro dela ([ADR-010](adr/0010-tenant-organization-workspace-condominio.md), aceita em 2026-11-05).
> - Papéis: `super_admin` (plataforma ZELLO, fora de `memberships`), `owner` (contratante da conta), `admin` (administradora), `council` (conselho, só o seu condomínio), `manager` (síndico e subsíndico), `staff` (zelador/equipe), `member` (morador). §3.
> - Sem convites: síndico/administradora pré-cadastram moradores e/ou o morador se cadastra; acesso só após aprovação — §4 R6.
> - Regra geral (2026-11-05): dados e regras **como estão no protótipo** do zip, ajustados só pelas regras de `docs/` (LGPD, segurança).
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
| `blocks` | Bloco | workspace | não | nome (ex.: "Bloco 1") — como no protótipo (`R/lib/moradores.ts:15`) |
| `units` | Unidade | workspace | não | bloco + número ("1201"); **sem andar nem fração ideal** (protótipo, P3) |
| `people` | Pessoa (morador, síndico, equipe) | workspace | sim | nome e e-mail obrigatórios; telefone, WhatsApp e foto opcionais; **sem CPF** (protótipo `R/lib/moradores.ts:6-11`); pode existir sem conta de login (pré-cadastro) |
| `unit_members` | Vínculo pessoa↔unidade | workspace | sim | Proprietário, Inquilino, Morador, Outros (protótipo `R/lib/moradores.ts:3`); dependente = "Morador"; **histórico mantido** |

## 3. Papéis e matriz de permissão

Papéis de tenant vêm de `memberships`, nunca de claim do JWT. Decisão P2 (2026-11-05):

| Papel | Quem é neste produto | Escopo |
|---|---|---|
| `super_admin` | devs e donos da ZELLO; "veem tudo" | **plataforma** (todas as organizações) — não é `membership` (D3) |
| `owner` | contratante da conta do cliente (D1) | organização |
| `admin` | administradora | organização |
| `council` | conselho ("Administração e Conselho" do protótipo) | **só o seu condomínio** (D2) |
| `manager` | síndico(a) e subsíndico(a) | condomínio |
| `staff` | zelador e equipe | condomínio |
| `member` | morador (proprietário, inquilino, dependente) | condomínio + só as próprias unidades (`unit_members`) |

Matriz inicial (C = criar/editar, L = ler, P = só o próprio, — = nada):

| Recurso | owner/admin | council | manager | staff | member |
|---|---|---|---|---|---|
| Condomínios, usuários, auditoria (backoffice no portal, P7) | C | — | L (seu condomínio) | — | — |
| Personalizador (PZ-2) | C | — | — | — | — |
| Blocos e unidades | C | L | C | L | L |
| Pessoas, vínculos, aprovação de acesso | C | — (protótipo: conselho não vê Moradores) | C | — | P |
| Comunicados | C | L | C | L | L (todos) |
| Documentos | C | L | C | L | L (todos) |
| Ocorrências | C | L | C | Em andamento / Executada | cria; vê todas; anexos só das próprias |
| Reservas | C (aprova) | L + próprias | C (aprova) | — | cria / cancela as próprias |

`super_admin`: tudo, em todas as contas, com trilha (D3). Telas por papel seguem o menu do protótipo (`R/components/vg/AppShell.tsx:14-39`).

Decididos em 2026-11-05:
- **D1:** `owner` = contratante da conta do cliente; `super_admin` separado, acima de todas as contas.
- **D2:** papel próprio `council` para o conselho, restrito ao condomínio (`workspace_id` obrigatório, como `manager`). O `memberships_scope_check` (`supabase/migrations/20261030120000_base_multitenant.sql:78-81`) e `ROLES` (`packages/shared/src/tenancy.ts:4-8`) mudam na [spec de estrutura](specs/spec-estrutura-condominio.md).
- **D3:** `super_admin` vê tudo; acesso a dado pessoal só com motivo registrado em `audit_log` (somente leitura por padrão) `[verificar com jurídico]`. Mecanismo na spec do backoffice (Onda 2.4).

## 4. Regras de negócio

| # | Regra | Fonte | Status |
|---|---|---|---|
| R1 | Um usuário pode ter acesso a vários condomínios e vínculo com várias unidades | plano §5 | confirmada (P1) |
| R2 | Morador só acessa com `memberships.member` **e** `unit_members` ativo | plano §5 | confirmada |
| R3 | Vínculo tem tipo (Proprietário, Inquilino, Morador, Outros) e histórico; encerrar preenche data de fim, não apaga | dona, P3 + protótipo | confirmada |
| R4 | Comunicados e documentos: todo morador do condomínio vê tudo | dona, 2026-11-05 | confirmada |
| R5 | Backoffice (condomínios, usuários, auditoria) dentro do portal para `admin` | dona, P7 | confirmada |
| R6 | Sem convites. Síndico/administradora **pré-cadastram** todos os moradores (pessoa + unidade) com a lista que já têm; o morador cria o acesso pela página de cadastro do condomínio (`/c/<slug>/cadastro`), confirma o e-mail e fica **pendente** até síndico ou administradora aprovar. E-mail igual a um pré-cadastro → vincula a ele; sem pré-cadastro → solicitação nova com unidade declarada | dona, D4 | confirmada |
| R7 | Ocorrências como no protótipo: protocolo `OC-AAAA-0001` sequencial por condomínio e ano, nunca reutilizado (`R/lib/protocolo.ts:1-6`); categorias Manutenção, Reclamação, Sugestões, Elogio, Outros; status Aberta → Em andamento → Executada → Concluída; zelador só move para Em andamento/Executada, só síndico/administração concluem (`R/lib/ocorrencias.ts:24-29`); morador vê "Minhas" e "Todas", anexos só das próprias (`R/routes/ocorrencias.tsx:34-39`) | dona ("todos") + protótipo | confirmada; LGPD: o que de autor/unidade aparece em "Todas" vai para a spec |
| R8 | Reservas como no protótipo: áreas configuráveis por condomínio (nome, descrição, capacidade, valor, dias da semana, prazo de cancelamento — `R/lib/reservas.ts:1-12`); uma reserva Pendente/Aprovada bloqueia o dia da área; status Pendente → Aprovada/Recusada por síndico/administração, Cancelada pelo morador até N dias antes (padrão 2); sem caução | dona ("todos") + protótipo | confirmada; valores das áreas do Vila Gaudí são dado do condomínio |

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
| `people` / `unit_members` | nome, e-mail, telefone, WhatsApp, foto | `DECIDIR` `[verificar com jurídico]` | `DECIDIR` | telefone/WhatsApp cifrados (AES-256-GCM na API + HMAC, [03](03-seguranca.md) §"Criptografia"), mascarados na resposta, revelação auditada; e-mail fora de log |
| solicitação de cadastro | nome, e-mail, unidade declarada | `DECIDIR` | curta após decisão (`DECIDIR`) | — |

- Controlador: o condomínio/administradora; ZELLO: operador `[verificar com jurídico]`. Acesso do `super_admin` a dado pessoal é tratamento pelo operador — precisa de justificativa e trilha (D3).

## 7. Ordem de MVP

Ver [specs/README](specs/README.md) (ondas 0–4).

## 8. Perguntas ao PO

- [x] Quem paga — cliente contratante, administradora com vários condomínios (P1).
- [x] Papéis e perfis (P2), com D1–D3 em aberto.
- [x] P3 — como no protótipo: unidade = bloco + número; pessoa = nome + e-mail (telefone, WhatsApp, foto opcionais); sem CPF.
- [x] D1–D4, R6–R8 (2026-11-05).
- [ ] Base legal e retenção dos dados de pessoas `[verificar com jurídico]`.
- [ ] Financeiro no lançamento e superadmin/planos (plano §8.7–8.8).

## 9. Glossário

| Termo de negócio (pt-BR) | Nome no código | Definição |
|---|---|---|
| Cliente / conta | `organization` | administradora ou condomínio autogerido (tenant) |
| Condomínio | `workspace` | condomínio gerido pela conta |
| Bloco | `block` | torre/bloco do condomínio |
| Unidade | `unit` | apartamento/casa/sala |
| Vínculo | `unit_member` | pessoa↔unidade com tipo e período |
| Administradora | `admin` | gestão da conta |
| Conselho | `council` | fiscalização de um condomínio |
| Pessoa | `person` | morador, síndico ou equipe cadastrado no condomínio, com ou sem login |
| Síndico / Subsíndico | `manager` | gestor do condomínio |
| Zelador / equipe | `staff` | operação |
| Morador | `member` | proprietário, inquilino ou dependente |
| Superadministrador | `super_admin` | operador da plataforma ZELLO |
