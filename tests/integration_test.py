"""
Phase 1 Integration Tests — 24 assertions across 8 test cases.
Run: python3 tests/integration_test.py
"""
import asyncio, json, threading, time, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'server'))

import uvicorn
import websockets
from websockets.connection import State

PORT   = 18766
BASE   = f"ws://127.0.0.1:{PORT}"
passed = 0
failed = 0

def record(label, ok, detail=""):
    global passed, failed
    if ok: passed += 1; print(f"  \033[32m[PASS]\033[0m {label}")
    else:  failed += 1; print(f"  \033[31m[FAIL]\033[0m {label}" + (f" — {detail}" if detail else ""))

async def recv(ws, timeout=3.0):
    return json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout))


async def test_room_creation():
    print("\nTest 1 — Room creation")
    async with websockets.connect(f"{BASE}/ws/host") as host:
        await host.send(json.dumps({"type": "CREATE_ROOM"}))
        msg = await recv(host)
        record("ROOM_CREATED received",  msg["type"] == "ROOM_CREATED")
        record("PIN is 4 digits",        len(msg.get("room_pin","")) == 4)
        record("PIN is numeric",         msg.get("room_pin","x").isdigit())


async def test_player_join():
    print("\nTest 2 — Player join & message ordering")
    async with websockets.connect(f"{BASE}/ws/host") as host:
        await host.send(json.dumps({"type":"CREATE_ROOM"}))
        pin = (await recv(host))["room_pin"]
        async with websockets.connect(f"{BASE}/ws/player") as player:
            await player.send(json.dumps({"type":"JOIN_ROOM","room_pin":pin,"player_name":"Alice"}))
            ack = await recv(player)
            record("Player gets JOIN_ACK first",       ack["type"] == "JOIN_ACK", f"got {ack['type']!r}")
            record("ACK has player_id",                bool(ack.get("player_id")))
            record("ACK has correct room_pin",         ack.get("room_pin") == pin)
            record("ACK has player_name",              ack.get("player_name") == "Alice")
            host_msg = await recv(host)
            record("Host gets PLAYER_JOINED",          host_msg["type"] == "PLAYER_JOINED")
            record("PLAYER_JOINED player_count == 1",  host_msg.get("player_count") == 1)
            try:
                extra = json.loads(await asyncio.wait_for(player.recv(), timeout=0.4))
                record("Player does NOT get own PLAYER_JOINED", extra["type"] != "PLAYER_JOINED")
            except asyncio.TimeoutError:
                record("Player does NOT get own PLAYER_JOINED", True)


async def test_game_start():
    print("\nTest 3 — Game start broadcast")
    async with websockets.connect(f"{BASE}/ws/host") as host:
        await host.send(json.dumps({"type":"CREATE_ROOM"}))
        pin = (await recv(host))["room_pin"]
        async with websockets.connect(f"{BASE}/ws/player") as player:
            await player.send(json.dumps({"type":"JOIN_ROOM","room_pin":pin,"player_name":"Bob"}))
            await recv(player); await recv(host)
            await host.send(json.dumps({"type":"START_GAME","room_pin":pin}))
            h = await recv(host); p = await recv(player)
            record("Host gets GAME_STARTED",   h["type"] == "GAME_STARTED")
            record("Player gets GAME_STARTED", p["type"] == "GAME_STARTED")


async def test_game_state():
    print("\nTest 4 — Host GAME_STATE broadcast")
    async with websockets.connect(f"{BASE}/ws/host") as host:
        await host.send(json.dumps({"type":"CREATE_ROOM"}))
        pin = (await recv(host))["room_pin"]
        async with websockets.connect(f"{BASE}/ws/player") as player:
            await player.send(json.dumps({"type":"JOIN_ROOM","room_pin":pin,"player_name":"Eve"}))
            await recv(player)
            await recv(host)
            await host.send(json.dumps({"type":"START_GAME","room_pin":pin}))
            await recv(host)
            await recv(player)
            game_state = await recv(host)
            record("Host gets GAME_STATE", game_state["type"] == "GAME_STATE")
            record("GAME_STATE has tick", isinstance(game_state.get("tick"), int))
            record("GAME_STATE has players list", isinstance(game_state.get("players"), list))


