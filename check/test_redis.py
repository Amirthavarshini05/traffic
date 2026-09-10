import redis

r = redis.Redis(
    host="localhost",
    port=6379,
    decode_responses=True
)

try:
    print("Redis ping:", r.ping())
    print("Redis connection successful!")
except Exception as e:
    print("Redis connection failed:", e)