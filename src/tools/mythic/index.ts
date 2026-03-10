import { createToolDefinition } from '../../providers/claude.js'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { NETWORKS, MYTHIC_PROGRAMS, MYTHIC_MINTS, MYTH_L1_MINT } from '../../config/constants.js'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

const L2_RPC = NETWORKS['mythic-l2']
const L1_RPC = NETWORKS['mainnet-beta']

function getL2(): Connection {
  return new Connection(L2_RPC, 'confirmed')
}

export function getMythicTools(): Tool[] {
  return [
    createToolDefinition(
      'mythic_network_status',
      'Get Mythic L2 network status: current slot, block height, validator count, TPS.',
      {},
      [],
    ),

    createToolDefinition(
      'mythic_bridge_status',
      'Get bridge status: vault balance, config, recent deposits/withdrawals.',
      {},
      [],
    ),

    createToolDefinition(
      'mythic_supply',
      'Get MYTH token supply info: total, circulating, burned, from the supply oracle.',
      {},
      [],
    ),

    createToolDefinition(
      'mythic_validators',
      'Get list of active Mythic L2 validators with their stake and rewards.',
      {},
      [],
    ),

    createToolDefinition(
      'mythic_deploy_validator',
      'Generate the one-liner command to deploy a Mythic L2 validator on a Linux server. Optionally specify tier.',
      {
        tier: { type: 'string', description: 'Validator tier: mini, validator, or ai (default: auto-detect)' },
        ssh_target: { type: 'string', description: 'SSH target (e.g., user@host) to deploy remotely' },
      },
      [],
    ),

    createToolDefinition(
      'mythic_swap_pools',
      'Get all MythicSwap pools with liquidity and volume data.',
      {},
      [],
    ),

    createToolDefinition(
      'mythic_token_info',
      'Get info about a token on Mythic L2: supply, holders, mint authority.',
      {
        mint: { type: 'string', description: 'Token mint address' },
      },
      ['mint'],
    ),

    createToolDefinition(
      'mythic_program_list',
      'List all Mythic L2 native programs with their addresses and descriptions.',
      {},
      [],
    ),

    createToolDefinition(
      'mythic_wallet_overview',
      'Get a complete overview of a wallet on Mythic L2: SOL balance, all token balances, recent transactions.',
      {
        address: { type: 'string', description: 'Wallet address on Mythic L2' },
      },
      ['address'],
    ),
  ]
}

