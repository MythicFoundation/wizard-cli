---
name: supply
command: /supply
description: Check MYTH token supply and burn statistics
---

# MYTH Supply Stats

Query the MYTH token supply, burn statistics, and distribution.

## Instructions

1. Use `mythic_supply` tool to get supply data from the oracle
2. Fetch additional stats from `https://mythic.sh/api/supply/stats`
3. Format and display the results

## Key Data Points

- Total supply (initial: 1.12B MYTH)
- Circulating supply
- Total burned (permanently removed via `spl_token::burn`)
- Burn rate (recent period)
- Fee distribution: 50% validators / 10% foundation / 40% burn
- Per-type burn breakdown: gas, compute, inference, bridge, subnet

## MYTH Mint

- L2 Mint: `7sfazeMxmuoDkuU5fHkDGin8uYuaTkZrRSwJM1CHXvDq` (6 decimals)
- L1 Mint: `5UP2iL9DefXC3yovX9b4XG2EiCnyxuVo3S2F6ik5pump` (Token-2022, 6 decimals)

## Output

Report: total supply, circulating, burned, burn rate, distribution breakdown.
