---
name: bridge-status
command: /bridge-status
description: Check Mythic L2 bridge health and pending withdrawals
---

# Bridge Status

Check the health and status of the Mythic L1<>L2 bridge.

## Instructions

1. Use `mythic_bridge_status` tool to get bridge state
2. Check L1 escrow balance using `solana_balance` on the bridge PDA
3. Check pending withdrawals count and total value
4. Report any anomalies

## Key Addresses

- L1 Bridge Program: `oEQfREm4FQkaVeRoxJHkJLB1feHprrntY6eJuW2zbqQ`
- L2 Bridge Program: `MythBrdgL2111111111111111111111111111111111`
- Config PDA: `4A76xw47iNfTkoC5dGSGND5DW5z3E5gPdjPzp8Gnk9s9`
- Sequencer: `DLB2NZ5PSNAoChQAaUCBwoHCf6vzeStDa6kCYbB8HjSg`

## Parameters

- Challenge period: 24 hours (86,400s)
- Max single withdrawal: 1,000 SOL
- Daily limit: 10,000 SOL

## Health Checks

1. Escrow balance >= total pending withdrawals
2. Challenge periods properly enforced
3. Nonce sequencing intact (no gaps)
4. Sequencer responsive and signing
5. Daily withdrawal usage vs limit

## Output

Report: bridge health (healthy/degraded/critical), escrow balance, pending withdrawals count, daily usage, any alerts.
