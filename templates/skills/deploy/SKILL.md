---
name: deploy
command: /deploy
description: Deploy a Solana program to Mythic L2 or Solana L1
---

# Deploy Program

Deploy a compiled Solana BPF program to the target network.

## Instructions

1. First argument: program name (required)
2. Second argument: target network — `l2` (default) or `l1`
3. ALWAYS confirm with the user before deploying (this is a manual-only operation)

## Pre-Deploy Checklist

- Verify the .so file exists in `target/deploy/` or `target/sbf-solana-solana/release/`
- Check deployer wallet balance (need ~5 SOL for program deploy)
- Verify the program keypair exists for the target program ID

## Deploy Commands

### L2 (Mythic L2)
```bash
solana program deploy target/deploy/<name>.so \
  --url https://rpc.mythic.sh \
  --keypair <deployer-keypair> \
  --program-id <program-keypair>
```

### L1 (Solana Mainnet)
```bash
solana program deploy target/deploy/<name>.so \
  --url https://api.mainnet-beta.solana.com \
  --keypair <deployer-keypair> \
  --program-id <program-keypair>
```

**IMPORTANT:** Frankendancer RPC does NOT support program deploy RPCs. For L1 deploys, always use `https://api.mainnet-beta.solana.com`.

## Post-Deploy

- Verify deployment: `solana program show <program-id>`
- Run initialization if needed
- Update any config PDAs
