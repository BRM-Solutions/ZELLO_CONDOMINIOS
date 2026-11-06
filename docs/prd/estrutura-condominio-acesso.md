# PRD — Estrutura do condomínio e acesso (condomínios, blocos, unidades, pessoas e cadastro)

> Status: em revisão (P1, P2, P5–P7 respondidas em 2026-11-05; P3 parcial; D1–D4 em [11-dominio](../11-dominio.md)) — Data: 2026-11-05
> Origem: [plano](../plano-desenvolvimento-condominio-360.md) §6 Fase 1. Depende de [ADR-010](../adr/0010-tenant-organization-workspace-condominio.md). Interface: [13-design-system](../13-design-system.md) (REGRA DURA) — telas `/moradores`, `/plataforma/condominios` e `/plataforma/usuarios` do mock.

## 1. Problema

Sem condomínio estruturado (blocos e unidades) e sem saber quem mora/trabalha em cada um, nenhum módulo do portal (comunicados, ocorrências, reservas, documentos) consegue decidir quem vê o quê. Hoje o scaffold só tem organização, workspace e memberships genéricos; o mock resolve isso com dados fixos e troca de papel no navegador, o que não serve para produção.

## 2. Usuários e papéis

Mapeamento decidido (P2, 2026-11-05); pontos D1–D3 em aberto em [11-dominio](../11-dominio.md) §3:

| Papel (código) | Quem é (proposta) | Precisa fazer | Não pode fazer |
|---|---|---|---|
| `super_admin` | devs e donos da ZELLO | ver tudo, em todas as contas (mecanismo e trilha: D3) | — |
| `owner` | contratante da conta (D1) | tudo do `admin`; dados da organização | — |
| `admin` | administradora e conselho (conselho: D2) | criar condomínio, estruturar blocos/unidades, cadastrar síndico/equipe, aprovar moradores, ver auditoria | — |
| `manager` | síndico(a) e subsíndico(a) | manter unidades e moradores do seu condomínio, aprovar cadastros | ver outros condomínios; mudar papéis `owner/admin` |
| `staff` | zelador/equipe | consultar diretório mínimo de unidades (para operação) | ver contato/dados pessoais de moradores além do necessário |
| `member` | morador | ver o próprio perfil e as próprias unidades | ver outras unidades e outros moradores |

O perfil "Administração e Conselho" do mock = `admin` (P2), com o escopo do conselho em aberto (D2).

## 3. Histórias principais

1. Como `admin`, quero cadastrar um condomínio (nome, endereço) para começar a operá-lo no portal.
2. Como `admin`/`manager`, quero criar blocos e unidades (individualmente e em lote, ex.: "Bloco 1, aptos 101–1504") para refletir a estrutura real.
3. Como morador, quero me cadastrar pela página do meu condomínio informando unidade e tipo de vínculo, confirmar meu e-mail e acessar o portal assim que aprovado (sem convite — P5).
4. Como `admin`/`manager`, quero aprovar ou recusar cadastros pendentes e cadastrar diretamente síndico e equipe.
5. Como `admin`/`manager`, quero encerrar o vínculo de uma pessoa com a unidade (mudança, fim de locação) sem apagar o histórico.
6. Como `member`, quero ver minhas unidades e meus dados no perfil.
7. Como `admin`, quero consultar quem mudou o quê (auditoria mínima).

## 4. Regras de negócio

- R1: um usuário pode ter memberships em vários condomínios e vínculos com várias unidades. Fonte: plano §5.
- R2: acesso de morador = membership `member` no workspace **e** `unit_members` ativo; sem vínculo ativo, não vê dados de unidade. Fonte: plano §5.
- R3: vínculo com tipo (proprietário, inquilino, dependente) e histórico; encerrar preenche data de término, não apaga a linha. Fonte: dona, P3 (2026-11-05).
- R4: código da unidade é único dentro do bloco/condomínio. Fonte: (confirmar §9 P3).
- R5: não há convites; acesso por página de cadastro (P5). Fluxo de aprovação: D4 em [11-dominio](../11-dominio.md) §4.
- Demais regras (tipos de vínculo, fração ideal, vaga de garagem): §9.

## 5. Dados

| Dado | Pessoal? | Quem vê | Retenção |
|---|---|---|---|
| Condomínio: nome, endereço, (CNPJ?) | não | todos do condomínio | enquanto cliente ativo `DECIDIR` |
| Bloco, unidade (código, andar?, fração ideal?) | não | todos do condomínio (`member` só as próprias com detalhe) | idem |
| Pessoa: nome, e-mail | sim | admin/manager; `staff` mínimo necessário `DECIDIR` | enquanto vínculo ativo + prazo `DECIDIR` |
| Pessoa: telefone, CPF | sim (CPF sensível para fraude) | só se necessário — `DECIDIR` se coleta | `DECIDIR` |
| Vínculo pessoa↔unidade (tipo, início, fim) | sim | admin/manager; o próprio morador | histórico `DECIDIR` |
| Solicitação de cadastro (nome, e-mail, unidade declarada, status) | sim | admin/manager | curta após aprovação/recusa `DECIDIR` |

## 6. Fora do MVP

Portaria/visitantes, vagas de garagem, fração ideal para rateio (só quando houver financeiro), importação de moradores por planilha (plano Fase 3), perfis customizáveis (plano §3 `/perfis-permissoes`), superadmin/planos.

## 7. Integrações

E-mail transacional (confirmação de cadastro, aprovação, recuperação de senha) via outbox/worker (`app.outbox`), fornecedor **Resend** (P6). Supabase Auth para criação de senha/login.

## 8. Métrica de sucesso

Administradora estrutura um condomínio de ~250 unidades e convida o síndico em menos de 30 min; zero acesso cruzado entre condomínios/unidades nos testes A/B.

## 9. Perguntas em aberto

- [x] **P1**: cliente pagante (administradora ou autogerido); administradora gere vários condomínios. [ADR-010](../adr/0010-tenant-organization-workspace-condominio.md) aceita.
- [x] **P2**: super_admin (ZELLO), admin (administradora e conselho), manager (síndico e subsíndico), staff, member. Pendências D1–D3.
- [x] **P3**: como no protótipo — unidade = bloco + número; pessoa = nome + e-mail, telefone/WhatsApp/foto opcionais, sem CPF; vínculos Proprietário/Inquilino/Morador/Outros com histórico. Spec: [spec-estrutura-condominio](../specs/spec-estrutura-condominio.md).
- [x] **P4/P5**: sem convites; página de cadastro. Fluxo de aprovação: D4.
- [x] **P6**: e-mail via Resend.
- [x] **P7**: backoffice dentro do portal para `admin`.

## 10. Riscos legais/LGPD

Diretório de moradores é dado pessoal: base legal e minimização `[verificar com jurídico]`; `staff` não deve ver contato além do necessário; exportação de diretório auditada. CPF só se houver finalidade clara.
