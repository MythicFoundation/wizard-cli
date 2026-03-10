# Wizard CLI

AI-powered development agent for Solana and Mythic L2. Claude + OpenAI with 27 native blockchain tools in your terminal.

## Overview

Wizard CLI is an interactive AI agent purpose-built for Solana development. It connects Claude and OpenAI models directly to on-chain operations — deploy programs, inspect accounts, bridge assets, manage validators, and write code, all from a single terminal session.

- **27 native tools** across filesystem, shell, Solana L1, and Mythic L2
- **11 AI models** from Anthropic and OpenAI, switchable mid-conversation
- **Free tier** — 25 messages/day with no API key required
- **YOLO mode** — auto-execute all tool calls without confirmation

## Install

```bash
curl -sSfL https://mythic.sh/wizard | bash
```

Or clone manually:

```bash
git clone https://github.com/MythicFoundation/wizard-cli.git ~/.wizard-cli
cd ~/.wizard-cli && npm install && npm run build
ln -sf ~/.wizard-cli/dist/cli.js ~/.local/bin/wizard
```

Requires Node.js 18+. The installer handles this automatically.

## Usage

```bash
# Interactive mode
wizard

# With initial prompt
wizard "deploy my program to devnet"

# YOLO mode — auto-execute everything
wizard --yolo "create a token mint with 6 decimals"

# Specify model
wizard --model opus
wizard --model gpt4.1

# Quick commands
wizard status                     # Mythic L2 network status
wizard balance <address>          # Check balance
wizard deploy-validator --tier ai # Validator deployment
wizard networks                   # List available networks
```

### CLI Options

| Flag | Description |
|------|-------------|
| `-y, --yolo` | Auto-execute all tool calls |
| `-m, --model <name>` | Model selection (sonnet, opus, haiku, gpt4.1, o3, etc.) |
| `-n, --network <name>` | Solana network (mainnet-beta, devnet, mythic-l2, etc.) |
| `-k, --keypair <path>` | Path to Solana keypair JSON |
| `--rpc <url>` | Custom RPC endpoint |

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/model [name]` | Switch model or show picker |
| `/models` | List all models with pricing |
| `/yolo` | Toggle auto-execute mode |
| `/network <name>` | Switch Solana network |
| `/keypair <path>` | Set active keypair |
| `/status` | Session status and config |
| `/cost` | Token usage and cost breakdown |
| `/tools` | List all 27 tools |
| `/compact` | Summarize conversation to save context |
| `/clear` | Clear conversation history and stats |
| `/config <k> <v>` | Set a configuration value |
| `/exit` | Exit |

## Tools

### Filesystem (6)

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents with optional line range |
| `write_file` | Create or overwrite a file |
| `edit_file` | Surgical string replacement in a file |
| `glob_files` | Find files by glob pattern |
| `grep` | Regex search across file contents (ripgrep) |
| `list_directory` | List directory entries |

### Shell (1)

| Tool | Description |
|------|-------------|
| `bash` | Execute any command — git, npm, cargo, solana CLI, anchor, ssh |

### Solana (11)

| Tool | Description |
|------|-------------|
| `solana_balance` | SOL/MYTH balance of any address |
| `solana_account_info` | Account owner, lamports, data size, executable |
| `solana_transfer` | Send SOL from loaded keypair |
| `solana_transaction` | Inspect a transaction by signature |
| `solana_recent_transactions` | Recent signatures for an address |
| `solana_token_accounts` | All SPL token accounts for a wallet |
| `solana_program_accounts` | Accounts owned by a program |
| `solana_airdrop` | Request devnet/testnet airdrop |
| `solana_deploy_program` | Deploy a compiled .so program |
| `solana_network_status` | Slot, epoch, TPS, version |
| `solana_keygen` | Generate a new Solana keypair |

### Mythic L2 (9)

| Tool | Description |
|------|-------------|
| `mythic_network_status` | L2 slot, version, supply, burns |
| `mythic_bridge_status` | Vault balance, config, challenge period |
| `mythic_supply` | Circulating supply, total burned |
| `mythic_validators` | Active validators, stake, rewards |
| `mythic_deploy_validator` | Generate validator install command |
| `mythic_swap_pools` | DEX pool reserves and volume |
| `mythic_token_info` | Mint supply, decimals, owner |
| `mythic_program_list` | All 11 Mythic programs and token mints |
| `mythic_wallet_overview` | Full wallet portrait (balance + tokens + txs) |

## Models

### Anthropic

| Model | Alias | Tier | Context |
|-------|-------|------|---------|
| Claude Opus 4.6 | `opus` | Flagship | 200K |
| Claude Sonnet 4.6 | `sonnet` | Balanced | 200K |
| Claude Sonnet 4 | `sonnet` | Balanced | 200K |
| Claude Haiku 4.5 | `haiku` | Fast | 200K |

### OpenAI

| Model | Alias | Tier | Context |
|-------|-------|------|---------|
| GPT-4.1 | `gpt4.1` | Flagship | 1M |
| GPT-4.1 Mini | `gpt4.1-mini` | Balanced | 1M |
| GPT-4.1 Nano | `gpt4.1-nano` | Fast | 1M |
| o3 | `o3` | Reasoning | 200K |
| o3 Mini | `o3-mini` | Reasoning | 200K |
| o4 Mini | `o4-mini` | Reasoning | 200K |

Switch mid-conversation: `/model opus`, `/model gpt4.1`, `/model o3`

## Networks

| Name | RPC |
|------|-----|
| `mythic-l2` | `https://rpc.mythic.sh` |
| `mythic-testnet` | `https://testnet.mythic.sh` |
| `mainnet-beta` | `https://api.mainnet-beta.solana.com` |
| `devnet` | `https://api.devnet.solana.com` |
| `testnet` | `https://api.testnet.solana.com` |
| `localnet` | `http://127.0.0.1:8899` |