export async function executeMythicTool(name: string, input: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case 'mythic_network_status': {
        const conn = getL2()
        const [slot, blockHeight, epochInfo, version] = await Promise.all([
          conn.getSlot(),
          conn.getBlockHeight(),
          conn.getEpochInfo(),
          conn.getVersion(),
        ])

        let tps = 0
        try {
          const perf = await conn.getRecentPerformanceSamples(1)
          if (perf.length > 0) tps = Math.round(perf[0].numTransactions / perf[0].samplePeriodSecs)
        } catch { }

        // Try supply oracle
        let supply: any = null
        try {
          const res = await fetch('https://mythic.sh/api/supply/stats')
          if (res.ok) supply = await res.json()
        } catch { }

        return JSON.stringify({
          network: 'Mythic L2 (Firedancer)',
          rpc: L2_RPC,
          slot,
          block_height: blockHeight,
          epoch: epochInfo.epoch,
          tps,
          version: version['solana-core'],
          ...(supply ? {
            total_supply: supply.totalSupply,
            circulating: supply.circulatingSupply,
            burned: supply.totalBurned,
          } : {}),
        }, null, 2)
      }

      case 'mythic_bridge_status': {
        const conn = getL2()
        // Bridge config PDA on L1
        const bridgeConfig = '4A76xw47iNfTkoC5dGSGND5DW5z3E5gPdjPzp8Gnk9s9'
        const vault = '4A8bGnKvR4maxwozEWNN2x5haMjq64non9UVHwsbUck3'

        // Get vault balance on L1
        const l1Conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed')
        let vaultBalance = 'unknown'
        try {
          const tokenAccounts = await l1Conn.getParsedTokenAccountsByOwner(
            new PublicKey(vault),
            { mint: new PublicKey(MYTH_L1_MINT) },
          )
          if (tokenAccounts.value.length > 0) {
            vaultBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmountString
          }
        } catch { }

        return JSON.stringify({
          l1_bridge_program: MYTHIC_PROGRAMS.bridge_l1,
          l2_bridge_program: MYTHIC_PROGRAMS.bridge_l2,
          l1_bridge_config: bridgeConfig,
          l1_vault: vault,
          vault_myth_balance: vaultBalance,
          l1_myth_mint: MYTH_L1_MINT,
          challenge_period: '86400 seconds (24h)',
        }, null, 2)
      }

      case 'mythic_supply': {
        try {
          const res = await fetch('https://mythic.sh/api/supply/stats')
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          return JSON.stringify(data, null, 2)
        } catch (err: any) {
          return `Error fetching supply: ${err.message}. Try: curl https://mythic.sh/api/supply/stats`
        }
      }

      case 'mythic_validators': {
        try {
          const res = await fetch('https://mythic.sh/api/supply/validators')
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          return JSON.stringify(data, null, 2)
        } catch (err: any) {
          // Fallback: query RPC
          const conn = getL2()
          const voteAccounts = await conn.getVoteAccounts()
          return JSON.stringify({
            current: voteAccounts.current.map((v) => ({
              identity: v.nodePubkey,
              vote: v.votePubkey,
              stake: v.activatedStake / LAMPORTS_PER_SOL,
              commission: v.commission,
              last_vote: v.lastVote,
            })),
            delinquent: voteAccounts.delinquent.length,
          }, null, 2)
        }
      }

      case 'mythic_deploy_validator': {
        const tier = input.tier || ''
        const tierEnv = tier ? `MYTHIC_TIER=${tier} ` : ''
        const installCmd = `${tierEnv}curl -sSfL https://mythic.sh/install | sudo bash`

        if (input.ssh_target) {
          return JSON.stringify({
            description: `Deploy Mythic L2 validator to ${input.ssh_target}`,
            command: `ssh ${input.ssh_target} '${installCmd}'`,
            post_install: [
              `ssh ${input.ssh_target} 'sudo systemctl start mythic-validator'`,
              `ssh ${input.ssh_target} 'sudo systemctl status mythic-validator'`,
              `ssh ${input.ssh_target} 'curl -s http://127.0.0.1:8899 -X POST -H "Content-Type: application/json" -d \\'"'"'{"jsonrpc":"2.0","id":1,"method":"getSlot"}\\'"'"''`,
            ],
            verify: 'Check mythic.sh/validators for the new validator',
            tier: tier || 'auto-detect',
            hardware_requirements: {
              mini: '8 cores, 32GB RAM, 500GB SSD',
              validator: '32 cores, 128GB RAM, 2TB NVMe',
              ai: '48 cores, 256GB RAM, 10TB NVMe, NVIDIA GPU',
            },
          }, null, 2)
        }

        return JSON.stringify({
          description: 'Deploy a Mythic L2 validator',
          command: installCmd,
          post_install: [
            'sudo systemctl start mythic-validator',
            'sudo systemctl status mythic-validator',
          ],
          verify: 'Check mythic.sh/validators for the new validator',
          tier: tier || 'auto-detect (based on hardware)',
          hardware_requirements: {
            mini: '8 cores, 32GB RAM, 500GB SSD (~$50/mo)',
            validator: '32 cores, 128GB RAM, 2TB NVMe (~$200/mo)',
            ai: '48 cores, 256GB RAM, 10TB NVMe, NVIDIA GPU (~$500/mo)',
          },
          genesis_program: '10 spots, 500K MYTH delegation each',
          docs: 'https://mythic.sh/docs',
        }, null, 2)
      }

      case 'mythic_swap_pools': {
        try {
          const res = await fetch('https://dex.mythic.sh/pools')
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          return JSON.stringify(data, null, 2)
        } catch (err: any) {
          return `Error fetching pools: ${err.message}. DEX API may be at https://dex.mythic.sh`
        }
      }

      case 'mythic_token_info': {
        const conn = getL2()
        const mint = new PublicKey(input.mint)
        const supply = await conn.getTokenSupply(mint)
        const info = await conn.getAccountInfo(mint)

        return JSON.stringify({
          mint: input.mint,
          supply: supply.value.uiAmountString,
          decimals: supply.value.decimals,
          data_size: info?.data.length,
          owner: info?.owner.toBase58(),
          known_token: Object.entries(MYTHIC_MINTS).find(([_, v]) => v === input.mint)?.[0] || null,
        }, null, 2)
      }

      case 'mythic_program_list': {
        return JSON.stringify({
          programs: Object.entries(MYTHIC_PROGRAMS).map(([name, id]) => ({
            name: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            program_id: id,
          })),
          token_mints: Object.entries(MYTHIC_MINTS).map(([symbol, mint]) => ({
            symbol,
            mint,
          })),
          l1_myth_mint: MYTH_L1_MINT,
        }, null, 2)
      }

      case 'mythic_wallet_overview': {
        const conn = getL2()
        const pubkey = new PublicKey(input.address)

        const [balance, tokenAccounts, recentTxs] = await Promise.all([
          conn.getBalance(pubkey),
          conn.getParsedTokenAccountsByOwner(pubkey, {
            programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          }),
          conn.getSignaturesForAddress(pubkey, { limit: 10 }),
        ])

        return JSON.stringify({
          address: input.address,
          network: 'Mythic L2',
          native_balance_myth: balance / LAMPORTS_PER_SOL,
          native_balance_lamports: balance,
          tokens: tokenAccounts.value.map((a) => {
            const info = a.account.data.parsed.info
            const symbol = Object.entries(MYTHIC_MINTS).find(([_, v]) => v === info.mint)?.[0] || 'Unknown'
            return {
              symbol,
              mint: info.mint,
              amount: info.tokenAmount.uiAmountString,
              decimals: info.tokenAmount.decimals,
            }
          }),
          recent_transactions: recentTxs.map((t) => ({
            signature: t.signature,
            time: t.blockTime ? new Date(t.blockTime * 1000).toISOString() : null,
            status: t.err ? 'failed' : 'success',
          })),
        }, null, 2)
      }

      default:
        return `Unknown Mythic tool: ${name}`
    }
  } catch (err: any) {
    return `Error in ${name}: ${err.message}`
  }
}
