# Wizard CLI

AI-powered development agent for Solana and Mythic L2. Built on Claude + OpenAI. Command: `wizard`.

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

## Usage

```bash
# Start immediately — 25 free messages/day, no API key needed
wizard
mythic
```

## Usage

```bash
# Interactive mode
mythic

# With initial prompt
mythic "deploy a token on mythic l2"

# YOLO mode (auto-execute everything)
mythic --yolo "create a new solana program that tracks NFT ownership"

# Quick commands
mythic status                    # Mythic L2 network status
mythic balance <address>         # Check balance
mythic networks                  # List networks
mythic deploy-validator          # Validator setup instructions

# Options
mythic --model opus              # Use Claude Opus
mythic --network devnet          # Use Solana devnet
mythic --keypair ~/.config/solana/id.json  # Set keypair
mythic --rpc https://custom.rpc  # Custom RPC
```

## REPL Commands

```
/help          Show commands
/yolo          Toggle YOLO mode
/network       Switch network
/model         Switch model
/keypair       Set keypair
/status        Show config
/tools         List all tools
/clear         Clear history
/exit          Exit
```

## Tools

### Filesystem
`read_file` `write_file` `edit_file` `glob_files` `grep` `list_directory`

### Shell
`bash` — execute any command (git, npm, cargo, solana, anchor, etc.)

### Solana
`solana_balance` `solana_account_info` `solana_transfer` `solana_transaction` `solana_recent_transactions` `solana_token_accounts` `solana_program_accounts` `solana_airdrop` `solana_deploy_program` `solana_network_status` `solana_keygen`

### Mythic L2
`mythic_network_status` `mythic_bridge_status` `mythic_supply` `mythic_validators` `mythic_deploy_validator` `mythic_swap_pools` `mythic_token_info` `mythic_program_list` `mythic_wallet_overview`

## Networks

| Name | RPC |
|------|-----|
| mythic-l2 | https://rpc.mythic.sh |
| mythic-testnet | https://testnet.mythic.sh |
| mainnet-beta | https://api.mainnet-beta.solana.com |
| devnet | https://api.devnet.solana.com |
| testnet | https://api.testnet.solana.com |
| localnet | http://127.0.0.1:8899 |

## License

MIT