async def test_player_input():
    print("\nTest 4 — Player input handling")
    async with websockets.connect(f"{BASE}/ws/host") as host:
        await host.send(json.dumps({"type":"CREATE_ROOM"}))
        pin = (await recv(host))["room_pin"]
        async with websockets.connect(f"{BASE}/ws/player") as player:
            await player.send(json.dumps({"type":"JOIN_ROOM","room_pin":pin,"player_name":"Carol"}))
            ack = await recv(player); pid = ack["player_id"]; await recv(host)
            await host.send(json.dumps({"type":"START_GAME","room_pin":pin}))
            await recv(host); await recv(player)
            for action in ["MOVE_UP","MOVE_LEFT","MOVE_DOWN","MOVE_RIGHT"]:
                await player.send(json.dumps({"type":"PLAYER_INPUT","player_id":pid,"action":action}))
            await asyncio.sleep(0.1)
            record("All inputs accepted without error", player.state == State.OPEN)


async def test_heartbeat():
    print("\nTest 5 — PING / PONG")
    async with websockets.connect(f"{BASE}/ws/player") as ws:
        await ws.send(json.dumps({"type":"PING"}))
        record("Player PONG", (await recv(ws))["type"] == "PONG")
    async with websockets.connect(f"{BASE}/ws/host") as ws:
        await ws.send(json.dumps({"type":"PING"}))
        record("Host PONG",   (await recv(ws))["type"] == "PONG")


async def test_disconnect():
    print("\nTest 6 — Disconnect notification")
    async with websockets.connect(f"{BASE}/ws/host") as host:
        await host.send(json.dumps({"type":"CREATE_ROOM"}))
        pin = (await recv(host))["room_pin"]
        async with websockets.connect(f"{BASE}/ws/player") as player:
            await player.send(json.dumps({"type":"JOIN_ROOM","room_pin":pin,"player_name":"Dave"}))
            await recv(player); await recv(host)
        await asyncio.sleep(0.2)
        left = await recv(host)
        record("Host gets PLAYER_LEFT",       left["type"] == "PLAYER_LEFT")
        record("PLAYER_LEFT count is 0",      left.get("player_count") == 0)
        record("PLAYER_LEFT has player_id",   bool(left.get("player_id")))


async def test_bad_pin():
    print("\nTest 7 — Bad PIN error")
    async with websockets.connect(f"{BASE}/ws/player") as player:
        await player.send(json.dumps({"type":"JOIN_ROOM","room_pin":"0000","player_name":"Eve"}))
        msg = await recv(player)
        record("ERROR received",             msg["type"] == "ERROR")
        record("Code is ROOM_NOT_FOUND",     msg.get("code") == "ROOM_NOT_FOUND")
        record("Message is human-readable",  bool(msg.get("message")))


async def run_all():
    await test_room_creation()
    await test_player_join()
    await test_game_start()
    await test_player_input()
    await test_heartbeat()
    await test_disconnect()
    await test_bad_pin()


def start_server():
    uvicorn.run("main:app", host="127.0.0.1", port=PORT, log_level="error")

if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(__file__), '..', 'server'))
    threading.Thread(target=start_server, daemon=True).start()
    time.sleep(1.5)

    print("=" * 55)
    print("  Push to Prod — Phase 1 Integration Tests")
    print("=" * 55)
    try:
        asyncio.run(run_all())
    except Exception as e:
        import traceback; traceback.print_exc()
        failed += 1

    print()
    print("=" * 55)
    total = passed + failed
    if failed == 0: print(f"  \033[32m✓ All {total} tests passed\033[0m")
    else:           print(f"  \033[31m✗ {failed}/{total} tests failed\033[0m")
    print("=" * 55)
    sys.exit(0 if failed == 0 else 1)