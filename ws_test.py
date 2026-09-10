import asyncio
import websockets

async def test():
    async with websockets.connect("ws://127.0.0.1:8001/ws/traffic") as ws:
        print("WebSocket connection successful!")

asyncio.run(test())
