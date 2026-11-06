# Template — prompt de agente construtor

> Copie, preencha os `<...>` e envie ao agente `builder`. Não cole a spec: aponte o caminho.
> Não passe `model` na chamada; o frontmatter do agente define Sonnet 5.5.

```text
Tarefa: <objetivo em 1–2 linhas>.

1. Leia INTEIRO antes de começar: docs/specs/spec-<nome>.md.
   Leia também, só se a spec pedir: <docs/02-banco-de-dados.md, docs/05-backend-api.md, ...>.

2. Contexto do repo: monorepo pnpm (Node 22, TS strict, ESM). apps/api = Express 4 + Zod + pg
   direto (sem ORM), toda query de negócio dentro de withTenantTx. apps/web = Vite + React 18 +
   TanStack Query + react-hook-form, CSS à mão com variáveis (sem Tailwind). packages/shared =
   schemas Zod usados por api e web. Banco = Supabase (Postgres) com RLS em todas as tabelas.

3. Você PODE editar: <lista de caminhos/globs>.
   Você NÃO PODE editar: <caminhos de outra área/agente>, package.json/lockfile <salvo se dito>,
   migrations já aplicadas, .env*, .claude/**.

4. Regras inegociáveis:
   - Ambiente DEV apenas. Nunca prod. Nunca rode supabase db push/reset.
   - Testes e verificação manual usam um tenant de teste criado por você e APAGADO ao final.
   - Nunca commitar, nunca dar push.
   - Nunca ler, imprimir ou inventar segredos; variável nova vai para .env.example só com nome.
   - Tabela nova: RLS ligada + policies + índice em organization_id (template em
     docs/templates/migration-template.sql). Migration nova com timestamp; nunca editar antiga.
   - Comentários só onde a lógica não for óbvia (uma linha).
   - Frontend: conferir layout em 320–414px (minmax(0,1fr), alvo >= 44px, fonte >= 12px).
   - Design system (REGRA DURA): ler docs/13-design-system.md e a rota equivalente em
     docs/referencias/condominio-360/src/routes/. Só tokens/componentes/shells de lá; nenhuma
     cor, variante ou layout inventado; sem Tailwind/shadcn/cva/código do mock. Divergência fora
     de docs/13 §8 = PARE e relate como DECIDIR-DS.
   - Se esbarrar numa decisão de produto ou precisar de credencial, PARE e relate; não suponha.

5. Verificação (rode em background, saída em arquivo, leia só o resumo):
   pnpm type-check > /tmp/tc.log 2>&1; tail -5 /tmp/tc.log
   pnpm --filter @app/api exec vitest run <arquivo.test.ts> > /tmp/t.log 2>&1
   grep -E "Test Files|Tests|FAIL" /tmp/t.log
   <passo de verificação manual da spec, se houver>

6. Critério de pronto: <copiar os itens do "Critério de pronto" da spec>.

7. Relatório final (curto, com valores reais, sem colar código):
   - Arquivos criados/alterados (lista).
   - type-check: resultado exato. lint: resultado exato.
   - Testes: "Test Files X passed, Tests Y passed" (ou falhas com nome do teste).
   - Verificação manual: valores observados (status HTTP, contagens, textos), não "funcionou".
   - Desvios da spec e por quê; pendências; DECIDIR encontrados.
   - Confirmação: nada commitado; dados de teste apagados (como conferiu).
```
