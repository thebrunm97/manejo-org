import psycopg
import sys

conn = psycopg.connect('postgresql://postgres:i64a93pzbHZhF6Oj@db.hejewayflbuemnffrhae.supabase.co:5432/postgres?sslmode=require')
conn.autocommit = True
cur = conn.cursor()

print("Applying RLS UPDATE policies for logs_treinamento...")

try:
    # Users can update their own logs
    cur.execute("DROP POLICY IF EXISTS \"Users update own training\" ON \"public\".\"logs_treinamento\"")
    cur.execute("CREATE POLICY \"Users update own training\" ON \"public\".\"logs_treinamento\" FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)")
    print("Policy 'Users update own training' created.")

    # Admins can update all logs
    cur.execute("DROP POLICY IF EXISTS \"Admins update all training\" ON \"public\".\"logs_treinamento\"")
    cur.execute("CREATE POLICY \"Admins update all training\" ON \"public\".\"logs_treinamento\" FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())")
    print("Policy 'Admins update all training' created.")

except Exception as e:
    print("Error:", e)
    sys.exit(1)
finally:
    conn.close()

print("Done.")
