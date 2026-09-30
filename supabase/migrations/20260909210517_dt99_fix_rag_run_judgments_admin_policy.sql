-- DT-99: a policy "Admins can manage rag_run_judgments" usava auth.jwt()->>'role' = 'admin',
-- mas 'role' no JWT é o role do Postgres (authenticated/anon/service_role), nunca 'admin'.
-- A condição era sempre falsa, então a policy nunca liberava acesso a admins de verdade.
-- Corrige para checar profiles.role, igual às demais policies de admin do projeto.

drop policy if exists "Admins can manage rag_run_judgments" on public.rag_run_judgments;

create policy "Admins can manage rag_run_judgments"
on public.rag_run_judgments
for all
to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
