# SKIPPY Scaffold (Second Draft)

Run: `bash skippy_scaffold.sh` from repo root. Files are created only if missing.

Next steps:
1) Replace placeholders in server/services/* with real engine calls.
2) Mount routes in your actual server entry if different.
3) Point the WebSocket client to your real  and call `quotes.mark()` on inbound messages.
4) Swap Health "snapshots" with your Prometheus metrics.
