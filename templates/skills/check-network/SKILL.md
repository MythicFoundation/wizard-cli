---
name: check-network
description: "Quick health check of Mythic L2 network"
---

Run a quick health check of the Mythic L2 network.

Check these in parallel:
1. RPC status: `curl -s https://rpc.mythic.sh -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getSlot"}'`
2. Validator version: `curl -s https://rpc.mythic.sh -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}'`
3. Supply stats: `curl -s https://mythic.sh/api/supply/stats`

Report: slot, version, total supply, burned amount, circulating supply.

Usage: `/check-network`
