"""Self-test for the Python lab (standard library only).

    python -m unittest lab/test_lab.py -v
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from capture import count_window  # noqa: E402
from client import run_trial  # noqa: E402
from relay import Relay  # noqa: E402
from server import ASSETS, start_in_thread  # noqa: E402


class Counts(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = start_in_thread()
        cls.port = cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()

    def run_counted(self, port: int, n: int, strategy: str):
        before = self.server.snapshot()
        t = run_trial("127.0.0.1", port, n, strategy)
        after = self.server.snapshot()
        return t, after[0] - before[0], after[1] - before[1]

    def test_close_opens_one_connection_per_object(self) -> None:
        t, conns, reqs = self.run_counted(self.port, 5, "close")
        self.assertEqual((t.connections, conns, t.requests, reqs), (5, 5, 5, 5))
        self.assertEqual(t.bytes, sum(a["bytes"] for a in ASSETS[:5]))

    def test_keepalive_reuses_one_connection(self) -> None:
        t, conns, reqs = self.run_counted(self.port, 8, "keepalive")
        self.assertEqual((t.connections, conns, t.requests, reqs), (1, 1, 8, 8))

    def test_relay_adds_the_expected_round_trips(self) -> None:
        rtt = 40
        relay = Relay(("127.0.0.1", self.port), rtt).start()
        try:
            close, conns, _ = self.run_counted(relay.port, 3, "close")
            keep, _, _ = self.run_counted(relay.port, 3, "keepalive")
        finally:
            relay.stop()
        self.assertEqual(conns, 3)
        # close: 3 × 2 RTT; keep-alive: RTT + 3 × RTT. The lower bound proves the delay is
        # really added; the upper bound is loose because a busy machine adds scheduler lag.
        self.assertGreaterEqual(close.load_ms, 6 * rtt * 0.95)
        self.assertLess(close.load_ms, 6 * rtt + 150)
        self.assertGreaterEqual(keep.load_ms, 4 * rtt * 0.95)
        self.assertLess(keep.load_ms, 4 * rtt + 150)


class WireCounting(unittest.TestCase):
    def test_counts_streams_and_complete_handshakes(self) -> None:
        port = 9000
        pk = lambda t, s, src, dst, syn, ack: {"t": t, "stream": s, "src": src, "dst": dst, "syn": syn, "ack": ack, "fin": False, "rst": False}  # noqa: E731
        packets = [
            # stream 0: full handshake inside the window
            pk(1.00, 0, 50000, port, True, False), pk(1.01, 0, port, 50000, True, True), pk(1.02, 0, 50000, port, False, True),
            # stream 1: SYN answered but never ACKed → connection, not a handshake
            pk(1.10, 1, 50001, port, True, False), pk(1.11, 1, port, 50001, True, True),
            # stream 2: outside the window
            pk(5.00, 2, 50002, port, True, False), pk(5.01, 2, port, 50002, True, True), pk(5.02, 2, 50002, port, False, True),
        ]
        w = count_window(packets, port, 0.9, 1.5)
        self.assertEqual((w.connections, w.handshakes, w.packets), (2, 1, 5))


if __name__ == "__main__":
    unittest.main()
