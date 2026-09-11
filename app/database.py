import os
import psycopg2


def get_connection():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        database=os.getenv("PGDATABASE", "city_traffic"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", "varsha")
    )

    