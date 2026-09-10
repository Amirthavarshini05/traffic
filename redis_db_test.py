import psycopg2


conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="city_traffic",
    user="postgres",
    password="varsha"
)

print("PostgreSQL connection successful!")

conn.close()