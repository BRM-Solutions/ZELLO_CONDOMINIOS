-- Teste de catalogo: deve retornar ZERO linhas. Qualquer linha e falha.
-- Rode apos aplicar as migrations: psql "$DB_URL" -f supabase/tests/catalog.sql  (ou via pgTAP: supabase test db)
-- 1) tabela de `app` sem RLS ou sem policy; 2) anon/authenticated com privilegio em tabela de `app`;
-- 3) funcao de `app` executavel por anon/authenticated alem do helper de Storage (app.can_access_object).
select 'tabela_sem_rls_ou_policy' as problema, c.relname::text as objeto
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'app' and c.relkind = 'r'
  and (not c.relrowsecurity
       or not exists (select 1 from pg_policies p where p.schemaname = 'app' and p.tablename = c.relname))
union all
select 'tabela_com_acesso_anon_ou_authenticated', c.relname::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'app' and c.relkind = 'r'
  and (has_table_privilege('anon', c.oid, 'select, insert, update, delete')
       or has_table_privilege('authenticated', c.oid, 'select, insert, update, delete'))
union all
select 'funcao_executavel_por_anon_ou_authenticated', p.oid::regprocedure::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.proname <> 'can_access_object'
  and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
