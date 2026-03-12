# Wizard CLI

AI-powered development toolkit for Solana and Mythic L2. Gives you a full Claude Code agent setup in one command, plus an interactive AI REPL with 27 native blockchain tools.

## What It Does

Wizard CLI does two things:

1. **`wizard init`** — Scaffolds a complete [Claude Code](https://claude.com/claude-code) agent configuration in your project. This gives Claude Code deep knowledge of Mythic L2's architecture, programs, and APIs — plus specialist agents and slash commands for common Solana dev tasks.

2. **`wizard` (REPL)** — An interactive AI agent in your terminal with 27 native Solana/Mythic tools. Deploy programs, inspect accounts, bridge assets, check pools, and write code — all from one session.

## Install

```bash
curl -sSfL https://mythic.sh/wizard | bash
```

Or manually:

```bash
git clone https://github.com/MythicFoundation/wizard-cli.git ~/.wizard-cli
cd ~/.wizard-cli && npm install && npm run build
ln -sf ~/.wizard-cli/dist/cli.js ~/.local/bin/wizard
```

Requires Node.js 18+.

## Quick Start

### Set Up Claude Code for Your Project

```bash
cd your-solana-project
wizard init
```

This creates 10 files that configure Claude Code as a Mythic L2 development expert:

```
your-project/
├── CLAUDE.md                                  # Project instructions for Claude
└── .claude/
    ├── agents/
    │   ├── program-engineer.md                # Solana program specialist
    │   ├── defi-builder.md                    # DeFi integration specialist
    │   └── frontend-dev.md                    # Next.js + wallet UI specialist
    ├── skills/
    │   ├── build/SKILL.md                     # /build — compile BPF programs
    │   ├── deploy/SKILL.md                    # /deploy — deploy to L2 or L1
    │   ├── check-network/SKILL.md             # /check-network — RPC health
    │   ├── audit/SKILL.md                     # /audit — security audit
    │   └── new-program/SKILL.md               # /new-program — scaffold program
    └── settings.local.json                    # Tool permissions for Solana dev
```

Then open Claude Code in that directory:

```bash
claude
```

Claude Code auto-detects everything. Try `/build`, `/audit`, or ask it to write a Solana program.

### Authenticate

```bash
wizard login
```

Two options:
- **Claude Max** (recommended): Run `claude auth login` to authenticate with your subscription
- **API Key**: `export ANTHROPIC_API_KEY=sk-ant-...` or `wizard config set apiKey sk-ant-...`

No key? The REPL includes a free tier (25 messages/day).

### Interactive REPL

```bash
wizard                                    # Start interactive session
wizard "deploy my program to devnet"      # With initial prompt
wizard --yolo "create a token mint"       # Auto-execute all tools
wizard --model opus                       # Use a specific model
```

---

## Claude Code Agent Setup (wizard init)

### What Gets Generated

#### CLAUDE.md — Project Instructions

The core file. When Claude Code opens your project, it reads `CLAUDE.md` and gains full context on:

- **Mythic L2 architecture** — L2 as Solana fork, Frankendancer validator, native `solana_program` (no Anchor)
- **All program IDs** — Bridge, Token, Swap, Launchpad, Staking, Governance, Airdrop, Settlement, AI Precompiles, Compute Market
- **Token mints** — MYTH, wSOL, USDC, wBTC, wETH with addresses and decimals
- **Build rules** — Pinned deps (`solana-program = "=2.1.17"`, `borsh = "0.10"`, `blake3`, `getrandom`), cargo-build-sbf, overflow checks
- **Fee system** — 50% validators / 10% foundation / 40% burn, CPI integration pattern
- **Swap integration** — Account ordering, protocol fee vault gotchas, fee structure (3bp protocol + 22bp LP)
- **API endpoints** — RPC, Explorer API, DEX API, Supply Oracle
- **Coding conventions** — Rust patterns, JS/TS patterns, Next.js + Tailwind design system

This means Claude Code can write correct Mythic L2 code from the first prompt — no context-setting needed.

#### 3 Specialist Agents

Found in `.claude/agents/`. Claude Code delegates to these for deep domain work:

| Agent | Model | Specialty |
|-------|-------|-----------|
| **program-engineer** | Opus | Native Solana programs — account validation, PDA derivation, CPI, borsh serialization, MYTH fee collection |
| **defi-builder** | Sonnet | DeFi integrations — MythicSwap pools, mythic.fun launchpad, bridge operations, staking, API consumption |
| **frontend-dev** | Sonnet | Frontend — Next.js 14, Tailwind, Solana wallet-adapter, RPC hooks, design system (Sora/Inter/JetBrains Mono, #39FF14 green) |

Each agent has full architectural knowledge embedded. The program-engineer knows every account validation pattern. The defi-builder knows every API endpoint. The frontend-dev knows the exact design tokens.

#### 5 Slash Commands (Skills)

Found in `.claude/skills/`. Type these in Claude Code:

| Command | What It Does |
|---------|-------------|
| `/build [program\|all]` | Compile BPF programs with correct flags and dep pins |
| `/deploy <program> [l2\|l1]` | Deploy program binary (confirms before executing) |
| `/check-network` | Quick RPC health check (slot, version, supply) |
| `/audit [program-dir]` | 10-point security audit (accounts, arithmetic, signers, PDAs, CPI, rent, access control) |
| `/new-program <name>` | Scaffold a new program directory with correct deps and boilerplate |

#### settings.local.json — Permissions

Pre-approves common Solana dev tools so Claude Code doesn't prompt for every command:

```
cargo build-sbf, cargo check, cargo clippy, cargo test
solana *, spl-token *
npm run/install, npx, node
git *, ls *, curl *
```

### Customization

After `wizard init`, edit any file to match your project:

- Add your own program IDs to `CLAUDE.md`
- Create new agents in `.claude/agents/`
- Add project-specific skills in `.claude/skills/`
- Adjust permissions in `.claude/settings.local.json`

Run `wizard init --force` to re-scaffold and overwrite existing files.

---

## REPL Features

### 27 Native Tools

The REPL gives Claude direct access to blockchain operations — no copy-pasting commands.

**Filesystem (6):** `read_file`, `write_file`, `edit_file`, `glob_files`, `grep`, `list_directory`

**Shell (1):** `bash` — run any command (git, npm, cargo, solana CLI, ssh)

**Solana L1 (11):**
- `solana_balance` — SOL balance
- `solana_account_info` — owner, lamports, data size
- `solana_transfer` — send SOL
- `solana_transaction` — inspect tx by signature
- `solana_recent_transactions` — recent signatures
- `solana_token_accounts` — SPL token accounts
- `solana_program_accounts` — accounts by program
- `solana_airdrop` — devnet/testnet airdrop
- `solana_deploy_program` — deploy .so binary
- `solana_network_status` — slot, epoch, TPS
- `solana_keygen` — generate keypair

**Mythic L2 (9):**
- `mythic_network_status` — slot, version, supply, burns
- `mythic_bridge_status` — vault, config, challenge period
- `mythic_supply` — circulating supply, total burned
- `mythic_validators` — active validators, stake
- `mythic_deploy_validator` — install command generator
- `mythic_swap_pools` — DEX pool reserves, volume
- `mythic_token_info` — mint details
- `mythic_program_list` — all 11 programs + 5 token mints
- `mythic_wallet_overview` — full wallet portrait

### Models

Switch models mid-conversation with `/model <name>`:

| Model | Alias | Provider | Tier |
|-------|-------|----------|------|
| Claude Opus 4.6 | `opus-4.6` | Anthropic | Flagship |
| Claude Sonnet 4.6 | `sonnet-4.6` | Anthropic | Balanced |
| Claude Sonnet 4 | `sonnet` | Anthropic | Balanced |
| Claude Haiku 4.5 | `haiku` | Anthropic | Fast |
| GPT-4.1 | `gpt4.1` | OpenAI | Flagship |
| GPT-4.1 Mini | `gpt4.1-mini` | OpenAI | Balanced |
| GPT-4.1 Nano | `gpt4.1-nano` | OpenAI | Fast |
| o3 | `o3` | OpenAI | Reasoning |
| o4 Mini | `o4-mini` | OpenAI | Reasoning |

### Slash Commands (REPL)

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/model [name]` | Switch model |
| `/models` | List models with pricing |
| `/yolo` | Toggle auto-execute |
| `/network <name>` | Switch Solana network |
| `/keypair <path>` | Set active keypair |
| `/status` | Session info |
| `/cost` | Token usage breakdown |
| `/tools` | List all 27 tools |
| `/compact` | Summarize conversation |
| `/clear` | Reset session |
| `/exit` | Quit |

### Networks

| Name | RPC |
|------|-----|
| `mythic-l2` | `https://rpc.mythic.sh` |
| `mythic-testnet` | `https://testnet.mythic.sh` |
| `mainnet-beta` | `https://api.mainnet-beta.solana.com` |
| `devnet` | `https://api.devnet.solana.com` |
| `localnet` | `http://127.0.0.1:8899` |

Default: `mythic-l2`. Switch with `--network` or `/network`.

---

## All Commands

```bash
wizard                            # Start REPL
wizard [prompt...]                # REPL with initial prompt
wizard init [--force]             # Scaffold Claude Code agent setup
wizard login                      # Authentication options
wizard status                     # Mythic L2 network status
wizard balance <address>          # Check SOL/MYTH balance
wizard deploy-validator [--tier]  # Validator install command
wizard networks                   # List available networks
wizard config set <key> <value>   # Set config
wizard config get [key]           # Get config
wizard config reset               # Reset to defaults
wizard update                     # Update to latest version
wizard uninstall                  # Remove Wizard CLI
```

## Configuration

```bash
# API keys
export ANTHROPIC_API_KEY=sk-ant-...    # Claude models
export OPENAI_API_KEY=sk-...           # OpenAI models

# Persistent config
wizard config set apiKey sk-ant-...
wizard config set model opus
wizard config set network devnet
wizard config set keypairPath ~/.config/solana/id.json
```

## Architecture

```
src/
├── cli.ts                 CLI entry point + subcommands
├── config/
│   ├── constants.ts       Models, networks, program IDs, token mints
│   └── settings.ts        Persistent config, rate limiting
├── core/
│   ├── repl.ts            Interactive REPL, slash commands, markdown rendering
│   └── system-prompt.ts   System prompt with Mythic L2 context
├── providers/
│   └── claude.ts          Anthropic SDK streaming + tool_use loop
└── tools/
    ├── registry.ts        Tool aggregation
    ├── filesystem/        read, write, edit, glob, grep
    ├── shell/             bash execution
    ├── solana/            L1 blockchain operations
    └── mythic/            L2 ecosystem tools

templates/                 Claude Code agent setup files
├── CLAUDE.md              Project instructions
├── agents/                3 specialist agents
├── skills/                5 slash commands
└── settings.local.json    Tool permissions
```

## Build from Source

```bash
git clone https://github.com/MythicFoundation/wizard-cli.git
cd wizard-cli
npm install
npm run build
npm link
```

## Links

- [Mythic L2](https://mythic.sh) — Main network
- [MythicSwap](https://mythicswap.app) — DEX
- [Mythic.Fun](https://mythic.fun) — Launchpad
- [Mythic Foundation](https://mythic.foundation) — Governance
- [Mythic Labs](https://mythiclabs.io) — Company

## License

MIT
