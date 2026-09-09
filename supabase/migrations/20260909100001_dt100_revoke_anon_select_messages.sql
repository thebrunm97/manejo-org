-- DT-100: public.messages tinha GRANT SELECT para anon nunca revogado
-- (20260610120000_evolve_messages_table.sql). As policies de RLS já bloqueiam
-- leitura por anon na prática, mas o grant é uma camada de exposição latente
-- (falha em qualquer RLS futura mal configurada expõe a tabela a anon direto).

revoke select on public.messages from anon;
