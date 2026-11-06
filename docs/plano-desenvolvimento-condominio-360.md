# Plano de desenvolvimento — Condomínio 360 / ZELLO

> Status: rascunho para validação do produto — 05-11-2026
>
> Referência de UX analisada: `docs/referencias/condominio-360/` (extraída de `docs/condominio-360-projeto-mock-v2.zip`). Este plano não autoriza implementar módulos com decisões de negócio em aberto.

## 1. Conclusão executiva

O mock descreve um portal de condomínio e uma área de superadmin para a plataforma ZELLO. Ele é uma boa fonte de jornadas, nomenclatura e estados de tela, mas é um **protótipo local**, não a base para produção: usa TanStack Start, React 19, Tailwind, `createMiniStore` e troca de papel no navegador. O projeto-alvo já tem a arquitetura adequada para produção: monorepo pnpm/Node 22, React 18 + Vite, Express 4 + `pg` direto, Zod compartilhado, Supabase Auth/Postgres/Storage, RLS e transações por tenant.

Decisão recomendada: recriar a UX necessária em `apps/web`, por módulos, usando o stack já definido. Não copiar o app extraído, seu `package.json`, Tailwind, stores ou sua autorização simulada.

## 2. Estado real do repositório

| Área | Já existe | Lacuna para o produto |
|---|---|---|
| Base técnica | API Express, web Vite/React, pacote shared, Docker, CI e deploy documentado | Produto ainda usa `{{PROJETO}}`/`{{SLUG}}`; rodar a inicialização/nomeação antes do primeiro release |
| Identidade e tenant | Auth Supabase, verificação JWT por JWKS, memberships, `withTenantTx`, RLS, papéis `owner/admin/manager/staff/member` | Onboarding, convite e mapeamento dos papéis de condomínio |
| Dados | `organizations`, `workspaces`, memberships, auditoria, outbox, webhooks/idempotência e Storage governado | Todas as entidades de negócio do condomínio |
| Web atual | Login, troca de organização, lista de workspaces e tela administrativa mínima | Shell, rotas, queries, formulários e todas as telas de domínio |
| Arquivos | Fluxo seguro de metadados/URL assinada, retenção e worker | Vínculos dos arquivos aos módulos (documento, ocorrência, despesa etc.) |

O arquivo `docs/11-dominio.md` ainda é o template vazio. O exemplo `docs/exemplos/dominio-condominios.md` é uma hipótese útil, mas não substitui decisões da dona do produto.

## 3. Leitura do mock: telas e destino recomendado

Legenda: **MVP** = candidata à primeira versão; **depois** = depende de maturidade/decisão; **referência** = não é uma feature de produto a transportar. Toda tela abaixo exige estados de carregamento, erro, vazio, responsividade 320–414 px e autorização no servidor.

### Portal do condomínio

| Rota do mock | O que a tela demonstra | Destino |
|---|---|---|
| `/` | escolha de perfil e entrada demonstrativa | Substituir por login/onboarding reais; **MVP** |
| `/recuperar-senha` | recuperação de senha | Usar fluxo de reset do Supabase Auth; **MVP** |
| `/painel` | indicadores, pendências, ocorrências, equipe e contratos | Dashboard somente após os módulos fonte; **MVP enxuto** |
| `/comunicados` | avisos, prioridade, anexos, leitura e CRUD | `announcements` + leituras + outbox; **MVP** |
| `/ocorrencias` | chamado com protocolo, anexos, prioridade e encerramento | `tickets` + eventos; **MVP** |
| `/reservas` | disponibilidade por área, calendário, solicitação, aprovação/cancelamento | `common_areas` e `reservations`; **MVP** |
| `/documentos` | arquivo, categoria, visibilidade, versão e vínculo | metadados próprios ligados a `app.files`; **MVP** |
| `/configuracoes` | preferências de comunicação e canais | preferências por usuário; **MVP básico** |
| `/perfil` | dados do usuário e atalhos pessoais | perfil autenticado; **MVP básico** |
| `/notificacoes` | caixa de notificações e marcação de leitura | `notifications` entregue pelo outbox; **depois** (usar e-mail no início) |
| `/regras` | regras de convivência | documento/aviso publicado; **MVP reduzido**, sem módulo separado |
| `/moradores` | diretório, unidades, vínculo e convite/acesso | pessoas, blocos, unidades e `unit_members`; **MVP administrativo** |
| `/fornecedores` | fornecedores, contratos, vencimentos e anexos | fornecedores/contratos; **depois** |
| `/equipe` | colaboradores, escalas, ausências e cobertura | equipe/escalas; **depois** |
| `/calendario` | agenda agregando reservas, obras, preventivas e escalas | projeção somente-leitura dos módulos fonte; **depois** |
| `/manutencoes` | plano preventivo, periodicidade, execução e evidências | maintenance plans/tasks; **Fase 2** |
| `/ordens-servico` | criação, checklist, responsável, mensagens, evidências e validação | work orders; **Fase 2** |
| `/minha-rotina` | visão operacional do zelador para as ordens | projeção de ordens; **Fase 2** |
| `/obras` | obra, etapas, custos e documentos | obras/etapas; **Fase 3** |
| `/riscos` | pendências derivadas de preventivas, ordens, contratos e documentos | relatório derivado, sem tabela própria inicialmente; **Fase 3** |
| `/saude-predial` | score e indicadores operacionais derivados | painel derivado com fórmula aprovada; **Fase 3** |
| `/aprovacoes` | orçamentos, propostas, pareceres e contratação | propostas/aprovações; **Fase 3** |
| `/financeiro` | balancete, despesas, notas/recibos, comunicação e conferência | contas a pagar/razão/conciliação; **Fase 3**, após regras contábeis |
| `/importacao` | importação de XLS/XLSX/PDF, validação e rejeições | pipeline de importação auditável; **Fase 3**, começar por CSV/XLSX |
| `/inadimplencia` | lista de atrasos e acordos | cobranças/acordos; **Fase 4**, alto risco financeiro/LGPD |
| `/relatorios` | catálogo/download de relatórios | geração de relatórios/PDF/CSV por módulo; **depois** |
| `/perfis-permissoes` | perfis e matriz granular de permissões | inicialmente mapear aos cinco roles fixos; customização por perfil fica **depois** |
| `/design-system` | demonstração de componentes e tokens | Referência visual; não expor em produção |

