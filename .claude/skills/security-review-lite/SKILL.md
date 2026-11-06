---
name: security-review-lite
description: Checklist rápido de segurança antes de commit/PR — segredos no diff, isolamento de tenant (RLS, withTenantTx), auth/papéis, validação Zod, migrations perigosas, LGPD em logs e exposição de dados pessoais. Use quando pedirem "revisão de segurança", "pode abrir o PR?", "está seguro?", antes de qualquer PR que toque banco, auth, upload, webhook ou dado pessoal. Para revisão completa use o agente reviewer.
---

# Revisão de segurança rápida

Leitura apenas. Trabalhe sobre o diff, não sobre o repo inteiro.

## 1. Coletar
- `git diff --stat` e `git diff` (ou `git diff main...HEAD`).
- Se o diff for grande (> ~400 linhas), delegue ao agente `reviewer` e pare aqui.

## 2. Varreduras mecânicas (grep no diff)
- Segredos: `git diff | grep -nE "(sb_secret_|service_role|eyJ[A-Za-z0-9_-]{20,}|BEGIN [A-Z ]*PRIVATE KEY|password\s*[:=]|postgres(ql)?://[^ ]*:[^ ]*@)"`.
- Acesso a banco fora da transação: `git diff | grep -nE "pool\.query|new Pool\("` fora de `db.ts`.
- SQL concatenado: linhas com `` `select ... ${ `` ou `+ "` dentro de query.
- `VITE_` novo: só valor público.
- Secret do Storage fora do worker: `git diff | grep -n "SUPABASE_SECRET_KEY"` só pode aparecer em `worker.ts`, `jobs/` ou config do worker.
- Log de dado pessoal: `logger.*(cpf|phone|telefone|email|token)`.

## 3. Perguntas obrigatórias
1. Tabela nova tem RLS ligada, policy por operação `to app_api`, `with check` no UPDATE, índice em `organization_id`?
2. Toda rota nova passa por `authenticate` + `loadMembership` + checagem de papel?
3. Algum id vindo do cliente é usado sem garantir que é do tenant (policy ou `where organization_id`)?
4. Entrada validada com Zod (body, params, query, webhook)?
5. Migration edita uma antiga, faz `drop`/rename no mesmo deploy do código, ou muda dado existente?
6. Um `member` consegue ver dado pessoal de outro usuário (débito, telefone, CPF)?
7. Upload: bucket privado, MIME/tamanho/quota limitados, URL assinada ≤ 300 s, secret key só no worker, sem policy de UPDATE em `storage.objects`, delete respeita `legal_hold` (`docs/12-storage-e-governanca.md`)?
8. Webhook: assinatura verificada e idempotente?
9. Teste de outro tenant existe e passa?

## 4. Resultado
- Lista curta: `[BLOQUEIA|RISCO|OK] item — arquivo:linha — correção em 1 linha`.
- Qualquer `BLOQUEIA` impede o commit; avise a pessoa.
- Detalhes das regras: `docs/03-seguranca.md`, checklist completo: `docs/templates/pr-checklist.md`.
