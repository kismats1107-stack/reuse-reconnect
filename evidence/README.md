# Evidence

Raw output of the real measurement run shown on the website's Results page (`lab/run_experiment.py`, 22 Oct 2026).

| File | What it is |
|---|---|
| `measurement-20261022-203701.json` | 200 trials: 1–40 files × 0/10/50/100 ms RTT × both strategies × 5 repetitions. Each trial counts connections three ways (client sockets, server accepts, captured SYN packets). |
| `capture-20261022-203701.pcapng` | The loopback packet capture from the same run (dumpcap, headers only). Open it in Wireshark and filter with `tcp.flags.syn==1 && tcp.flags.ack==0` to see one SYN per TCP connection. |

RTT values above 0 ms were emulated by `lab/relay.py` on one laptop. 0 ms is plain loopback.
