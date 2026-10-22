"""Userspace relay that emulates network round-trip time on loopback.

Loopback RTT is a few microseconds, which hides the handshake cost the
experiment is about. Windows has no netem, so this relay sits between the
client and the server and adds delay at the application layer:

* every chunk is forwarded RTT/2 after it arrives, in each direction;
* the first chunk of a new connection is held one extra RTT. The kernel
  completes the real loopback handshake instantly, so this stands in for the
  SYN → SYN-ACK round trip a real network would cost before the GET leaves.

Result: a new connection costs 2 RTT per object and a reused one 1 RTT, the
same timing rules as the browser model. This is an *emulation*; results that
use it are labelled "emulated RTT" everywhere.
"""
from __future__ import annotations

import asyncio
import ctypes
import sys
import threading


def _fine_timers() -> None:
    """Ask Windows for 1 ms timer resolution (default is ~15.6 ms)."""
    if sys.platform == "win32":
        try:
            ctypes.windll.winmm.timeBeginPeriod(1)
        except OSError:
            pass


async def _pump(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, delay: float, first_extra: float) -> None:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[tuple[float, bytes | None]] = asyncio.Queue()

    async def deliver() -> None:
        while True:
            due, data = await queue.get()
            wait = due - loop.time()
            if wait > 0:
                await asyncio.sleep(wait)
            if data is None:
                try:
                    if writer.can_write_eof():
                        writer.write_eof()
                except OSError:
                    pass
                return
            writer.write(data)
            await writer.drain()

    task = asyncio.create_task(deliver())
    last_due = 0.0
    extra = first_extra
    try:
        while True:
            data = await reader.read(65536)
            due = max(loop.time() + delay + (extra if data else 0.0), last_due)
            extra = 0.0
            last_due = due
            queue.put_nowait((due, data or None))
            if not data:
                break
    except (ConnectionError, OSError):
        queue.put_nowait((last_due, None))
    await task


class Relay:
    """Listens on ``listen_port`` and forwards to ``target`` with emulated RTT."""

    def __init__(self, target: tuple[str, int], rtt_ms: float, host: str = "127.0.0.1", port: int = 0):
        self.target = target
        self.rtt = rtt_ms / 1000
        self.host = host
        self.port = port
        self.connections = 0
        self._ready = threading.Event()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._server: asyncio.base_events.Server | None = None

    async def _handle(self, cr: asyncio.StreamReader, cw: asyncio.StreamWriter) -> None:
        self.connections += 1
        try:
            sr, sw = await asyncio.open_connection(*self.target)
        except OSError:
            cw.close()
            return
        half = self.rtt / 2
        try:
            await asyncio.gather(_pump(cr, sw, half, self.rtt), _pump(sr, cw, half, 0.0))
        except (ConnectionError, OSError):
            pass  # a peer reset mid-teardown; the data already went through
        finally:
            for w in (sw, cw):
                w.close()

    async def _main(self) -> None:
        self._server = await asyncio.start_server(self._handle, self.host, self.port, backlog=128)
        self.port = self._server.sockets[0].getsockname()[1]
        self._ready.set()
        async with self._server:
            await self._server.serve_forever()

    def start(self) -> "Relay":
        _fine_timers()

        def run() -> None:
            self._loop = asyncio.new_event_loop()
            try:
                self._loop.run_until_complete(self._main())
            except asyncio.CancelledError:
                pass

        threading.Thread(target=run, name="rtt-relay", daemon=True).start()
        if not self._ready.wait(5):
            raise RuntimeError("relay did not start")
        return self

    def stop(self) -> None:
        if self._loop and self._server:
            self._loop.call_soon_threadsafe(self._server.close)
