"""Optional packet capture with Wireshark's dumpcap, analysed with tshark.

The experiment works without this; when Wireshark (and Npcap's loopback
adapter on Windows) is installed, every trial is also checked against the
packets that really crossed the loopback interface:

* a TCP connection = a SYN (without ACK) sent to the listening port
* a handshake      = that SYN, then the SYN-ACK, then the client's ACK
"""
from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path

_WIN_DIRS = [Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Wireshark"]


def find_tool(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    for d in _WIN_DIRS:
        exe = d / f"{name}.exe"
        if exe.exists():
            return str(exe)
    return None


def loopback_interface(dumpcap: str) -> str | None:
    out = subprocess.run([dumpcap, "-D"], capture_output=True, text=True, timeout=20).stdout
    for line in out.splitlines():
        if "loopback" in line.lower() or line.rstrip().endswith("(lo)") or " lo " in f" {line} ":
            # "7. \Device\NPF_Loopback (Adapter for loopback traffic capture)" → interface name
            return line.split(". ", 1)[1].split(" (", 1)[0].strip()
    return None


def tool_version(exe: str) -> str:
    out = subprocess.run([exe, "-v"], capture_output=True, text=True, timeout=20).stdout
    return out.splitlines()[0].strip() if out else Path(exe).stem


class Capture:
    """Runs dumpcap in the background for the lifetime of a ``with`` block."""

    def __init__(self, out_file: Path, ports: list[int]):
        self.dumpcap = find_tool("dumpcap")
        self.tshark = find_tool("tshark")
        if not self.dumpcap or not self.tshark:
            raise RuntimeError("Wireshark (dumpcap + tshark) not found")
        iface = loopback_interface(self.dumpcap)
        if not iface:
            raise RuntimeError("no loopback capture interface (install Npcap with loopback support)")
        self.iface = iface
        self.file = out_file
        self.ports = ports
        self.proc: subprocess.Popen | None = None

    def __enter__(self) -> "Capture":
        bpf = " or ".join(f"tcp port {p}" for p in self.ports)
        flags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
        self.proc = subprocess.Popen(
            # -s 128: headers are all the analysis needs; payload would make the file huge
            [self.dumpcap, "-q", "-i", self.iface, "-s", "128", "-f", bpf, "-w", str(self.file)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            creationflags=flags,
        )
        # dumpcap announces "Capturing on ..." once the filter is live.
        deadline = time.time() + 15
        assert self.proc.stderr
        while time.time() < deadline:
            line = self.proc.stderr.readline()
            if "Capturing on" in line:
                break
            if self.proc.poll() is not None:
                raise RuntimeError(f"dumpcap exited: {line.strip()}")
        # Keep draining stderr: if the pipe fills up, dumpcap blocks and silently stops capturing.
        threading.Thread(target=self.proc.stderr.read, name="dumpcap-stderr", daemon=True).start()
        time.sleep(0.3)
        return self

    def __exit__(self, *exc) -> None:
        if not self.proc:
            return
        time.sleep(0.3)  # let the last packets drain into the file
        # A graceful stop makes dumpcap flush and close the file properly.
        if sys.platform == "win32":
            self.proc.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            self.proc.send_signal(signal.SIGINT)
        try:
            self.proc.wait(10)
        except subprocess.TimeoutExpired:
            self.proc.kill()

    def packets(self) -> list[dict]:
        fields = ["frame.time_epoch", "tcp.stream", "tcp.srcport", "tcp.dstport", "tcp.flags.syn", "tcp.flags.ack", "tcp.flags.fin", "tcp.flags.reset"]
        cmd = [self.tshark, "-r", str(self.file), "-T", "fields", "-E", "separator=,"]
        for f in fields:
            cmd += ["-e", f]
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
        rows = []
        for line in out.splitlines():
            parts = line.split(",")
            if len(parts) != len(fields) or not parts[1]:
                continue
            flag = lambda v: v in ("1", "True")  # noqa: E731 (tshark prints 1/0 or True/False)
            rows.append({
                "t": float(parts[0]), "stream": int(parts[1]), "src": int(parts[2]), "dst": int(parts[3]),
                "syn": flag(parts[4]), "ack": flag(parts[5]), "fin": flag(parts[6]), "rst": flag(parts[7]),
            })
        return rows


@dataclass
class WireCounts:
    connections: int
    handshakes: int
    packets: int


def count_window(packets: list[dict], port: int, start: float, end: float) -> WireCounts:
    """Counts the streams to ``port`` whose SYN falls inside [start, end]."""
    streams: dict[int, list[dict]] = {}
    for p in packets:
        streams.setdefault(p["stream"], []).append(p)
    conns = hs = pkts = 0
    for rows in streams.values():
        rows.sort(key=lambda r: r["t"])
        syn = next((r for r in rows if r["syn"] and not r["ack"] and r["dst"] == port), None)
        if syn is None or not (start - 0.05 <= syn["t"] <= end + 0.05):
            continue
        conns += 1
        pkts += len(rows)
        synack = next((r for r in rows if r["syn"] and r["ack"] and r["src"] == port and r["t"] >= syn["t"]), None)
        if synack and any(not r["syn"] and r["ack"] and r["dst"] == port and r["t"] >= synack["t"] for r in rows):
            hs += 1
    return WireCounts(conns, hs, pkts)
