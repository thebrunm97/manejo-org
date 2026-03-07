import os
try:
    import psycopg
except ImportError:
    import psycopg2 as psycopg

conn = psycopg.connect('postgresql://postgres:i64a93pzbHZhF6Oj@db.hejewayflbuemnffrhae.supabase.co:5432/postgres?sslmode=require')
cur = conn.cursor()

import psycopg
conn = psycopg.connect('postgresql://postgres:i64a93pzbHZhF6Oj@db.hejewayflbuemnffrhae.supabase.co:5432/postgres?sslmode=require')
conn.autocommit = True
cur = conn.cursor()

try:
    cur.execute("DROP POLICY IF EXISTS \"Admins manage all notebook\" ON \"public\".\"caderno_campo\"")
    cur.execute("CREATE POLICY \"Admins manage all notebook\" ON \"public\".\"caderno_campo\" FOR ALL TO authenticated USING ( public.is_admin() ) WITH CHECK ( public.is_admin() )")
    print("Policy created successfully!")
except Exception as e:
    print("Error:", e)

conn.close()

conn.close()
