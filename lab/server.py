"""HTTP/1.1 test server that serves the shared asset list.

Every path in shared/assets.json is served with exactly that many bytes. The
server honours both strategies: a request with ``Connection: close`` gets one
response and the server closes; otherwise the connection stays open (HTTP/1.1
is persistent by default). It counts accepted TCP connections and requests so
the experiment can cross-check the client's own counts.

Run standalone:  python lab/server.py --port 8080
"""
from __future__ import annotations

import argparse
import json
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ASSETS_FILE = Path(__file__).resolve().parent.parent / "shared" / "assets.json"
ASSETS: list[dict] = json.loads(ASSETS_FILE.read_text(encoding="utf-8"))["assets"]
_BODIES = {a["path"]: (b"x" * a["bytes"]) for a in ASSETS}
_TYPES = {
    "html": "text/html", "css": "text/css", "js": "text/javascript", "svg": "image/svg+xml", "jpg": "image/jpeg",
    "woff2": "font/woff2", "png": "image/png", "json": "application/json", "webp": "image/webp",
}


class AssetHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server: "AssetServer"

    def setup(self) -> None:
        super().setup()
        self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

    def do_GET(self) -> None:  # noqa: N802 (http.server naming)
        body = _BODIES.get(self.path)
        if body is None:
            self.send_error(404)
            return
        self.server.count_request()
        wants_close = self.headers.get("Connection", "").lower() == "close"
        head = (
            f"HTTP/1.1 200 OK\r\n"
            f"Content-Type: {_TYPES.get(self.path.rsplit('.', 1)[-1], 'application/octet-stream')}\r\n"
            f"Content-Length: {len(body)}\r\n"
            f"Connection: {'close' if wants_close else 'keep-alive'}\r\n\r\n"
        ).encode("ascii")
        # One write for header + body, so the response leaves as one burst.
        self.wfile.write(head + body)
        self.close_connection = wants_close

    def log_message(self, format: str, *args) -> None:  # silence per-request logging
        pass


class AssetServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 128

    def __init__(self, address: tuple[str, int]):
        super().__init__(address, AssetHandler)
        self._lock = threading.Lock()
        self.connections = 0
        self.requests = 0

    def process_request(self, request, client_address):
        with self._lock:
            self.connections += 1
        super().process_request(request, client_address)

    def count_request(self) -> None:
        with self._lock:
            self.requests += 1

    def snapshot(self) -> tuple[int, int]:
        with self._lock:
            return self.connections, self.requests


def start_in_thread(host: str = "127.0.0.1", port: int = 0) -> AssetServer:
    srv = AssetServer((host, port))
    threading.Thread(target=srv.serve_forever, name="asset-server", daemon=True).start()
    return srv


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8080)
    a = ap.parse_args()
    srv = AssetServer((a.host, a.port))
    print(f"Serving {len(ASSETS)} assets on http://{a.host}:{a.port}/  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        c, r = srv.snapshot()
        print(f"\n{c} TCP connections accepted, {r} requests served")


if __name__ == "__main__":
    main()