### Administração da plataforma

| Rota do mock | O que a tela demonstra | Destino |
|---|---|---|
| `/plataforma` | entrada demonstrativa de superadmin | backoffice separado e guardado por role interno; **depois da base SaaS** |
| `/plataforma/painel` | métricas de tenants/plataforma | telemetria agregada sem PII; **depois** |
| `/plataforma/condominios` | criação/status/branding dos condomínios | onboarding de organization + workspace; **MVP administrativo** |
| `/plataforma/usuarios` | usuários e convites | completar módulo de memberships/convites; **MVP administrativo** |
| `/plataforma/feedbacks` | triagem de feedbacks recebidos | feedback opcional; **depois** |
| `/plataforma/planos` | planos e assinaturas | billing SaaS; **depois**, depende de provedor/precificação |
| `/plataforma/perfis` | configurações de perfis | mesmo recorte de perfis do portal; **depois** |
| `/plataforma/auditoria` | eventos de auditoria | interface segura sobre `audit_log`; **MVP administrativo mínimo** |
| `/plataforma/configuracoes` | configurações da plataforma | backoffice limitado; **depois** |

## 4. Regras do mock que devem sobreviver, com correções

- Manter: protocolo sequencial para ocorrências, transições distintas para zelador e síndico, reserva impedida quando existe pendente/aprovada, cancelamento por antecedência, versões de documento, alertas de contrato e conciliação que apenas sugere correspondência.
- Corrigir no servidor: o mock decide papel no browser, gera `URL.createObjectURL`, guarda tudo em memória e calcula valores em `number`; produção usa membership/RLS, Storage privado, auditoria e centavos inteiros.
- Não carregar sem validação: tela de inadimplência, pagamentos, acordos, balancetes, importação de PDF, aprovação colegiada e qualquer referência legal. Cada um requer PRD, fonte da regra e testes de idempotência/concorrência quando aplicável.
- Não criar tabelas para os painéis derivados (`riscos`, `saude-predial`, calendário, dashboard). Eles devem consultar dados fonte com critérios documentados e índices adequados.

## 5. Arquitetura de domínio proposta

`organization` será o cliente SaaS (administradora ou condomínio, a decidir). `workspace` deve representar um condomínio; blocos e unidades pertencem ao workspace. Para um morador, o vínculo de acesso é `memberships` + `unit_members`, nunca só o papel `member`.

Núcleo inicial de entidades, todas com `organization_id`, `workspace_id` quando aplicável, RLS, FK composta, auditoria e índices por filtro:

```text
organizations → workspaces (condomínios) → blocks → units
users ↔ memberships; users ↔ unit_members
workspaces → announcements → announcement_reads
workspaces → common_areas → reservations
workspaces → tickets → ticket_events; files vinculados por join table
workspaces → documents → document_versions; files vinculados por join table
```

Fases posteriores acrescentam `suppliers/contracts`, `maintenance_plans/tasks`, `work_orders`, `works/work_stages`, `expense_records/ledger_entries`, `charges/payments/agreements`, propostas e importações. `app.files` continua sendo a única fonte de metadados/binário; os módulos só guardam o vínculo e a finalidade do arquivo.

## 6. Sequência de desenvolvimento

### Fase 0 — fechar produto e tornar o kit identificável

1. Definir nome, slug e escopo do pacote; executar o inicializador do kit apenas se este repositório ainda for o scaffold a ser adotado.
2. Preencher `docs/11-dominio.md`, a partir das decisões abaixo, sem copiar hipóteses legais como fatos.
3. Criar ADR para a semântica de `organization`/`workspace`, especialmente se a administradora puder gerir vários condomínios.
4. Definir navegação e tokens visuais próprios em CSS, inspirados no mock, sem introduzir Tailwind ou dependências de UI do protótipo.

