---
name: pool-status
command: /pool-status
description: Check MythicSwap AMM pool reserves and prices
---

# Pool Status

Query MythicSwap AMM pool reserves, prices, and trading volume.

## Instructions

1. Use `mythic_swap_pools` tool to get all pool data
2. Optionally fetch from DEX API: `https://dex.mythic.sh`
3. Format and display pool status

## Swap Program

- Program ID: `3QB8S38ouuREEDPxnaaGeujLsUhwFoRbLAejKywtEgv7`
- Config PDA: `57ftqTCKyRMSijd9c4KFnafuL7qgviQUbaiwWyKKMS99`
- Fees: 3 bps protocol + 22 bps LP (25 bps total)

## Active Pools

- MYTH/wSOL
- USDC/MYTH
- MYTH/wBTC
- wETH/MYTH

## Data Points Per Pool

- Token A and Token B reserves
- Current price (A per B and B per A)
- 24h volume
- Total value locked (TVL)
- Accumulated fees (protocol + LP)
- Pool creation time

## Output

Table format showing each pool with reserves, price, volume, and TVL.
