import psycopg
conn = psycopg.connect('postgresql://postgres:i64a93pzbHZhF6Oj@db.hejewayflbuemnffrhae.supabase.co:5432/postgres?sslmode=require')
cur = conn.cursor()

try:
    print("--- RLS Policies for logs_treinamento ---")
    cur.execute("""
        SELECT pol.polname, pol.polcmd
        FROM pg_policy pol
        JOIN pg_class tbl ON pol.polrelid = tbl.oid
        WHERE tbl.relname = 'logs_treinamento'
    """)
    for row in cur.fetchall():
        print(row)

    print("--- Columns for logs_treinamento ---")
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'logs_treinamento'")
    for row in cur.fetchall():
        print(row)

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