Default network is `mythic-l2`. Switch with `--network` flag or `/network` command.

## Configuration

Set your own API key for unlimited usage:

```bash
export ANTHROPIC_API_KEY=sk-ant-...    # Claude models
export OPENAI_API_KEY=sk-...           # OpenAI models
```

Or configure persistently:

```bash
wizard config set apiKey sk-ant-...
wizard config set network devnet
wizard config set keypairPath ~/.config/solana/id.json
```

## Architecture

```
src/
├── cli.ts                 Entry point, CLI argument parsing
├── config/
│   ├── constants.ts       Models, networks, program IDs, token mints
│   └── settings.ts        Persistent config, free tier rate limiting
├── core/
│   ├── repl.ts            Interactive REPL, slash commands, markdown rendering
│   └── system-prompt.ts   Claude system prompt with full Mythic L2 context
├── providers/
│   └── claude.ts          Anthropic SDK streaming + tool_use loop
└── tools/
    ├── registry.ts        Tool aggregation and routing
    ├── filesystem/        File read, write, edit, glob, grep
    ├── shell/             Bash command execution
    ├── solana/            Solana L1 blockchain operations
    └── mythic/            Mythic L2 ecosystem tools
```

## Build

```bash
git clone https://github.com/MythicFoundation/wizard-cli.git
cd wizard-cli
npm install
npm run build    # outputs to dist/cli.js
npm link         # links 'wizard' command globally
```

## Links

- **Website**: [wizardcli.com](https://wizardcli.com)
- **Docs**: [wizardcli.com/#docs](https://wizardcli.com/#docs)
- **Mythic L2**: [mythic.sh](https://mythic.sh)
- **MythicSwap**: [mythicswap.app](https://mythicswap.app)
- **Mythic.Fun**: [mythic.fun](https://mythic.fun)
- **Foundation**: [mythic.foundation](https://mythic.foundation)

## License

MIT — see [LICENSE](LICENSE) for details.
