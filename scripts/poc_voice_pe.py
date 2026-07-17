"""Proof of concept: play a quiet test sound on a Home Assistant Voice PE speaker.

No Home Assistant involved — talks the ESPHome native API directly.

Safety first: the script REFUSES to play anything until it has set the
device volume to --volume (default 10%) and read the same value back.

Usage:
    uv run --with aioesphomeapi python scripts/poc_voice_pe.py --host <ip> \
        [--audio path.mp3] [--volume 0.10] [--noise-psk <key>] [--dry-run]

Steps:
    1. connect + device_info (works also as a pure reachability probe)
    2. list entities, find the media_player
    3. set volume low, read it back, abort unless confirmed
    4. serve the audio file over LAN HTTP and ask the device to play it
"""

import argparse
import asyncio
import contextlib
import functools
import http.server
import socket
import threading
from pathlib import Path

from aioesphomeapi import APIClient, MediaPlayerEntityState, MediaPlayerInfo

DEFAULT_ESPHOME_PORT = 6053
STATE_SETTLE_SECONDS = 2.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True, help="Speaker IP or mDNS hostname")
    parser.add_argument("--port", type=int, default=DEFAULT_ESPHOME_PORT)
    parser.add_argument("--noise-psk", default=None, help="API encryption key, if required")
    parser.add_argument("--audio", type=Path, default=None, help="MP3/WAV to play")
    parser.add_argument("--volume", type=float, default=0.10, help="Target volume 0..1")
    parser.add_argument("--dry-run", action="store_true", help="Connect and inspect only, never play")
    return parser.parse_args()


def lan_ip_towards(host: str) -> str:
    """The local address the speaker can reach us back on."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
        probe.connect((host, DEFAULT_ESPHOME_PORT))
        return probe.getsockname()[0]


@contextlib.contextmanager
def serve_file_over_http(file_path: Path, bind_ip: str):
    """Serve file_path's directory on an ephemeral port; yield the file URL."""
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=str(file_path.parent)
    )
    server = http.server.ThreadingHTTPServer((bind_ip, 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        yield f"http://{bind_ip}:{port}/{file_path.name}"
    finally:
        server.shutdown()


async def main() -> None:
    args = parse_args()
    client = APIClient(args.host, args.port, password="", noise_psk=args.noise_psk)

    print(f"[1/4] connecting to {args.host}:{args.port} …")
    await client.connect(login=True)
    info = await client.device_info()
    print(f"      connected: {info.name} (esphome {info.esphome_version}, model {info.model})")

    print("[2/4] listing entities …")
    entities, _services = await client.list_entities_services()
    media_players = [e for e in entities if isinstance(e, MediaPlayerInfo)]
    for entity in entities:
        print(f"      {type(entity).__name__:24} {entity.object_id}")
    if not media_players:
        raise SystemExit("No media_player entity found — cannot play audio this way.")
    player = media_players[0]
    print(f"      using media_player: {player.object_id} (key={player.key})")

    volumes: dict[int, float] = {}
    got_state = asyncio.Event()

    def on_state(state) -> None:
        if isinstance(state, MediaPlayerEntityState):
            volumes[state.key] = state.volume
            got_state.set()

    client.subscribe_states(on_state)

    print(f"[3/4] setting volume to {args.volume:.0%} and verifying …")
    client.media_player_command(player.key, volume=args.volume)
    await asyncio.sleep(STATE_SETTLE_SECONDS)
    reported = volumes.get(player.key)
    if reported is None or abs(reported - args.volume) > 0.02:
        raise SystemExit(
            f"SAFETY ABORT: device reports volume={reported!r}, "
            f"expected ~{args.volume}. Not playing anything."
        )
    print(f"      confirmed: device volume = {reported:.0%}")

    if args.dry_run or args.audio is None:
        print("[4/4] dry run — skipping playback. Done.")
        await client.disconnect()
        return

    bind_ip = lan_ip_towards(args.host)
    with serve_file_over_http(args.audio.resolve(), bind_ip) as url:
        print(f"[4/4] playing {url} (announcement mode) …")
        client.media_player_command(player.key, media_url=url, announcement=True)
        await asyncio.sleep(15)  # keep the HTTP server up while it fetches + plays
    await client.disconnect()
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
