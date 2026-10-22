"""Real measurement run: keep-alive vs a new connection per object.

Starts the asset server (and, for RTT > 0, the RTT relay) in-process, fetches
N objects with each strategy several times, and writes a JSON file the website
you can use in the report. When Wireshark is installed it also
captures the loopback traffic and counts SYNs and handshakes from the packets.

Examples:
  python lab/run_experiment.py                        # default sweep, capture if available
  python lab/run_experiment.py --objects 10 --rtt 50 --reps 7
  python lab/run_experiment.py --no-capture
"""
from __future__ import annotations

import argparse
import json
import platform
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from capture import Capture, count_window, tool_version  # noqa: E402
from client import run_trial  # noqa: E402
from relay import Relay  # noqa: E402
from server import ASSETS, start_in_thread  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "out"
SCHEMA = "reuse-reconnect/measurement@1"


def quantile(xs: list[float], q: float) -> float:
    s = sorted(xs)
    if len(s) == 1:
        return s[0]
    pos = (len(s) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--objects", type=int, nargs="+", default=[1, 5, 10, 20, 40])
    ap.add_argument("--rtt", type=float, nargs="+", default=[0, 50], help="ms; 0 = plain loopback, >0 = emulated via relay")
    ap.add_argument("--reps", type=int, default=5)
    ap.add_argument("--no-capture", action="store_true")
    a = ap.parse_args()

    if max(a.objects) > len(ASSETS) or min(a.objects) < 1:
        ap.error(f"--objects must be between 1 and {len(ASSETS)}")

    OUT.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    pcap = OUT / f"capture-{stamp}.pcapng"

    server = start_in_thread()
    sport = server.server_address[1]
    relays = {rtt: Relay(("127.0.0.1", sport), rtt).start() for rtt in a.rtt if rtt > 0}
    port_for = {rtt: (relays[rtt].port if rtt > 0 else sport) for rtt in a.rtt}

    cap = None
    capture_info: dict = {"enabled": False}
    if not a.no_capture:
        try:
            cap = Capture(pcap, sorted(set(port_for.values()) | {sport}))
            capture_info = {"enabled": True, "tool": tool_version(cap.dumpcap), "interface": cap.iface, "file": f"lab/out/{pcap.name}"}
        except RuntimeError as e:
            capture_info = {"enabled": False, "reason": str(e)}
            print(f"[capture] disabled: {e}")

    trials: list[dict] = []
    plan = [(n, rtt) for rtt in a.rtt for n in a.objects]
    print(f"server :{sport}  relays {', '.join(f'{r} ms→:{p}' for r, p in port_for.items() if r > 0) or 'none'}  reps {a.reps}")

    def run_all() -> None:
        for n, rtt in plan:
            run_trial("127.0.0.1", port_for[rtt], 1, "keepalive")  # warm-up, not recorded
            time.sleep(0.2)
            for rep in range(a.reps):
                # Alternate which strategy goes first so drift affects both equally.
                order = ("close", "keepalive") if rep % 2 == 0 else ("keepalive", "close")
                for strategy in order:
                    before = server.snapshot()
                    t = run_trial("127.0.0.1", port_for[rtt], n, strategy)
                    after = server.snapshot()
                    trials.append({
                        "objects": n, "rttMs": rtt, "strategy": strategy, "rep": rep,
                        "loadMs": t.load_ms, "clientConnections": t.connections, "requests": t.requests,
                        "serverConnections": after[0] - before[0], "serverRequests": after[1] - before[1],
                        "start": t.started_epoch, "end": t.ended_epoch,
                    })
                    time.sleep(0.25)  # keeps trials apart in the capture timeline
            done = [x for x in trials if x["objects"] == n and x["rttMs"] == rtt]
            med = {s: statistics.median(x["loadMs"] for x in done if x["strategy"] == s) for s in ("close", "keepalive")}
            print(f"  N={n:>2} RTT={rtt:>5g} ms   close {med['close']:9.2f} ms   keep-alive {med['keepalive']:9.2f} ms")

    if cap:
        with cap:
            run_all()
        packets = cap.packets()
        for t in trials:
            w = count_window(packets, port_for[t["rttMs"]], t["start"], t["end"])
            t.update(captureConnections=w.connections, captureHandshakes=w.handshakes, captureSegments=w.packets)
    else:
        run_all()

    for r in relays.values():
        r.stop()
    server.shutdown()

    runs = []
    for n, rtt in plan:
        for strategy in ("close", "keepalive"):
            xs = [t for t in trials if t["objects"] == n and t["rttMs"] == rtt and t["strategy"] == strategy]
            loads = [t["loadMs"] for t in xs]
            runs.append({
                "objects": n,
                "rttMs": rtt,
                "rttMode": "emulated" if rtt > 0 else "loopback",
                "strategy": strategy,
                "repetitions": len(xs),
                "loadMs": {
                    "median": statistics.median(loads), "p25": quantile(loads, 0.25), "p75": quantile(loads, 0.75),
                    "min": min(loads), "max": max(loads),
                },
                "samples": [{k: v for k, v in t.items() if k not in ("objects", "rttMs", "strategy", "start", "end")} for t in xs],
            })

    doc = {
        "schema": SCHEMA,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tool": "lab/run_experiment.py",
        "host": {"os": f"{platform.system()} {platform.release()}", "python": platform.python_version(), "machine": platform.machine()},
        "method": {
            "requests": "sequential, one object at a time",
            "client": "raw sockets, TCP_NODELAY, no HTTP library",
            "server": "Python http.server, HTTP/1.1, threaded",
            "loopbackRtt": "real loopback (no added delay)",
            "emulatedRtt": "userspace relay: +RTT/2 per direction, first request on a new connection held +1 RTT for the handshake",
            "loadTime": "perf_counter from first connect to last response byte",
            "assets": "shared/assets.json",
        },
        "capture": capture_info,
        "runs": runs,
    }
    out = OUT / f"measurement-{stamp}.json"
    out.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    print(f"\nwrote {out.relative_to(ROOT)}")
    if cap:
        print(f"capture {pcap.relative_to(ROOT)}  (open in Wireshark; filter: tcp.flags.syn==1 && tcp.flags.ack==0)")

    # Sanity checks: the counts that must hold for a sequential run.
    bad = []
    for t in trials:
        want = t["objects"] if t["strategy"] == "close" else 1
        if t["clientConnections"] != want or t["serverConnections"] != want or t["requests"] != t["objects"]:
            bad.append(t)
        if "captureConnections" in t and (t["captureConnections"] != want or t["captureHandshakes"] != want):
            bad.append(t)
    if bad:
        print(f"WARNING: {len(bad)} trial(s) with unexpected counts", file=sys.stderr)
        return 1
    print(f"checks passed: {len(trials)} trials, connection and handshake counts as expected"
          + (" (client, server and capture agree)" if cap else " (client and server agree)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
