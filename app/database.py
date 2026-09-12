import os
import psycopg2
import redis
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv()


def get_connection():
    host = os.getenv("DB_HOST") or os.getenv("PGHOST", "localhost")
    port = int(os.getenv("DB_PORT") or os.getenv("PGPORT", "5432"))
    database = os.getenv("DB_NAME") or os.getenv("PGDATABASE", "city_traffic")
    user = os.getenv("DB_USER") or os.getenv("PGUSER", "postgres")
    password = os.getenv("DB_PASSWORD") or os.getenv("PGPASSWORD", "varsha")
    sslmode = os.getenv("DB_SSLMODE") or os.getenv("PGSSLMODE")

    connect_kwargs = {
        "host": host,
        "port": port,
        "database": database,
        "user": user,
        "password": password
    }
    if sslmode:
        connect_kwargs["sslmode"] = sslmode

    return psycopg2.connect(**connect_kwargs)


def get_redis_client(decode_responses=True, socket_timeout=None):
    host = os.getenv("REDIS_HOST", "localhost")
    port = int(os.getenv("REDIS_PORT", "6379"))
    username = os.getenv("REDIS_USERNAME", "default")
    password = os.getenv("REDIS_PASSWORD") or None
    ssl_str = (os.getenv("REDIS_SSL") or "false").lower()
    ssl = ssl_str in ["true", "1", "yes"]

    kwargs = {
        "host": host,
        "port": port,
        "decode_responses": decode_responses,
        "socket_timeout": socket_timeout
    }
    if username:
        kwargs["username"] = username
    if password:
        kwargs["password"] = password
    if ssl:
        kwargs["ssl"] = ssl

    return redis.Redis(**kwargs)


    