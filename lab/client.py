"""Raw-socket HTTP/1.1 client that fetches N objects with one strategy.

No HTTP library is used, so nothing opens or pools connections behind our
back: ``close`` opens one TCP connection per object and sends
``Connection: close``; ``keepalive`` opens one connection and sends every
request on it. Requests are sequential in both strategies.
"""
from __future__ import annotations

import socket
import time
from dataclasses import dataclass, field

from server import ASSETS


@dataclass
class Trial:
    strategy: str
    objects: int
    load_ms: float = 0.0
    connections: int = 0
    requests: int = 0
    bytes: int = 0
    started_epoch: float = 0.0
    ended_epoch: float = 0.0
    per_object_ms: list[float] = field(default_factory=list)


def _read_response(sock: socket.socket, buf: bytearray) -> int:
    """Reads one response (headers + Content-Length body). Returns body length."""
    while b"\r\n\r\n" not in buf:
        chunk = sock.recv(65536)
        if not chunk:
            raise ConnectionError("connection closed before headers")
        buf += chunk
    head, _, rest = bytes(buf).partition(b"\r\n\r\n")
    status = head.split(b"\r\n", 1)[0]
    if b" 200 " not in status:
        raise ConnectionError(f"unexpected status: {status!r}")
    length = 0
    for line in head.split(b"\r\n")[1:]:
        k, _, v = line.partition(b":")
        if k.strip().lower() == b"content-length":
            length = int(v.strip())
    body = bytearray(rest)
    while len(body) < length:
        chunk = sock.recv(65536)
        if not chunk:
            raise ConnectionError("connection closed mid-body")
        body += chunk
    buf[:] = body[length:]  # anything past this response belongs to the next one
    return length


def _connect(host: str, port: int) -> socket.socket:
    s = socket.create_connection((host, port))
    s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    return s


def run_trial(host: str, port: int, objects: int, strategy: str) -> Trial:
    if strategy not in ("close", "keepalive"):
        raise ValueError(strategy)
    paths = [a["path"] for a in ASSETS[:objects]]
    header = "close" if strategy == "close" else "keep-alive"
    t = Trial(strategy=strategy, objects=len(paths))
    t.started_epoch = time.time()
    t0 = time.perf_counter()
    sock: socket.socket | None = None
    buf = bytearray()
    try:
        for path in paths:
            o0 = time.perf_counter()
            if sock is None:
                sock = _connect(host, port)
                t.connections += 1
                buf.clear()
            sock.sendall(f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: {header}\r\n\r\n".encode("ascii"))
            t.bytes += _read_response(sock, buf)
            t.requests += 1
            t.per_object_ms.append((time.perf_counter() - o0) * 1000)
            if strategy == "close":
                sock.close()
                sock = None
        t.load_ms = (time.perf_counter() - t0) * 1000  # stops at the last body byte, like the model
    finally:
        if sock is not None:
            sock.close()
    t.ended_epoch = time.time()
    return t
