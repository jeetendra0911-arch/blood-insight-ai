import asyncio
from fastapi import WebSocket

main_loop = None

class ConnectionManager:
    def __init__(self):
        # Maps user_id (int) -> list of WebSockets
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        global main_loop
        await websocket.accept()
        # Capture the active ASGI main event loop running on the main thread
        try:
            main_loop = asyncio.get_running_loop()
        except RuntimeError:
            pass
            
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            targets = list(self.active_connections[user_id])
            for connection in targets:
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect(user_id, connection)

manager = ConnectionManager()

def broadcast_progress(user_id: int, data: dict):
    """Safely queues a broadcast message on the running event loop from any thread."""
    global main_loop
    try:
        if main_loop is None:
            try:
                main_loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
                
        if main_loop and main_loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast_to_user(user_id, data), main_loop)
        else:
            # Fallback if no running loop in the process yet
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(manager.broadcast_to_user(user_id, data), loop)
            else:
                loop.run_until_complete(manager.broadcast_to_user(user_id, data))
    except Exception as e:
        print(f"Error broadcasting progress: {e}")

