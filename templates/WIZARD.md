# Mythic L2 — Wizard CLI Project Configuration

## Architecture

Monorepo: `programs/` (Rust BPF) + `services/` (Node.js) + `website/` (Next.js) + `scripts/` (ops) + `genesis/` (modifier) + `sdk/` (Rust) + `infra/` (configs)

Stack: Native `solana_program` (NO Anchor), borsh 0.10, Solana CLI 3.0.15, Rust 1.93, Next.js 14, Tailwind, TypeScript, Node 20

## Program IDs (L2)

| Program | ID |
|---------|-----|
| Bridge L1 | `MythBrdg11111111111111111111111111111111111` |
| Bridge L2 | `MythBrdgL2111111111111111111111111111111111` |
| MYTH Token | `MythToken1111111111111111111111111111111111` |
| Launchpad | `MythPad111111111111111111111111111111111111` |
| Swap | `MythSwap11111111111111111111111111111111111` |
| Staking | `MythStak11111111111111111111111111111111111` |
| Governance | `MythGov111111111111111111111111111111111111` |
| Airdrop | `MythDrop11111111111111111111111111111111111` |
| Settlement | `MythSett1ement11111111111111111111111111111` |
| AI Precompiles | `CT1yUSX8n5uid5PyrPYnoG5H6Pp2GoqYGEKmMehq3uWJ` |
| Compute Market | `AVWSp12ji5yoiLeC9whJv5i34RGF5LZozQin6T58vaEh` |

**Deployed Swap (upgradeable):** `3QB8S38ouuREEDPxnaaGeujLsUhwFoRbLAejKywtEgv7`

**L1 Mainnet:** Bridge `oEQfREm4FQkaVeRoxJHkJLB1feHprrntY6eJuW2zbqQ`, Settlement `4TrowzShv4CrsuqZeUdLLVMdnDDkqkmnER1MZ5NsSaav`

## Token Mints (L2)

| Token | Mint | Decimals |
|-------|------|----------|
| MYTH | `7sfazeMxmuoDkuU5fHkDGin8uYuaTkZrRSwJM1CHXvDq` | 6 |
| wSOL | `FEJa8wGyhXu9Hic1jNTg76Atb57C7jFkmDyDTQZkVwy3` | 9 |
| USDC | `6QTVHn4TUPQSpCH1uGmAK1Vd6JhuSEeKMKSi1F1SZMN` | 6 |
| wBTC | `8Go32n5Pv4HYdML9DNr8ePh4UHunqS9ZgjKMurz1vPSw` | 8 |
| wETH | `4zmzPzkexJRCVKSrYCHpmP8TVX6kMobjiFu8dVKtuXGT` | 8 |

## Key Addresses

- **Sequencer:** `DLB2NZ5PSNAoChQAaUCBwoHCf6vzeStDa6kCYbB8HjSg`
- **Deployer:** `4pPDuqj4bJjjti3398MhwUvQgPR4Azo6sEeZAhHhsk6s`
- **Foundation:** `AnVqSYE3ArJX9ZCbiReFcNa2JdLyri3GGGt34j63hT9e`

## Build Rules

- Pin `blake3 = ">=1.3, <1.8"` in workspace Cargo.toml
- Pin `getrandom = { version = "0.2", features = ["custom"] }`
- Pin `solana-program = "=2.1.17"`
- Build command: `cargo build-sbf` (first time: `--force-tools-install`)
- Profile: `overflow-checks = true`, `lto = "fat"`

## Fee System

- 50% validators / 10% foundation / 40% BURN (real `spl_token::burn`)
- Per-type tracking: gas, compute, inference, bridge, subnet
- CPI: swap + launchpad invoke myth-token `CollectFee`

## RPC & Networks

- **L2 RPC:** `https://rpc.mythic.sh` (port 8899)
- **L1 Mainnet:** `https://api.mainnet-beta.solana.com`
- **Explorer API:** `https://api.mythic.sh` (port 4000)
- **DEX API:** `https://dex.mythic.sh` (port 4001)
- **Supply Oracle:** `https://mythic.sh/api/supply/stats`

## Coding Conventions

- **Rust:** Native `solana_program`. Borsh. Every instruction validates all accounts. `checked_` arithmetic everywhere.
- **Scripts:** `.mjs` ES modules, `@solana/web3.js` v1
- **Websites:** Next.js 14 app router, Tailwind. Colors: green `#39FF14`, violet `#7B2FFF`. Zero border-radius. Glass-morphism.
- **Typography:** Sora (display), Inter (body), JetBrains Mono (code)

## Agents

Specialist agents available via `/agent <type> <prompt>`:
- `program-engineer` — Solana program development (native, borsh, PDAs, CPIs)
- `defi-ops` — Pool management, price syncing, launchpad, fee collection
- `validator-ops` — Frankendancer/fddev debugging, genesis, consensus
- `bridge-security` — Bridge operations, withdrawal expediting, L1<>L2 state
- `frontend-dev` — Next.js 14, Tailwind, Mythic brand guidelines

## Skills

Available via slash commands:
- `/build [program|all]` — Build BPF programs
- `/deploy <program> [l2|l1]` — Deploy programs
- `/audit [program]` — Security audit
- `/bridge-status` — Bridge health check
- `/supply` — MYTH token stats
- `/pool-status` — AMM pool reserves and prices
