-- SEED DE DESENVOLVIMENTO: dados 100% ficticios. Roda so em `supabase db reset` local.
-- NUNCA aplicar em prod. Nao contem dado real (nomes, CPF, e-mails sao inventados).

insert into app.organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', '[DEV] Acme Org')
on conflict (id) do nothing;

insert into app.workspaces (id, organization_id, name, city, state)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', '[DEV] Workspace A', 'City A', 'ST'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', '[DEV] Workspace B', 'City B', 'ST')
on conflict (id) do nothing;

-- Para logar em dev: crie um usuario (Studio local > Authentication) e vincule-o, trocando <USER_ID>:
-- insert into app.memberships (user_id, organization_id, role)
-- values ('<USER_ID>', '00000000-0000-4000-8000-000000000001', 'owner')
-- on conflict do nothing;
