import psycopg2

conn = psycopg2.connect(
    host="localhost",
    database="city_traffic",
    user="postgres",
    password="varsha",
    port=5432
)

conn.set_isolation_level(
    psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT
)

cursor = conn.cursor()

cursor.execute("LISTEN trajectory_created;")

cursor.execute("SELECT pg_listening_channels();")

print("Currently listening to:")
print(cursor.fetchall())

print("Waiting for trajectory_created...")

while True:
    conn.poll()

    while conn.notifies:
        notify = conn.notifies.pop(0)

        print("Notification received!")
        print("Channel:", notify.channel)
        print("Payload:", notify.payload)