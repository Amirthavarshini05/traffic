import os

import psycopg2
import redis
from dotenv import load_dotenv


# =========================================================
# Load .env file from project root
# =========================================================

load_dotenv()


# =========================================================
# PostgreSQL / Supabase connection
# =========================================================

def get_connection():

    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        sslmode=os.getenv("DB_SSLMODE", "require"),
    )


# =========================================================
# Redis Cloud connection
# =========================================================

def get_redis_client(
    decode_responses=True,
    socket_timeout=None
):

    host = os.getenv("REDIS_HOST")
    port = int(
        os.getenv("REDIS_PORT", "6379")
    )

    username = os.getenv(
        "REDIS_USERNAME",
        "default"
    )

    password = os.getenv(
        "REDIS_PASSWORD"
    )

    ssl = (
        os.getenv(
            "REDIS_SSL",
            "false"
        ).lower()
        in ["true", "1", "yes"]
    )

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