### Fase 1 — base de condomínio e acesso

1. PRD/spec de onboarding, condomínios, blocos, unidades, pessoas e `unit_members`.
2. Migration aditiva, policies com helper `app.my_unit_ids()` e testes A/B de tenant e de membro de unidade diferente.
3. Convites/memberships, roles iniciais mapeados: `owner` (dona SaaS), `admin` (administradora), `manager` (síndico), `staff` (zelador/equipe), `member` (morador). Confirmar a nomenclatura antes de fixá-la.
4. Web: shell por papel, seletor de condomínio, perfil e backoffice mínimo de condomínio/usuário/auditoria.

### Fase 2 — valor diário e baixo risco

1. Comunicados + confirmação de leitura; entregar e-mail via outbox, com preferências do destinatário.
2. Ocorrências, protocolo único por condomínio/ano, linha de eventos, anexos e transições autorizadas.
3. Áreas comuns e reservas: intervalo, conflito, prazo de cancelamento e expiração processados em transação curta/worker.
4. Central de documentos: categorias, confidencialidade, visibilidade por role, versão e vínculo seguro com `app.files`.
5. Dashboard simples que agrega os quatro módulos acima.

### Fase 3 — operação administrativa

1. Fornecedores/contratos e alertas de vencimento.
2. Manutenção preventiva, ordens de serviço e Minha Rotina.
3. Obras, propostas e aprovações. A regra de quorum/parecer precisa de PRD específico.
4. Calendário, riscos e saúde predial como projeções dos dados já implantados.
5. Importação CSV/XLSX com staging, validação, relatório de rejeições e idempotência; PDF só após avaliar extração e privacidade.

### Fase 4 — financeiro e integrações reguladas

1. Decidir modelo contábil, plano de contas, papel da administradora e retenção de documentos fiscais.
2. Despesas, anexos fiscais e conciliação manual/sugerida; nunca conciliar automaticamente por valor semelhante.
3. Cobranças, boleto/PIX e acordos somente com adapter de provedor, webhook assinado/deduplicado, reconciliação e testes de concorrência.
4. Inadimplência com visibilidade estrita: `member` só vê os próprios débitos; exportações e revelações auditadas.

### Fase 5 — escala da plataforma

1. Planos/assinaturas do SaaS, superadmin, métricas e suporte.
2. Notificações push/WhatsApp, apenas após opt-in, base legal, limites de envio e kill switch.
3. Relatórios/PDF e, se ainda fizer sentido, leitura de documentos por IA com avaliação de fornecedor, retenção e consentimento/base legal.

## 7. Padrão de entrega para cada módulo

1. PRD em `docs/prd/` com papéis, dados pessoais, regras, retenção, integrações e fora de escopo.
2. Spec em `docs/specs/` com arquivos reais, migration forward-only, policies RLS, endpoints, telas e testes negativos.
3. Implementação: schemas Zod em `packages/shared`; API modular com `withTenantTx`; React/TanStack Query no web; CSS por tokens.
4. Testes: validação, 403 por papel, 404/vazio para outro tenant, isolamento da RLS, regras de datas/dinheiro e idempotência onde existir escrita crítica.
5. Conferência manual no ambiente dev e em 320/375/414 px e desktop. Integrações saem pela outbox/worker, não na transação HTTP.

## 8. Decisões que bloqueiam as primeiras specs

1. Quem é o tenant pagante: administradora, condomínio autogerido ou ambos? Uma administradora pode gerir vários workspaces?
2. Quais dos papéis têm login no MVP e qual é a primeira jornada de síndico, morador e zelador?
3. Quais dados da unidade e da pessoa são obrigatórios? Haverá inquilino, dependente e histórico de ocupação?
4. Comunicado e documento serão visíveis a todos os moradores por padrão ou exigem público-alvo por unidade/bloco?
5. Regras de reserva: áreas, valores, caução, aprovação e janelas de cancelamento por condomínio.
6. Qual é o primeiro canal transacional: e-mail, WhatsApp ou ambos? Há fornecedor/conta já contratados?
7. Financeiro e cobrança fazem parte do lançamento inicial? Se sim, qual administradora/banco/gateway, modelo de rateio e regras aprovadas?
8. Há necessidade real de superadmin, planos e customização visual no primeiro cliente, ou o backoffice mínimo basta?

## 9. Critérios de sucesso do primeiro release

- Administrador cria o condomínio, estrutura unidades e convida pessoas sem acesso entre tenants.
- Síndico publica comunicado e abre/acompanha ocorrência; morador vê somente conteúdo permitido e suas próprias ocorrências/reservas.
- Reserva conflitante nunca é confirmada por concorrência; anexos permanecem privados e auditáveis.
- Cada fluxo possui PRD/spec aprovada, testes de autorização/tenant e validação visual mobile registrada.
