---
name: deploy
description: "Deploy a compiled BPF program to Mythic L2 or Solana devnet"
---

Deploy a program to the specified network. Default target is Mythic L2 (`https://rpc.mythic.sh`).

Steps:
1. Verify the .so file exists at `target/deploy/<program>.so`
2. Check the deployer keypair has sufficient balance
3. Confirm with the user before deploying (show program size and estimated cost)
4. Run: `solana program deploy target/deploy/<program>.so --url <rpc> --keypair <keypair>`
5. Report the program ID and deployment signature

Networks:
- `l2` or `mythic`: `https://rpc.mythic.sh` (default)
- `devnet`: `https://api.devnet.solana.com`
- `mainnet`: `https://api.mainnet-beta.solana.com`

Usage: `/deploy <program-name> [l2|devnet|mainnet]`
